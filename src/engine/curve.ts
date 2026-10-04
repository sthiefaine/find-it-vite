// Courbe de difficulté, calendrier des mécaniques et choix de la disposition.
import { createRng, hash32, weightedPick } from "./rng";
import { GEN_VERSION } from "./types";
import type { GenContext, Layout, Modifier, Rule, Slot, Tier } from "./types";

export const ZONE_SIZE = 10;

export const zoneOf = (n: number) => Math.ceil(n / ZONE_SIZE);
export const positionInZone = (n: number) => ((n - 1) % ZONE_SIZE) + 1;

export function slotOf(n: number): Slot {
  const p = positionInZone(n);
  if (p === 1) return "intro";
  if (p === 5) return "breather";
  if (p === 10) return "boss";
  return "normal";
}

// ─── Budget ───
export const baseBudget = (n: number) => 0.9 + 6.6 * (1 - Math.exp(-(n - 1) / 25));

const NORMAL_POSITIONS = [2, 3, 4, 6, 7, 8, 9];
export function slotMultiplier(n: number): number {
  switch (slotOf(n)) {
    case "intro":
      return 0.75;
    case "breather":
      return 0.7;
    case "boss":
      return 1.5;
    default: {
      const i = NORMAL_POSITIONS.indexOf(positionInZone(n));
      return 0.9 + (0.4 * i) / (NORMAL_POSITIONS.length - 1);
    }
  }
}

export const TIER_MULTIPLIER: Record<Tier, number> = { easy: 0.7, normal: 1, expert: 1.3 };
export const INTRO_BUDGET_FACTOR = 0.7; // budget réduit quand une mécanique arrive

export function budgetFor(n: number, tier: Tier, isIntro = false): number {
  return baseBudget(n) * slotMultiplier(n) * TIER_MULTIPLIER[tier] * (isIntro ? INTRO_BUDGET_FACTOR : 1);
}

// Budget → difficulté normalisée [0, 1] qui pilote les paramètres
export const difficultyOf = (budget: number) => Math.min(1, Math.max(0, (budget - 0.6) / 8.4));

// ─── Calendrier ───
export const LAYOUT_INTRO: Record<Layout, number> = { grid: 1, scroll: 4, pile: 8, swarm: 11 };
export const RULE_INTRO: Record<Exclude<Rule, "classic" | "goldRush">, number> = {
  silhouette: 16,
  memory: 21,
  findAll: 26,
  oddOneOut: 31,
};
export const FLASHLIGHT_INTRO = 36;
export const GOLD_RUSH_FROM = 15;
export const LAYOUTS: Layout[] = ["grid", "scroll", "pile", "swarm"];
const ALL_RULES: Rule[] = ["classic", "memory", "silhouette", "oddOneOut", "findAll", "goldRush"];
const ALL_MODIFIERS: Modifier[] = ["flashlight", "lookalikes"];

// classic est toujours permis : c'est la règle de repli
export function allowedRules(ctx: GenContext): Set<Rule> {
  const s = new Set<Rule>(ctx.allowedRules ?? ALL_RULES);
  s.add("classic");
  return s;
}
export const allowedModifiers = (ctx: GenContext) => new Set<Modifier>(ctx.allowedModifiers ?? ALL_MODIFIERS);

// 0 avant l'intro, puis monte de 0,15 à 1 sur les 10 niveaux suivants
export function mechanicWeight(n: number, intro: number): number {
  if (n < intro) return 0;
  return Math.min(1, 0.15 + (0.85 * (n - intro)) / 10);
}

// goldRush : respiration (position 5) d'une zone sur deux à partir du niveau 15
export const isGoldRushSlot = (n: number) =>
  n >= GOLD_RUSH_FROM && positionInZone(n) === 5 && zoneOf(n) % 2 === 0;

export type Intro =
  | { kind: "layout"; layout: Layout }
  | { kind: "rule"; rule: Rule }
  | { kind: "modifier"; modifier: Modifier };

// Mécanique introduite (seule) à ce niveau, si elle est autorisée
export function introAt(n: number, ctx: GenContext): Intro | null {
  for (const l of LAYOUTS) if (l !== "grid" && LAYOUT_INTRO[l] === n) return { kind: "layout", layout: l };
  const rules = allowedRules(ctx);
  for (const [r, at] of Object.entries(RULE_INTRO) as [Rule, number][])
    if (at === n && rules.has(r)) return { kind: "rule", rule: r };
  if (n === FLASHLIGHT_INTRO && allowedModifiers(ctx).has("flashlight"))
    return { kind: "modifier", modifier: "flashlight" };
  return null;
}

// ─── Disposition ───
// Les niveaux vont par paires (2k, 2k+1) dont les deux membres diffèrent :
// toute fenêtre de 3 niveaux contient une telle paire, donc jamais 3 fois la même
// disposition, et chaque niveau ne dépend que de son voisin de paire.
function forcedLayout(n: number, ctx: GenContext): Layout | null {
  const intro = introAt(n, ctx);
  if (!intro) return null;
  return intro.kind === "layout" ? intro.layout : "grid";
}

function layoutWeights(n: number, exclude?: Layout): [Layout, number][] {
  return LAYOUTS.map((l) => [l, l === exclude ? 0 : l === "grid" ? 1 : mechanicWeight(n, LAYOUT_INTRO[l] + 1)]);
}

function rawLayout(n: number, ctx: GenContext, exclude?: Layout): Layout {
  const rng = createRng(hash32(GEN_VERSION, ctx.seed, "layout", n, exclude ?? ""));
  return weightedPick(rng, layoutWeights(n, exclude)) ?? "grid";
}

export function layoutFor(n: number, ctx: GenContext): Layout {
  const forced = forcedLayout(n, ctx);
  if (forced) return forced;
  const partner = n % 2 === 0 ? n + 1 : n - 1;
  const own = rawLayout(n, ctx);
  if (partner < 1) return own;
  const partnerForced = forcedLayout(partner, ctx);
  const other = partnerForced ?? rawLayout(partner, ctx);
  if (other !== own) return own;
  // Collision : on retire le niveau impair (sauf si son partenaire pair est imposé)
  const iMustChange = partnerForced !== null || n % 2 === 1;
  if (!iMustChange) return own;
  // Avant le niveau 4, seule la grille existe : on ne peut pas faire mieux
  return rawLayout(n, ctx, own);
}

// ─── Budget de confusion visuelle ───
export const LOOKALIKE_CAP: Record<Tier, number> = { easy: 0.4, normal: 0.7, expert: 1 };
export const LOOKALIKE_THRESHOLD = 0.4;

export type VisualConfusionBudget = {
  related: number; // silhouettes voisines, espèces différentes
  breed: number; // même espèce, portraits contrastés
  close: number; // races très proches ou paire connue de sosies
};

type ConfusionStage = { from: number; ramp: number; cap: number };
const CONFUSION_STAGES: Record<Tier, Record<keyof VisualConfusionBudget, ConfusionStage>> = {
  easy: {
    related: { from: 15, ramp: 20, cap: .2 },
    breed: { from: 36, ramp: 35, cap: .15 },
    close: { from: 71, ramp: 60, cap: .15 },
  },
  normal: {
    related: { from: 9, ramp: 16, cap: .25 },
    breed: { from: 21, ramp: 24, cap: .3 },
    close: { from: 41, ramp: 40, cap: .35 },
  },
  expert: {
    related: { from: 5, ramp: 10, cap: .3 },
    breed: { from: 13, ramp: 16, cap: .35 },
    close: { from: 25, ramp: 30, cap: .45 },
  },
};

// Parts maximales dans la liste pondérée des leurres. Chaque catégorie arrive
// avec une seule place sur vingt ; un boss ne peut pas avancer son introduction.
export function visualConfusionBudget(n: number, tier: Tier): VisualConfusionBudget {
  const stages = CONFUSION_STAGES[tier];
  const portion = ({ from, ramp, cap }: ConfusionStage) => n < from
    ? 0 : Math.min(cap, .05 + (cap - .05) * (n - from) / ramp);
  return { related: portion(stages.related), breed: portion(stages.breed), close: portion(stages.close) };
}

export function lookalikeRatio(n: number, tier: Tier, slot: Slot): number {
  const cap = LOOKALIKE_CAP[tier];
  const budget = visualConfusionBudget(n, tier);
  const allowed = budget.related + budget.breed + budget.close;
  const requested = slot === "boss" ? cap : 0.1 + 0.5 * (1 - Math.exp(-n / 40));
  return Math.min(cap, allowed, requested);
}

export const maxModifiers = (slot: Slot, tier: Tier) => (slot === "boss" && tier === "expert" ? 2 : 1);

// Au-delà de ces vitesses, la lampe torche est interdite
export const SCROLL_FAST = 1.0;
export const SWARM_FAST = 0.45;
