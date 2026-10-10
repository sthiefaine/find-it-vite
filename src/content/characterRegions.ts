import type { CharacterDetails } from "../helpers/characters";
import { isCountryLink } from "./countryLinks";
import { REGION_CODES } from "../i18n/regions";

export type CharacterRegion = string;

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
  const code = region.toLowerCase();
  return pool.filter(character => characterRegions(character).includes(code));
}

export function characterRegions(character: CharacterDetails): CharacterRegion[] {
  const explicit = character.countryLinks?.filter(isCountryLink).map(link => link.code.toLowerCase()) ?? [];
  const legacy = CHARACTER_REGIONS[character.name] ?? [];
  // The old political catalogue was French. New sourced political figures
  // must use their own links even if a stale "france" tag was carried over.
  const oldPolitics = !character.countryLinks?.length && character.serie === "politics" && character.tags?.includes("france") ? ["fr"] : [];
  return [...new Set([...legacy, ...explicit, ...oldPolitics])];
}

const labels = Object.fromEntries(Object.entries(REGION_CODES).map(([label, code]) => [code.toLowerCase(), label]));
const preferredOrder = ["fr", "us", "br", "gb", "pt", "es", "it", "de", "ru", "cn", "tr", "ir", "iq"];

export function regionsInPool(pool: readonly CharacterDetails[]): CharacterRegion[] {
  return [...new Set(pool.flatMap(characterRegions))].sort((left, right) => {
    const a = preferredOrder.indexOf(left), b = preferredOrder.indexOf(right);
    return (a < 0 ? preferredOrder.length : a) - (b < 0 ? preferredOrder.length : b) || left.localeCompare(right);
  });
}

export const characterRegionLabel = (region: CharacterRegion): string => labels[region.toLowerCase()] ?? region.toUpperCase();
export const characterRegionFlag = (region: CharacterRegion): string => /^[a-z]{2}$/i.test(region)
  ? String.fromCodePoint(...region.toUpperCase().split("").map(letter => 127397 + letter.charCodeAt(0))) : "🌍";
