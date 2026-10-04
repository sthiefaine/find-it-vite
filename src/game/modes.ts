// Modes de partie (Infini, Défi du jour, Aventure) : logique pure, sans React.
import { hash32 } from "../engine/rng";
import { wantedAt } from "../engine/generateLevel";
import type { GameMode } from "../engine/types";
import type { CharacterDetails } from "../helpers/characters";
import { getWorld, LEVELS_PER_WORLD } from "../content/worlds";
import type { WorldId } from "../content/worlds";

export type { GameMode };

export const MISSION_GOAL = 5; // avis à trouver dans une étape d'Aventure
export const MAX_PLAY_TIME_S = 60; // chrono de départ et plafond, dans tous les modes

export type ModeParams =
  | { mode: "endless" }
  | { mode: "daily" }
  | { mode: "adventure"; worldId: WorldId; level: number };

// /game, /game?mode=daily, /game?mode=adventure&world=ocean&level=3
export function readModeParams(search: string): ModeParams {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  if (mode === "daily") return { mode: "daily" };
  if (mode === "adventure") {
    const world = getWorld(params.get("world") ?? "");
    const rawLevel = params.get("level");
    const level = rawLevel && /^\d+$/.test(rawLevel) ? Number(rawLevel) : 1;
    if (world) return { mode: "adventure", worldId: world.id, level: clampLevel(level) };
  }
  return { mode: "endless" };
}

const clampLevel = (level: number) => Math.min(LEVELS_PER_WORLD, Math.max(1, Math.floor(level)));

// Graine d'une mission : toujours la même pour un monde et un niveau
export function missionSeed(worldId: string, level: number): number {
  return hash32("adv", worldId, level);
}

// Sous-graine de l'avis n° step (1 à 5) : 5 foules différentes, même difficulté
export function subLevelSeed(seed: number, step: number): number {
  return hash32(seed, step - 1);
}

// Essais par avis pour trouver un recherché encore jamais vu dans la mission
const SUB_SEED_TRIES = 24;
const SUB_SEED_STRIDE = 100;

// Sous-graines des avis 1 à `count` : déterministes, et le recherché de chaque avis
// diffère du précédent, et si possible de tous ceux déjà vus dans la mission.
// Essai j de l'avis k : hash32(seed, k - 1 + 100·j) (j = 0 : subLevelSeed).
// Le recherché ne dépend que de la graine, de l'index et du pool (pas du tier).
export function missionSubSeeds(
  seed: number,
  index: number,
  pool: CharacterDetails[],
  count: number = MISSION_GOAL
): number[] {
  const seeds: number[] = [];
  const used = new Set<string>();
  let previous: string | null = null;
  for (let step = 1; step <= count; step++) {
    let fallback: { seed: number; name: string } | null = null;
    let chosen: { seed: number; name: string } | null = null;
    for (let j = 0; j < SUB_SEED_TRIES && !chosen; j++) {
      const candidate = hash32(seed, step - 1 + SUB_SEED_STRIDE * j);
      const name = wantedAt(index, { seed: candidate, tier: "normal", pool }).name;
      if (!used.has(name)) chosen = { seed: candidate, name };
      else if (!fallback && name !== previous) fallback = { seed: candidate, name };
    }
    const pick: { seed: number; name: string } = chosen ?? fallback ?? { seed: subLevelSeed(seed, step), name: previous ?? "" };
    seeds.push(pick.seed);
    used.add(pick.name);
    previous = pick.name;
  }
  return seeds;
}

// Index moteur du niveau L d'un monde
export function missionEngineIndex(startIndex: number, level: number): number {
  return startIndex + level - 1;
}

// Niveau moteur à générer pour l'étape `level` de la partie
export function levelTarget(
  mode: GameMode,
  runSeed: number,
  level: number,
  startIndex = 1,
  adventureLevel = 1,
  pool?: CharacterDetails[]
): { index: number; seed: number } {
  if (mode === "adventure") {
    const index = missionEngineIndex(startIndex, adventureLevel);
    // avec le pool, chaque avis a un recherché différent
    const seed = pool
      ? missionSubSeeds(runSeed, index, pool, Math.max(1, level))[Math.max(1, level) - 1]
      : subLevelSeed(runSeed, level);
    return { index, seed };
  }
  return { index: level, seed: runSeed };
}

// Un avis de plus (goldRush compris) : la mission est-elle finie ?
export function advanceMission(found: number, goal = MISSION_GOAL): { found: number; done: boolean } {
  const next = Math.min(goal, found + 1);
  return { found: next, done: next >= goal };
}

// Chrono après un bonus ou une pénalité : plafond de 60 s partout
export function nextTime(_mode: GameMode, current: number, delta: number): number {
  const t = current + delta;
  if (t <= 0) return 0;
  return Math.min(MAX_PLAY_TIME_S, t);
}

export function adventureUrl(worldId: string, level: number): string {
  return `/game?mode=adventure&world=${worldId}&level=${level}`;
}

// « Find It – Défi du 03/10 : 23 trouvés ! »
export function dailyShareText(dateISO: string, score: number): string {
  const [, month, day] = dateISO.split("-");
  const found = score > 1 ? `${score} trouvés` : `${score} trouvé`;
  return `Find It – Défi du ${day}/${month} : ${found} !`;
}
