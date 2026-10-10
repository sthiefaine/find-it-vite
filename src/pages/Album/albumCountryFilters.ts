import type { CharacterDetails } from "../../helpers/characters";
import { charactersInRegion } from "../../content/characterRegions";

const celebrityCategories = new Set(["cinema", "television", "cuisine", "humour", "musique", "sport"]);
export function albumCategoryTags(character: CharacterDetails): string[] {
  return [...new Set(character.tags ?? [])].filter(tag => !/^[a-z]{2}$/.test(tag)
    && (character.serie !== "celebrity" || celebrityCategories.has(tag)));
}

export function filterAlbumCharacters(characters: readonly CharacterDetails[], category = "", region = ""): CharacterDetails[] {
  const countryPool = region ? charactersInRegion(characters, region) : [...characters];
  return category ? countryPool.filter(character => character.tags?.includes(category)) : countryPool;
}
