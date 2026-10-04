import type { AnimalUnlockSave } from "../content/unlockedAnimals";
import { playThemePool } from "../content/playThemes";
import type { PlayThemeId } from "../content/playThemes";
import { getWorld } from "../content/worlds";
import { charactersDetails } from "../helpers/characters";
import type { CharacterDetails } from "../helpers/characters";
import { poolOfStep } from "./adventureRun";
import type { GameMode } from "./modes";

// La cible et tous les figurants viennent du même catalogue autorisé. Le thème
// sélectionné ne peut jamais ajouter un animal verrouillé à l'Infini.
export function characterPoolFor(mode: GameMode, step: number, save: AnimalUnlockSave, theme: PlayThemeId = "animaux"): CharacterDetails[] {
  if (mode === "adventure") return poolOfStep(step);
  if (mode === "daily") return getWorld("animaux")?.characters ?? charactersDetails;
  return playThemePool("endless", theme, save);
}
