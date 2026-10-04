import { animalsPack } from "../helpers/characters";
import type { CharacterDetails } from "../helpers/characters";
import { ANIMAL_CATEGORIES, animalCategoryLabel } from "./animalTaxonomy";

// Une série doit conserver assez de portraits distincts pour varier les recherches.
export const MIN_SERIES_SIZE = 5;

export function animalSeries(pool: CharacterDetails[] = animalsPack) {
  const categories = new Set([...Object.keys(ANIMAL_CATEGORIES), ...pool.flatMap((animal) => animal.tags ?? [])]);
  return [...categories].map((id) => ({
    id, label: animalCategoryLabel(id), characters: pool.filter((animal) => animal.tags?.includes(id)),
  })).filter((series) => series.characters.length >= MIN_SERIES_SIZE);
}

export function seriesFromSearch(search: string, pool: CharacterDetails[] = animalsPack) {
  const params = new URLSearchParams(search);
  // Le Défi et l'Aventure gardent leurs catalogues communs à tous les joueurs.
  if (params.get("mode") === "daily" || params.get("mode") === "adventure") return undefined;
  const id = params.get("serie");
  return animalSeries(pool).find((series) => series.id === id);
}
