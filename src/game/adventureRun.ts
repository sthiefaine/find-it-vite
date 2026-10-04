// Aventure en partie continue : les étapes (5 avis) s'enchaînent sans écran
// intermédiaire, d'un monde à l'autre, puis dans le Grand Mélange. Logique pure.
import { allCharacters, LEVELS_PER_WORLD, WORLDS } from "../content/worlds";
import type { World, WorldId } from "../content/worlds";
import type { CharacterDetails } from "../helpers/characters";
import { isLevelUnlocked } from "../content/progress";
import type { Save } from "../save/schema";
import { MISSION_GOAL, missionEngineIndex, missionSeed, missionSubSeeds } from "./modes";

export const STEP_GOAL = MISSION_GOAL; // avis par étape
// Étoiles d'une étape selon le temps de jeu réel de ses 5 avis (hors chargements,
// pauses et bandeaux). Mesuré au bot qui touche dès que la cible est visible :
// 1 à 2,6 s par étape (étapes 1 à 50), donc presque tout est du temps de recherche.
// Chaque avis rend ~4 s de chrono (20 s par étape) : 3★ ≈ le chrono tient
// (5 s par avis), 2★ ≈ 8 s par avis, 1★ au-delà.
export const STEP_STAR_3_MS = 25_000;
export const STEP_STAR_2_MS = 40_000;
export const STEP_TOAST_MS = 1500;
export const WORLD_BANNER_MS = 2000;

// Nombre d'étapes des mondes ; au-delà, le Grand Mélange continue sans fin
export const WORLD_STEPS = WORLDS.length * LEVELS_PER_WORLD;

export const MIX_PHASE = "melange" as const;
export type PhaseId = WorldId | typeof MIX_PHASE;

export type StepInfo = {
  step: number; // étape globale (1 = animaux 1, 11 = océan 1, 51 = Grand Mélange)
  phase: PhaseId;
  worldId: WorldId | null; // null dans le Grand Mélange
  level: number; // étape dans le monde (1 à 10), ou étape globale dans le Mélange
  index: number; // index moteur : la difficulté monte d'une étape à l'autre
  name: string;
  emoji: string;
  background: string;
  accent: string;
};

const MIX = {
  name: "Grand Mélange",
  emoji: "🌈",
  background: "linear-gradient(160deg, #ff9ad5 0%, #a98bff 50%, #4fc3f7 100%)",
  accent: "#ff4fa3",
};

// « Bienvenue dans l'Océan ! 🌊 »
const WELCOME: Record<PhaseId, string> = {
  animaux: "Bienvenue chez les Animaux ! 🦁",
  ocean: "Bienvenue dans l'Océan ! 🌊",
  dinos: "Bienvenue chez les Dinosaures ! 🦖",
  halloween: "Bienvenue à Halloween ! 🎃",
  espace: "Bienvenue dans l'Espace ! 🚀",
  [MIX_PHASE]: "Bienvenue dans le Grand Mélange ! 🌈",
};

export function welcomeText(phase: PhaseId): string {
  return WELCOME[phase];
}

export function globalStep(worldId: string, level: number): number {
  const i = WORLDS.findIndex((w) => w.id === worldId);
  return Math.max(0, i) * LEVELS_PER_WORLD + Math.min(LEVELS_PER_WORLD, Math.max(1, Math.floor(level)));
}

export function stepInfo(step: number): StepInfo {
  const g = Math.max(1, Math.floor(step));
  if (g > WORLD_STEPS) {
    // après l'Espace : tous les persos, et l'index moteur continue de monter
    return { step: g, phase: MIX_PHASE, worldId: null, level: g, index: g, ...MIX };
  }
  const world: World = WORLDS[Math.floor((g - 1) / LEVELS_PER_WORLD)];
  const level = ((g - 1) % LEVELS_PER_WORLD) + 1;
  return {
    step: g,
    phase: world.id,
    worldId: world.id,
    level,
    index: missionEngineIndex(world.startIndex, level),
    name: world.name,
    emoji: world.emoji,
    background: world.background,
    accent: world.accent,
  };
}

let mixPool: CharacterDetails[] | null = null;
export function poolOfStep(step: number): CharacterDetails[] {
  const info = stepInfo(step);
  if (info.worldId) return WORLDS.find((w) => w.id === info.worldId)!.characters;
  mixPool ??= allCharacters();
  return mixPool;
}

// Niveau moteur de l'avis n° avis (1 à 5) de l'étape : même index, graine différente,
// et jamais deux fois le même recherché dans une étape
export function stepTarget(step: number, avis: number, pool: CharacterDetails[] = poolOfStep(step)) {
  const info = stepInfo(step);
  const seed = missionSeed(info.phase, info.level);
  const k = Math.min(STEP_GOAL, Math.max(1, Math.floor(avis)));
  return { index: info.index, seed: missionSubSeeds(seed, info.index, pool, k)[k - 1] };
}

// 3★ ≤ 25 s, 2★ ≤ 40 s, 1★ au-delà (temps réel de jeu de l'étape)
export function stepStars(playMs: number): 1 | 2 | 3 {
  if (playMs <= STEP_STAR_3_MS) return 3;
  if (playMs <= STEP_STAR_2_MS) return 2;
  return 1;
}

// Passer de `step` à l'étape suivante fait-il changer de monde ?
export function entersNewPhase(step: number): boolean {
  return stepInfo(step).phase !== stepInfo(step + 1).phase;
}

// Étape la plus avancée atteinte (débloquée) : pour « Continuer l'aventure »
export function furthestStep(save: Pick<Save, "adventure">): { worldId: WorldId; level: number } {
  let best: { worldId: WorldId; level: number } = { worldId: WORLDS[0].id, level: 1 };
  for (const w of WORLDS)
    for (let level = 1; level <= LEVELS_PER_WORLD; level++)
      if (isLevelUnlocked(save, w.id, level)) best = { worldId: w.id, level };
  return best;
}

export type StepResult = { step: number; worldId: WorldId | null; level: number; stars: number };

// Bilan de la partie pour l'écran de fin
export function runSummary(steps: readonly StepResult[]): { cleared: number; stars: number } {
  return { cleared: steps.length, stars: steps.reduce((sum, s) => sum + s.stars, 0) };
}
