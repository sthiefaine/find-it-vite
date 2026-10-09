import { allCharacters } from "./worlds";
import { isAnimalUnlocked, STARTER_ANIMAL_IDS, type AnimalUnlockSave } from "./unlockedAnimals";
import { isPerson, isPersonUnlocked, PERSON_PRICE, type PersonUnlockSave } from "./personUnlocks";

export const PORTRAIT_PRICE = PERSON_PRICE;
const animalIds = new Set(allCharacters().map(character => character.name));
const starters = new Set<string>(STARTER_ANIMAL_IDS);
export type PortraitUnlockSave = AnimalUnlockSave & PersonUnlockSave;
export const isPurchasablePortrait = (id: string) => isPerson(id) || animalIds.has(id);
export const isPortraitUnlocked = (save: PortraitUnlockSave, id: string) =>
  isPerson(id) ? isPersonUnlocked(save, id) : animalIds.has(id) && isAnimalUnlocked(save, id);
export const validPurchasedAnimals = (ids: unknown): string[] => Array.isArray(ids)
  ? [...new Set(ids.filter((id): id is string => typeof id === "string" && animalIds.has(id) && !starters.has(id)))] : [];
