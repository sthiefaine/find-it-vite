import type { CharacterDetails } from "../helpers/characters";

export type CharacterRegion = "fr" | "us";

// Geographic connections described in personProfiles.json, rather than a
// guessed nationality. A figure can belong to several countries' histories.
export const CHARACTER_REGIONS: Readonly<Record<string, readonly CharacterRegion[]>> = {
  "napoleon-bonaparte": ["fr"],
  "louis-xiv": ["fr"],
  "jeanne-d-arc": ["fr"],
  "leonard-de-vinci": ["fr"],
  "francois-ier": ["fr"],
  "marie-antoinette": ["fr"],
  "olympe-de-gouges": ["fr"],
  "victor-hugo": ["fr"],
  "josephine-baker": ["fr", "us"],
  "rosa-parks": ["us"],
  "martin-luther-king": ["us"],
};

export function charactersInRegion(pool: readonly CharacterDetails[], region: CharacterRegion): CharacterDetails[] {
  return pool.filter(character => character.serie === "politics"
    ? region === "fr" && character.tags?.includes("france")
    : CHARACTER_REGIONS[character.name]?.includes(region));
}
