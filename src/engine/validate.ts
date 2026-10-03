import { allowedModifiers, allowedRules, LOOKALIKE_THRESHOLD, maxModifiers, SCROLL_FAST, slotOf, SWARM_FAST, zoneOf } from "./curve";
import { GEN_VERSION } from "./types";
import type { GenContext, LevelSpec } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export const LIMITS = {
  grid: { min: 2, max: 8, maxEasy: 7, maxEasyLevel1: 3 },
  sprite: { min: 44, max: 96, minEasyGrid: 52 },
  scroll: { speedMin: 0.4, speedMax: 1.6, speedMaxEasy: 1.0, extraLinesMax: 3 },
  pile: { countMin: 30, countMax: 160, jitterMin: 2, jitterMax: 6, wantedBelowFrom: 20, backgroundGridFrom: 100 },
  swarm: { countMin: 20, countMax: 60, speedMin: 0.2, speedMax: 0.6, speedMaxEasy: 0.35 },
  goldRushDurationS: 8,
} as const;

export function validateSpec(spec: LevelSpec, ctx: GenContext): ValidationResult {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const inRange = (name: string, v: number | undefined, min: number, max: number, int = false) => {
    if (v === undefined || !Number.isFinite(v)) return err(`${name} manquant`);
    if (v < min || v > max) err(`${name}=${v} hors [${min}, ${max}]`);
    if (int && !Number.isInteger(v)) err(`${name}=${v} non entier`);
  };
  const easy = ctx.tier === "easy";
  const p = spec.params;

  if (spec.genVersion !== GEN_VERSION) err("genVersion incorrecte");
  if (!Number.isInteger(spec.index) || spec.index < 1) err("index invalide");
  if (spec.zone !== zoneOf(spec.index)) err("zone incohérente");
  if (spec.slot !== slotOf(spec.index)) err("slot incohérent");

  // Plafonds et planchers
  const L = LIMITS;
  switch (spec.layout) {
    case "grid": {
      const max = easy ? (spec.index === 1 ? L.grid.maxEasyLevel1 : L.grid.maxEasy) : L.grid.max;
      inRange("gridSize", p.gridSize, L.grid.min, max, true);
      inRange("spriteSize", spec.spriteSize, easy ? L.sprite.minEasyGrid : L.sprite.min, L.sprite.max);
      break;
    }
    case "scroll":
      inRange("speed", p.speed, L.scroll.speedMin, easy ? L.scroll.speedMaxEasy : L.scroll.speedMax);
      inRange("extraLines", p.extraLines, 0, L.scroll.extraLinesMax, true);
      if (p.scrollDirection !== "horizontal" && p.scrollDirection !== "vertical") err("scrollDirection manquante");
      break;
    case "pile":
      inRange("count", p.count, L.pile.countMin, L.pile.countMax, true);
      inRange("jitter", p.jitter, L.pile.jitterMin, L.pile.jitterMax);
      if (p.wantedBelow && (easy || spec.index < L.pile.wantedBelowFrom)) err("wantedBelow interdit ici");
      if (p.backgroundGrid && (p.count ?? 0) < L.pile.backgroundGridFrom) err("backgroundGrid avec count < 100");
      break;
    case "swarm":
      inRange("count", p.count, L.swarm.countMin, L.swarm.countMax, true);
      inRange("speed", p.speed, L.swarm.speedMin, easy ? L.swarm.speedMaxEasy : L.swarm.speedMax);
      if (p.edgeBehavior !== "bounce" && p.edgeBehavior !== "wrap") err("edgeBehavior manquant");
      break;
    default:
      err(`layout inconnu ${String(spec.layout)}`);
  }
  if (spec.layout !== "grid") inRange("spriteSize", spec.spriteSize, L.sprite.min, L.sprite.max);

  // Recherché et leurres
  const names = new Set(ctx.pool.map((c) => c.name));
  if (!spec.wanted || !names.has(spec.wanted.name)) err("recherché absent du pool");
  if (spec.decoys.length < 1) err("aucun leurre");
  if (spec.decoys.some((d) => !names.has(d.name))) err("leurre hors du pool");
  if (spec.rule === "oddOneOut") {
    if (spec.decoys.some((d) => d.name !== spec.wanted.name)) err("oddOneOut : tous les leurres doivent être le recherché");
  } else if (spec.decoys.some((d) => d.name === spec.wanted.name)) {
    err("le recherché figure parmi les leurres");
  }

  // Règle, modificateurs, compatibilités
  if (!allowedRules(ctx).has(spec.rule)) err(`règle ${spec.rule} non autorisée`);
  const mods = allowedModifiers(ctx);
  for (const m of spec.modifiers) if (!mods.has(m)) err(`modificateur ${m} non autorisé`);
  if (new Set(spec.modifiers).size !== spec.modifiers.length) err("modificateur en double");
  if (spec.modifiers.length > maxModifiers(spec.slot, ctx.tier)) err("trop de modificateurs");
  if (spec.rule === "oddOneOut" && spec.layout !== "grid" && spec.layout !== "pile") err("oddOneOut hors grid/pile");
  if (spec.modifiers.includes("flashlight")) {
    if (spec.layout === "scroll" && (p.speed ?? 0) > SCROLL_FAST) err("flashlight en scroll rapide");
    if (spec.layout === "swarm" && (p.speed ?? 0) > SWARM_FAST) err("flashlight en swarm rapide");
  }
  if (spec.lookalikeRatio !== undefined) {
    if (spec.lookalikeRatio < 0 || spec.lookalikeRatio > 1) err("lookalikeRatio hors [0, 1]");
    if (spec.modifiers.includes("lookalikes") !== spec.lookalikeRatio >= LOOKALIKE_THRESHOLD)
      err("lookalikes incohérent avec lookalikeRatio");
  }

  // Temps et quantités
  const expectedFind = spec.rule === "findAll" ? (easy ? 2 : 3) : 1;
  if (spec.findCount !== expectedFind) err(`findCount=${spec.findCount}, attendu ${expectedFind}`);
  if (spec.rule === "goldRush" && spec.durationS !== L.goldRushDurationS) err("durationS goldRush ≠ 8");
  if (!(spec.rewardS > 0)) err("rewardS invalide");
  if (!(spec.penaltyS > 0)) err("penaltyS invalide");

  return { ok: errors.length === 0, errors };
}
