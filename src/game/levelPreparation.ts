import type { GameMode, LevelSpec, Tier } from "../engine/types";
import type { CharacterUnlockSave } from "../content/playThemes";
import { playThemeFromSearch } from "../content/playThemes";
import { characterPoolFor } from "./characterPool";
import { stepTarget } from "./adventureRun";
import { levelTarget, MISSION_GOAL } from "./modes";
import { generatePlayableLevel } from "./playableLevel";
import { readAccessoryPreview, withAccessoryPreview } from "./accessories";
import { readVariantPreview } from "./crowdVariants";
import { generateChapterLevel } from "./chapterRun";

export const LEVEL_COUNTDOWN_MS = 3000;

// Même échéance pour le petit compteur dans l'avis et la barrière qui ouvre le
// plateau. WeakMap ne conserve aucun ancien niveau après la fin d'une partie.
const countdowns = new WeakMap<LevelSpec, number>();
export function beginLevelCountdown(spec: LevelSpec, now: number): number {
  const until = now + LEVEL_COUNTDOWN_MS;
  countdowns.set(spec, until);
  return until;
}
export function levelCountdownUntil(spec: LevelSpec): number | undefined {
  return countdowns.get(spec);
}

export type RunLevelPosition = {
  runSeed: number;
  tier: Tier;
  level: number;
  mode: GameMode;
  adventureStep: number;
  missionFound: number;
  chapterId?: string | null;
};

// Projection seulement : aucun score, déblocage ou changement de niveau avant
// que le joueur ait réellement trouvé l'animal courant.
export function nextRunLevel(position: RunLevelPosition): RunLevelPosition {
  const missionFound = position.missionFound + 1;
  const nextStep = position.mode === "adventure" && missionFound >= MISSION_GOAL;
  return {
    ...position,
    level: position.level + 1,
    adventureStep: position.adventureStep + (nextStep ? 1 : 0),
    missionFound: position.mode === "adventure" ? (nextStep ? 0 : missionFound) : position.missionFound,
  };
}

// Préchargement et montage empruntent exactement le même chemin de génération,
// notamment pour les graines d'avis et le pool lors d'un changement de monde.
export function generateRunLevel(position: RunLevelPosition, save: CharacterUnlockSave, search: string, development: boolean) {
  const { mode, adventureStep, missionFound, runSeed, level, tier } = position;
  if (mode === "adventure" && position.chapterId) return generateChapterLevel(position.chapterId, adventureStep, missionFound + 1, tier);
  const pool = characterPoolFor(mode, adventureStep, save, playThemeFromSearch(search));
  const target = mode === "adventure" ? stepTarget(adventureStep, missionFound + 1, pool) : levelTarget(mode, runSeed, level);
  // Les variantes de foule suivent les avis de la partie (jamais trois fois la même de suite).
  const spec = generatePlayableLevel(target.index, { seed: target.seed, tier, pool }, {
    variantStream: { seed: runSeed, position: level },
    forceVariant: readVariantPreview(search, development),
  });
  return withAccessoryPreview(spec, readAccessoryPreview(search, development));
}

export function countdownAt(until: number, now: number): number {
  return Math.min(3, Math.max(0, Math.ceil((until - now) / 1000)));
}
