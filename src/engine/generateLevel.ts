// Génération d'un niveau : fonction pure de (index, contexte).
import type { CharacterDetails } from "../helpers/characters";
import {
  allowedModifiers,
  allowedRules,
  budgetFor,
  difficultyOf,
  FLASHLIGHT_INTRO,
  introAt,
  isGoldRushSlot,
  layoutFor,
  LOOKALIKE_THRESHOLD,
  lookalikeRatio,
  maxModifiers,
  mechanicWeight,
  RULE_INTRO,
  SCROLL_FAST,
  slotOf,
  SWARM_FAST,
  zoneOf,
} from "./curve";
import { createRng, hash32, weightedPick } from "./rng";
import type { Rng } from "./rng";
import { GEN_VERSION, SPRITE_SIZE } from "./types";
import type { GenContext, Layout, LayoutParams, LevelSpec, Modifier, Rule, Slot, Tier } from "./types";
import { LIMITS, validateSpec } from "./validate";
import { animalConfusionRisk, selectAnimalDecoys } from "./animalSimilarity";

export const MIN_POOL_SIZE = 3;
const MAX_ATTEMPTS = 8;
const DECOY_SLOTS = 20; // longueur de la liste pondérée de leurres
const SUB_THRESHOLD_RHO = 0.35; // ρ utilisé quand lookalikes doit rester absent

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

export const levelSeedOf = (index: number, ctx: GenContext) => hash32(GEN_VERSION, ctx.seed, index);

// ─── Recherché : sac mélangé par bloc de |pool| niveaux ───
function rawBag(block: number, ctx: GenContext): CharacterDetails[] {
  return createRng(hash32(GEN_VERSION, ctx.seed, "bag", block)).shuffle(ctx.pool);
}

export function wantedAt(index: number, ctx: GenContext): CharacterDetails {
  const pool = ctx.pool;
  const P = pool.length;
  if (P < MIN_POOL_SIZE) throw new Error(`generateLevel : il faut au moins ${MIN_POOL_SIZE} persos dans le pool`);
  if (ctx.wantedId !== undefined) {
    const wanted = pool.find(character => character.name === ctx.wantedId);
    if (!wanted) throw new Error(`Cible absente du pool : ${ctx.wantedId}`);
    return wanted;
  }
  if (P < 6) {
    // petit pool : un ordre fixe parcouru en boucle (distinct des 2 précédents car P ≥ 3)
    const order = createRng(hash32(GEN_VERSION, ctx.seed, "order")).shuffle(pool);
    return order[(index - 1) % P];
  }
  const block = Math.floor((index - 1) / P);
  const bag = rawBag(block, ctx);
  if (block > 0) {
    // Les 2 dernières places d'un sac ne sont jamais retouchées : on peut les recalculer
    const prev = rawBag(block - 1, ctx);
    const last2 = new Set([prev[P - 1].name, prev[P - 2].name]);
    for (let i = 0; i < 2; i++) {
      if (!last2.has(bag[i].name)) continue;
      for (let j = 2; j <= P - 3; j++) {
        if (!last2.has(bag[j].name)) {
          [bag[i], bag[j]] = [bag[j], bag[i]];
          break;
        }
      }
    }
  }
  return bag[(index - 1) % P];
}

// ─── Leurres ───
function buildDecoys(
  wanted: CharacterDetails, rho: number, pool: CharacterDetails[], rng: Rng, index: number, tier: Tier,
): CharacterDetails[] {
  return selectAnimalDecoys(wanted, rho, pool, rng, { index, tier }, DECOY_SLOTS);
}

// ─── Règle ───
function pickRule(n: number, ctx: GenContext, slot: Slot, layout: Layout, rng: Rng): Rule {
  const intro = introAt(n, ctx);
  if (intro) return intro.kind === "rule" ? intro.rule : "classic";
  const rules = allowedRules(ctx);
  if (isGoldRushSlot(n) && rules.has("goldRush")) return "goldRush";
  const factor = slot === "breather" ? 0.5 : slot === "boss" ? 1.2 : 1;
  const items: [Rule, number][] = [["classic", 1.5]];
  for (const [r, at] of Object.entries(RULE_INTRO) as [Rule, number][]) {
    if (!rules.has(r)) continue;
    if (r === "oddOneOut" && layout !== "grid" && layout !== "pile") continue;
    items.push([r, mechanicWeight(n, at + 1) * factor]);
  }
  return weightedPick(rng, items) ?? "classic";
}

// ─── Paramètres de disposition ───
// La taille des têtes est fixe (SPRITE_SIZE) : la difficulté joue sur le nombre, les sosies, la vitesse…
function buildParams(
  layout: Layout,
  n: number,
  tier: Tier,
  d: number,
  flashlight: boolean,
  rng: Rng,
): LayoutParams {
  const easy = tier === "easy";
  const L = LIMITS;
  switch (layout) {
    case "grid": {
      const max = easy ? (n === 1 ? L.grid.maxEasyLevel1 : L.grid.maxEasy) : L.grid.max;
      const gridSize = clamp(Math.round(2.6 + 6 * d), L.grid.min, max);
      return { gridSize };
    }
    case "scroll": {
      let speed = clamp(round2(0.4 + 1.2 * d), L.scroll.speedMin, easy ? L.scroll.speedMaxEasy : L.scroll.speedMax);
      if (flashlight) speed = Math.min(speed, SCROLL_FAST);
      return {
        speed,
        extraLines: clamp(Math.floor(d * 4), 0, L.scroll.extraLinesMax),
        scrollDirection: rng.chance(0.5) ? "horizontal" : "vertical",
        alternateDirection: rng.chance(0.3 + 0.4 * d),
      };
    }
    case "pile": {
      const count = clamp(Math.round(30 + 130 * d), L.pile.countMin, L.pile.countMax);
      return {
        count,
        jitter: clamp(Math.round((2 + 4 * d) * 10) / 10, L.pile.jitterMin, L.pile.jitterMax),
        wantedBelow: !easy && n >= L.pile.wantedBelowFrom && rng.chance(0.25 + 0.35 * d),
        backgroundGrid: count >= L.pile.backgroundGridFrom,
      };
    }
    case "swarm": {
      let speed = clamp(round2(0.2 + 0.4 * d), L.swarm.speedMin, easy ? L.swarm.speedMaxEasy : L.swarm.speedMax);
      if (flashlight) speed = Math.min(speed, SWARM_FAST);
      return {
        count: clamp(Math.round(20 + 40 * d), L.swarm.countMin, L.swarm.countMax),
        speed,
        edgeBehavior: rng.chance(0.5) ? "bounce" : "wrap",
      };
    }
  }
}

// ─── Temps ───
const BASE_REWARD: Record<Slot, number> = { intro: 4, normal: 4, breather: 3, boss: 6 };
const PENALTY: Record<Tier, number> = { easy: 2, normal: 3, expert: 5 };
export const rewardFor = (slot: Slot, tier: Tier) =>
  tier === "easy" ? Math.round(BASE_REWARD[slot] * 1.15) : BASE_REWARD[slot];

function buildLevel(index: number, ctx: GenContext, seed: number, rng: Rng): LevelSpec {
  const tier = ctx.tier;
  const slot = slotOf(index);
  const intro = introAt(index, ctx);
  const layout = layoutFor(index, ctx);
  const rule = pickRule(index, ctx, slot, layout, rng.fork("rule"));
  const wanted = wantedAt(index, ctx);
  const mods = allowedModifiers(ctx);

  // Modificateurs
  let rho = round2(lookalikeRatio(index, tier, slot));
  if (intro || rule === "goldRush" || !mods.has("lookalikes")) rho = 0;
  let flashlight = false;
  if (mods.has("flashlight")) {
    if (intro?.kind === "modifier" && intro.modifier === "flashlight") flashlight = true;
    else if (!intro && rule !== "goldRush" && slot !== "breather" && index > FLASHLIGHT_INTRO)
      flashlight = rng.fork("flashlight").chance(mechanicWeight(index, FLASHLIGHT_INTRO + 1) * (slot === "boss" ? 0.4 : 0.25));
  }
  if (flashlight && rho >= LOOKALIKE_THRESHOLD && maxModifiers(slot, tier) < 2) rho = SUB_THRESHOLD_RHO;
  const modifiers: Modifier[] = [];
  if (flashlight) modifiers.push("flashlight");
  if (rho >= LOOKALIKE_THRESHOLD) modifiers.push("lookalikes");

  // Difficulté
  const budget = budgetFor(index, tier, intro !== null);
  const pr = rng.fork("params");
  let d = difficultyOf(budget) * (0.92 + 0.16 * pr.next());
  if (flashlight) d *= 0.85;
  const hasLookalike = ctx.pool.some((c) => c.name !== wanted.name && animalConfusionRisk(wanted, c) > 0);
  if (!hasLookalike) d *= 1 + 0.3 * rho; // pas de sosie possible : plus de monde à la place
  d = clamp(d, 0, 1);
  const params = buildParams(layout, index, tier, d, flashlight, pr);
  // goldRush en grille : 10 dorés à placer, il faut au moins 4×4 cases (même en easy)
  if (rule === "goldRush" && layout === "grid" && (params.gridSize ?? 0) < LIMITS.grid.minGoldRush) {
    params.gridSize = LIMITS.grid.minGoldRush;
  }

  const decoys = rule === "oddOneOut" ? [wanted] : buildDecoys(wanted, rho, ctx.pool, rng.fork("decoys"), index, tier);

  const spec: LevelSpec = {
    genVersion: GEN_VERSION,
    seed,
    index,
    zone: zoneOf(index),
    slot,
    layout,
    rule,
    modifiers,
    wanted,
    decoys,
    params,
    spriteSize: SPRITE_SIZE,
    findCount: rule === "findAll" ? (tier === "easy" ? 2 : 3) : 1,
    rewardS: rewardFor(slot, tier),
    penaltyS: PENALTY[tier],
    lookalikeRatio: round2(rho),
    budget: round2(budget),
  };
  if (rule === "goldRush") spec.durationS = LIMITS.goldRushDurationS;
  return spec;
}

// Grille de secours : la plus simple possible
function fallbackLevel(index: number, ctx: GenContext, seed: number): LevelSpec {
  const wanted = wantedAt(index, ctx);
  const slot = slotOf(index);
  const gridSize = 3;
  return {
    genVersion: GEN_VERSION,
    seed,
    index,
    zone: zoneOf(index),
    slot,
    layout: "grid",
    rule: "classic",
    modifiers: [],
    wanted,
    decoys: buildDecoys(wanted, 0, ctx.pool, createRng(hash32(seed, "fallback-decoys")), index, ctx.tier),
    params: { gridSize },
    spriteSize: SPRITE_SIZE,
    findCount: 1,
    rewardS: rewardFor(slot, ctx.tier),
    penaltyS: PENALTY[ctx.tier],
    lookalikeRatio: 0,
  };
}

export function generateLevel(index: number, ctx: GenContext): LevelSpec {
  if (!Number.isInteger(index) || index < 1) throw new Error(`generateLevel : index invalide ${index}`);
  const seed = levelSeedOf(index, ctx);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng(attempt === 0 ? seed : hash32(seed, "retry", attempt));
    const spec = buildLevel(index, ctx, seed, rng);
    if (validateSpec(spec, ctx).ok) return spec;
  }
  return fallbackLevel(index, ctx, seed);
}

export function describeLevel(spec: LevelSpec): string {
  const p = spec.params;
  const parts: string[] = [];
  if (p.gridSize !== undefined) parts.push(`${p.gridSize}×${p.gridSize}`);
  if (p.count !== undefined) parts.push(`n=${p.count}`);
  if (p.speed !== undefined) parts.push(`v=${p.speed}`);
  if (p.extraLines) parts.push(`+${p.extraLines}l`);
  if (p.jitter !== undefined) parts.push(`j=${p.jitter}`);
  if (p.wantedBelow) parts.push("dessous");
  if (p.backgroundGrid) parts.push("fond");
  if (p.scrollDirection) parts.push(p.scrollDirection[0] + (p.alternateDirection ? "~" : ""));
  if (p.edgeBehavior) parts.push(p.edgeBehavior);
  const mods = spec.modifiers.length ? ` +${spec.modifiers.join("+")}` : "";
  const find = spec.findCount > 1 ? ` ×${spec.findCount}` : "";
  const dur = spec.durationS ? ` ${spec.durationS}s` : "";
  return (
    `#${spec.index} Z${spec.zone} ${spec.slot} | ${spec.layout}/${spec.rule}${find}${mods} | ` +
    `${spec.wanted.name} ρ=${spec.lookalikeRatio ?? "?"} | ${parts.join(" ")} | ${spec.spriteSize}px | ` +
    `+${spec.rewardS}s/-${spec.penaltyS}s${dur}`
  );
}
