import { animalsPack } from "../helpers/characters";
import type { CharacterDetails } from "../helpers/characters";

export const STARTER_ANIMAL_IDS = ["chat", "chien", "mouton", "vache", "cochon"] as const;
const STARTERS = new Set<string>(STARTER_ANIMAL_IDS);

// La collection suffit : les anciennes sauvegardes bénéficient immédiatement
// des cinq portraits de départ, sans ajouter de fausses captures à l'album.
export type AnimalUnlockSave = { collection?: Readonly<Record<string, number>>; purchasedAnimals?: readonly string[]; campaign?: { grantedPortraits?: readonly string[] } };

export function isAnimalUnlocked(save: AnimalUnlockSave, animalId: string): boolean {
  return STARTERS.has(animalId) || (save.collection?.[animalId] ?? 0) > 0 || !!save.purchasedAnimals?.includes(animalId) || !!save.campaign?.grantedPortraits?.includes(animalId);
}

export function unlockedAnimals(
  save: AnimalUnlockSave, pool: readonly CharacterDetails[] = animalsPack,
): CharacterDetails[] {
  // L'ordre du catalogue reste stable pour les parties déterministes. Un ancien
  // identifiant retiré du catalogue ne peut pas recréer un portrait inexistant.
  return pool.filter((animal) => isAnimalUnlocked(save, animal.name));
}
