import type { CharacterDetails } from "../helpers/characters";
import type { Rng } from "./rng";

const normalized = (value?: string) => value?.trim().toLocaleLowerCase("fr") ?? "";

// Une autre race de la même espèce est le meilleur sosie. Les couleurs et la
// famille visuelle prennent le relais lorsque cette espèce n'a qu'un portrait.
export function animalSimilarity(a: CharacterDetails, b: CharacterDetails): number {
  const species = normalized(a.species);
  const sameSpecies = species !== "" && species === normalized(b.species);
  const colors = new Set(a.dominantColors?.length ? a.dominantColors : [a.color]);
  const sharedColor = (b.dominantColors?.length ? b.dominantColors : [b.color]).some((color) => colors.has(color));
  return (sameSpecies ? 8 : 0) + (a.color === b.color ? 4 : 0)
    + (a.family === b.family ? 2 : 0) + (sharedColor ? 1 : 0);
}

export function selectAnimalDecoys(
  wanted: CharacterDetails, ratio: number, pool: CharacterDetails[], rng: Rng, count = 20,
): CharacterDetails[] {
  const candidates = pool.filter((animal) => animal.name !== wanted.name);
  if (!candidates.length) return [];
  const ranked = candidates.map((animal) => ({ animal, score: animalSimilarity(wanted, animal) }));
  const best = Math.max(...ranked.map(({ score }) => score));
  const similar = rng.shuffle(ranked.filter(({ score }) => best > 0 && score === best).map(({ animal }) => animal));
  const others = rng.shuffle(ranked.filter(({ score }) => best === 0 || score !== best).map(({ animal }) => animal));
  const similarCount = similar.length === 0 ? 0 : others.length === 0 ? count : Math.round(Math.max(0, Math.min(1, ratio)) * count);
  return Array.from({ length: count }, (_, i) => i < similarCount
    ? similar[i % similar.length]
    : others[(i - similarCount) % others.length]);
}
