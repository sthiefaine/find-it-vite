import { celebritiesPack, historyPack, peoplePack } from "../helpers/characters";
import type { CharacterDetails } from "../helpers/characters";

export const PERSON_PRICE = 100;
export const STARTER_POLITICAL_IDS = [
  "emmanuel-macron", "nicolas-sarkozy", "francois-hollande", "jacques-chirac",
  "francois-mitterrand", "charles-de-gaulle", "simone-veil", "christiane-taubira",
  "segolene-royal", "jean-luc-melenchon", "marine-le-pen", "jordan-bardella",
] as const;
export const STARTER_HISTORY_IDS = [
  "napoleon-bonaparte", "louis-xiv", "marie-curie", "albert-einstein",
  "frida-kahlo", "cleopatre", "jules-cesar", "jeanne-d-arc",
  "leonard-de-vinci", "wolfgang-amadeus-mozart", "nelson-mandela", "rosa-parks",
] as const;
export const STARTER_CELEBRITY_IDS = [
  "philippe-etchebest", "will-smith", "leonardo-dicaprio", "brad-pitt",
  "tom-cruise", "omar-sy", "jean-dujardin", "angelina-jolie",
  "beyonce", "celine-dion", "zinedine-zidane", "kylian-mbappe",
] as const;
const starters = new Set<string>([...STARTER_POLITICAL_IDS, ...STARTER_HISTORY_IDS, ...STARTER_CELEBRITY_IDS]);
const people = new Set([...peoplePack, ...historyPack, ...celebritiesPack].map(person => person.name));
export type PersonUnlockSave = { purchasedPeople?: readonly string[]; campaign?: { grantedPortraits?: readonly string[] } };
export const isPerson = (id: string) => people.has(id);
export const isPersonUnlocked = (save: PersonUnlockSave, id: string) =>
  people.has(id) && (starters.has(id) || !!save.purchasedPeople?.includes(id) || !!save.campaign?.grantedPortraits?.includes(id));
export const unlockedPeople = (save: PersonUnlockSave, pool: readonly CharacterDetails[]) =>
  pool.filter(person => isPersonUnlocked(save, person.name));

// Buying a portrait never invents a capture or advances an album medal.
export const validPurchasedPeople = (ids: unknown): string[] => Array.isArray(ids)
  ? [...new Set(ids.filter((id): id is string => typeof id === "string" && people.has(id) && !starters.has(id)))] : [];
