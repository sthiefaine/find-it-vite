// Calculs d'affichage de la carte Aventure (sans React)
import type { Save } from "../../save/schema";
import { isLevelUnlocked, starsFor, totalStars } from "../../content/progress";
import { LEVELS_PER_WORLD, WORLDS } from "../../content/worlds";
import type { World } from "../../content/worlds";

type MapSave = Pick<Save, "adventure">;

export type LevelRef = { worldId: string; level: number };

// Niveau à mettre en avant : le premier débloqué sans étoile,
// sinon le dernier débloqué (tout est fini : on rejoue le dernier)
export function nextLevel(save: MapSave, worlds: World[] = WORLDS): LevelRef | null {
  let last: LevelRef | null = null;
  for (const w of worlds) {
    for (let level = 1; level <= LEVELS_PER_WORLD; level++) {
      if (!isLevelUnlocked(save, w.id, level)) continue;
      if (starsFor(save, w.id, level) === 0) return { worldId: w.id, level };
      last = { worldId: w.id, level };
    }
  }
  return last;
}

export function starsMissing(save: MapSave, world: World): number {
  return Math.max(0, world.unlockStars - totalStars(save));
}

export function worldStars(save: MapSave, world: World): number {
  let sum = 0;
  for (let level = 1; level <= LEVELS_PER_WORLD; level++) sum += starsFor(save, world.id, level);
  return sum;
}

// Position horizontale (en %) du rond n°level : un chemin qui serpente
export function nodeX(level: number): number {
  return Math.round(50 + 30 * Math.sin(((level - 1) * Math.PI) / 3));
}

export function levelUrl(worldId: string, level: number): string {
  return `/game?mode=adventure&world=${worldId}&level=${level}`;
}
