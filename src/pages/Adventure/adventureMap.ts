// Calculs d'affichage de la carte Aventure (sans React)
import type { Save } from "../../save/schema";
import { starsFor } from "../../content/progress";
import { LEVELS_PER_WORLD, WORLDS } from "../../content/worlds";
import type { World } from "../../content/worlds";
import { adventureUrl } from "../../game/modes";
import { furthestStep } from "../../game/adventureRun";

type MapSave = Pick<Save, "adventure">;

export type LevelRef = { worldId: string; level: number };

// Étape mise en avant et lancée par « Continuer l'aventure » : la plus avancée atteinte
export function nextLevel(save: MapSave): LevelRef {
  return furthestStep(save);
}

// Monde fermé : ce qu'il faut faire pour l'ouvrir
export function unlockHint(world: World): string {
  const i = WORLDS.findIndex((w) => w.id === world.id);
  const prev = i > 0 ? WORLDS[i - 1] : undefined;
  return prev ? `Finis ${prev.emoji} ${prev.name} ${LEVELS_PER_WORLD}` : "";
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

// Partie continue à partir de cette étape
export function levelUrl(worldId: string, level: number): string {
  return adventureUrl(worldId, level);
}
