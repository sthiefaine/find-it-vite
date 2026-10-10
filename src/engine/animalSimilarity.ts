import type { CharacterDetails } from "../helpers/characters";
import { visualConfusionBudget } from "./curve";
import type { Rng } from "./rng";
import type { Tier } from "./types";

const normalized = (value?: string) => value?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ?? "";

// Groupes de silhouettes des portraits du jeu, pas une classification zoologique.
// Une famille de couleur (brun, gris, tacheté...) ne suffit jamais à en créer un.
const SILHOUETTE_GROUPS: [string, string[]][] = [
  ["felins", ["chat", "lion", "tigre", "guepard", "leopard"]],
  ["canides", ["chien", "loup", "renard"]],
  ["cornes", ["vache", "mouton", "chevre"]],
  ["equides", ["ane", "cheval", "zebre"]],
  ["oiseaux", ["oiseau", "poule", "coq", "canard", "oie", "pigeon", "dinde", "hibou"]],
  ["oreilles-rondes", ["ours", "panda", "koala"]],
];
const SILHOUETTES: Record<string, string> = Object.fromEntries(
  SILHOUETTE_GROUPS.flatMap(([group, species]) => species.map((name) => [name, group])),
);
const CLOSE_SPECIES: Record<string, string> = {
  guepard: "felins-tachetes", leopard: "felins-tachetes",
  coq: "gallinaces", poule: "gallinaces",
  baleine: "baleines", rorqual: "baleines",
};
const LEGACY_SHAPES = new Set(["poisson", "baleine", "tentacules", "pinces"]);

type VisualProfile = { species: string; family: string; colors: CharacterDetails["color"][]; color: CharacterDetails["color"]; silhouette: string; husky: boolean };
type ProfileSnapshot = Pick<CharacterDetails, "name" | "species" | "family" | "color" | "breed" | "dominantColors" | "tags"> & { profile: VisualProfile };
const profiles = new WeakMap<CharacterDetails, ProfileSnapshot>();
const sameItems = (a: readonly string[] | undefined, b: readonly string[] | undefined) => {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
function visualProfile(animal: CharacterDetails): VisualProfile {
  // Un même portrait traverse plusieurs centaines de foules. Normaliser son
  // anatomie une fois suffit ; les copies permettent aussi les éditions locales.
  const cached = profiles.get(animal);
  if (cached && cached.name === animal.name && cached.species === animal.species && cached.family === animal.family
    && cached.color === animal.color && cached.breed === animal.breed && sameItems(cached.dominantColors, animal.dominantColors) && sameItems(cached.tags, animal.tags)) return cached.profile;
  const name = normalized(animal.name);
  const oldSpecies = name.replace(/^ocean-/, "").split("-")[0];
  const species = normalized(animal.species)
    || (SILHOUETTES[oldSpecies] || CLOSE_SPECIES[oldSpecies] ? oldSpecies : "");
  const family = normalized(animal.family);
  const colors = animal.dominantColors?.length ? [...animal.dominantColors] : [animal.color];
  const profile: VisualProfile = {
    species, family, colors, color: animal.color,
    silhouette: SILHOUETTES[species]
      || animal.tags?.find((tag) => tag === "felins" || tag === "canides" || tag === "oiseaux")
      || (LEGACY_SHAPES.has(family) ? family : ""),
    husky: species === "chien" && (name.includes("husky") || /husky|malamute/.test(normalized(animal.breed))),
  };
  profiles.set(animal, { name: animal.name, species: animal.species, family: animal.family, color: animal.color, breed: animal.breed,
    dominantColors: animal.dominantColors && [...animal.dominantColors], tags: animal.tags && [...animal.tags], profile });
  return profile;
}

const sharedColors = (a: VisualProfile, b: VisualProfile) => a.colors.filter((color) => b.colors.includes(color)).length;

function similarity(a: VisualProfile, b: VisualProfile): number {
  const sameSpecies = a.species !== "" && a.species === b.species;
  return (sameSpecies ? 8 : 0) + (a.color === b.color ? 4 : 0)
    + (a.family !== "" && a.family === b.family ? 2 : 0) + (sharedColors(a, b) ? 1 : 0);
}

export function animalSimilarity(a: CharacterDetails, b: CharacterDetails): number {
  return similarity(visualProfile(a), visualProfile(b));
}

export type AnimalConfusionRisk = 0 | 1 | 2 | 3;

function confusionRisk(a: VisualProfile, b: VisualProfile): AnimalConfusionRisk {
  if (a.species !== "" && a.species === b.species) {
    // Même anatomie : changer uniquement la couleur ne rend pas une race facile.
    return a.color === b.color || sharedColors(a, b) >= 2 ? 3 : 2;
  }
  if ((CLOSE_SPECIES[a.species] && CLOSE_SPECIES[a.species] === CLOSE_SPECIES[b.species])
    || (a.species === "loup" && b.husky) || (b.species === "loup" && a.husky)) return 3;
  if (a.silhouette !== "" && a.silhouette === b.silhouette) return 1;
  return 0;
}

/** 0 : distinct, 1 : silhouette voisine, 2 : race contrastée, 3 : quasi-sosie. */
export function animalConfusionRisk(a: CharacterDetails, b: CharacterDetails): AnimalConfusionRisk {
  return confusionRisk(visualProfile(a), visualProfile(b));
}

export type DecoyProgression = { index: number; tier: Tier };

export function selectAnimalDecoys(
  wanted: CharacterDetails, ratio: number, pool: CharacterDetails[], rng: Rng,
  progression: DecoyProgression, count = 20,
): CharacterDetails[] {
  const target = visualProfile(wanted);
  const ranked = pool.filter((animal) => animal.name !== wanted.name).map((animal) => {
    const profile = visualProfile(animal);
    return { animal, risk: confusionRisk(target, profile), score: similarity(target, profile) };
  });
  if (!ranked.length) return [];

  // Exclusion appliquée à TOUTES les catégories : un sosie classé deuxième au
  // score ne peut plus se glisser parmi les leurres « autres » dès le niveau 1.
  let base = ranked.filter(({ risk }) => risk === 0);
  if (!base.length) {
    // Un petit thème peut n'offrir que des races. On utilise alors les portraits
    // les moins confondables existants, sans élargir le pool ni inventer d'animal.
    const leastRisk = Math.min(...ranked.map(({ risk }) => risk));
    const leastScore = Math.min(...ranked.filter(({ risk }) => risk === leastRisk).map(({ score }) => score));
    base = ranked.filter(({ risk, score }) => risk === leastRisk && score === leastScore);
  }
  const distinct = rng.shuffle(base.map(({ animal }) => animal));
  const budget = visualConfusionBudget(progression.index, progression.tier);
  const caps = [0, budget.related, budget.breed, budget.close];
  let remaining = Math.floor(Math.max(0, Math.min(1, ratio)) * count + 1e-9);
  const decoys: CharacterDetails[] = [];
  for (const risk of [3, 2, 1] as const) {
    const slots = Math.min(remaining, Math.floor(caps[risk] * count + 1e-9));
    if (!slots) continue;
    const candidates = rng.shuffle(ranked.filter((candidate) => candidate.risk === risk).map(({ animal }) => animal));
    if (!candidates.length) continue;
    for (let i = 0; i < slots; i++) decoys.push(candidates[i % candidates.length]);
    remaining -= slots;
  }
  for (let i = 0, left = count - decoys.length; i < left; i++) decoys.push(distinct[i % distinct.length]);
  return rng.shuffle(decoys);
}
