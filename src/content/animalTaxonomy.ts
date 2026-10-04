import type { CharacterColor } from "../helpers/characters";

/** Optional so older catalogues and non-animal character packs keep working. */
export type AnimalMetadata = {
  species?: string;
  breed?: string;
  dominantColors?: CharacterColor[];
  tags?: string[];
};

export const ANIMAL_COLORS: Record<CharacterColor, { label: string; hex: string }> = {
  brown: { label: "Brun", hex: "#94603b" }, grey: { label: "Gris", hex: "#90999b" },
  yellow: { label: "Jaune", hex: "#eec74e" }, white: { label: "Blanc", hex: "#fffefa" },
  green: { label: "Vert", hex: "#6b9950" }, blue: { label: "Bleu", hex: "#6595be" },
  red: { label: "Rouge", hex: "#d6554e" }, orange: { label: "Orange", hex: "#e79742" },
  pink: { label: "Rose", hex: "#e7a9b5" }, purple: { label: "Violet", hex: "#9573b7" },
  black: { label: "Noir", hex: "#363a3b" },
};

export const ANIMAL_CATEGORIES = {
  ferme: "À la ferme", felins: "Félins", canides: "Canidés", oiseaux: "Oiseaux",
  reptiles: "Reptiles", sauvages: "Animaux sauvages", domestiques: "Animaux domestiques",
  foret: "Forêt", savane: "Savane", ocean: "Océan",
} as const;

export const ANIMAL_SPECIES: Record<string, string> = {
  chat: "Chat", chien: "Chien", mouton: "Mouton", oiseau: "Oiseau", serpent: "Serpent",
  vache: "Vache", cochon: "Cochon", chevre: "Chèvre", ane: "Âne", cheval: "Cheval",
  lapin: "Lapin", poule: "Poule", coq: "Coq", canard: "Canard", oie: "Oie",
  renard: "Renard", panda: "Panda", capybara: "Capybara", elephant: "Éléphant",
  hippopotame: "Hippopotame", pigeon: "Pigeon", girafe: "Girafe", leopard: "Léopard",
  guepard: "Guépard", zebre: "Zèbre", dinde: "Dinde", lion: "Lion", tigre: "Tigre",
  ours: "Ours", loup: "Loup", singe: "Singe", ecureuil: "Écureuil", herisson: "Hérisson",
  hibou: "Hibou", "raton-laveur": "Raton laveur", crocodile: "Crocodile", koala: "Koala",
};

/** Creative starting points; adding a suggestion never adds a sprite to the game. */
export const BREED_SUGGESTIONS: Record<string, readonly string[]> = {
  chat: ["Européen", "Siamois", "Persan", "Maine Coon", "British Shorthair", "Bengal", "Sphynx"],
  chien: ["Labrador", "Golden Retriever", "Berger allemand", "Husky", "Dalmatien", "Beagle", "Caniche", "Shiba Inu"],
  mouton: ["Mérinos", "Ouessant", "Suffolk", "Nez noir du Valais"],
  oiseau: ["Perruche ondulée", "Calopsitte", "Ara", "Canari", "Chardonneret"],
  serpent: ["Python royal", "Serpent des blés", "Boa constricteur", "Couleuvre"],
  vache: ["Prim’Holstein", "Normande", "Highland", "Charolaise"],
  chevre: ["Alpine", "Saanen", "Angora", "Chèvre naine"],
  poule: ["Soie", "Sussex", "Brahma", "Marans"],
  lapin: ["Bélier", "Angora", "Rex", "Nain"],
};

export function normalizedAnimalMetadata(animal: AnimalMetadata & { color: CharacterColor }) {
  return {
    species: animal.species?.trim() ?? "",
    breed: animal.breed?.trim() ?? "",
    dominantColors: [...new Set([animal.color, ...(animal.dominantColors ?? [])])],
    tags: [...new Set(animal.tags ?? [])],
  };
}

export function animalCategoryLabel(tag: string): string {
  return ANIMAL_CATEGORIES[tag as keyof typeof ANIMAL_CATEGORIES] ?? tag.replace(/-/g, " ");
}

export function animalSpeciesLabel(species: string): string {
  return ANIMAL_SPECIES[species] ?? species;
}

export function matchesAnimalSearch(
  animal: AnimalMetadata & { label: string; color: CharacterColor; subject?: string }, query: string,
) {
  const metadata = normalizedAnimalMetadata(animal);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  const haystack = normalize([
    animal.label, animal.subject ?? "", animalSpeciesLabel(metadata.species), metadata.breed,
    ...metadata.tags.map(animalCategoryLabel), ...metadata.dominantColors.map((color) => ANIMAL_COLORS[color].label),
  ].join(" "));
  return normalize(query).trim().split(/\s+/).every((term) => haystack.includes(term));
}
