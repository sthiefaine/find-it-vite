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
  jungle: "Jungle", polaires: "Régions froides", rongeurs: "Rongeurs",
  amphibiens: "Amphibiens", primates: "Primates",
  australie: "Australie", desert: "Désert", insectes: "Insectes",
  arachnides: "Arachnides", invertebres: "Invertébrés",
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
  lama: "Lama", alpaga: "Alpaga", lynx: "Lynx", "panda-roux": "Panda roux",
  cerf: "Cerf", blaireau: "Blaireau", castor: "Castor", dauphin: "Dauphin",
  orque: "Orque", phoque: "Phoque", morse: "Morse", "loutre-de-mer": "Loutre de mer",
  tortue: "Tortue", requin: "Requin", poisson: "Poisson", poulpe: "Poulpe",
  manchot: "Manchot", beluga: "Béluga",
  rhinoceros: "Rhinocéros",
  ara: "Ara", perroquet: "Perroquet", cacatoes: "Cacatoès", perruche: "Perruche",
  toucan: "Toucan", flamant: "Flamant", pelican: "Pélican", aigle: "Aigle",
  macareux: "Macareux", paon: "Paon", cameleon: "Caméléon", iguane: "Iguane",
  gecko: "Gecko", "dragon-barbu": "Dragon barbu", axolotl: "Axolotl", grenouille: "Grenouille",
  hyene: "Hyène", suricate: "Suricate", phacochere: "Phacochère", buffle: "Buffle",
  gnou: "Gnou", gazelle: "Gazelle", oryx: "Oryx", impala: "Impala", serval: "Serval",
  sanglier: "Sanglier", elan: "Élan", renne: "Renne", mouflon: "Mouflon",
  marmotte: "Marmotte", "chauve-souris": "Chauve-souris", glouton: "Glouton",
  bison: "Bison", lievre: "Lièvre", chevreuil: "Chevreuil",
  gorille: "Gorille", "orang-outan": "Orang-outan", lemurien: "Lémurien",
  paresseux: "Paresseux", tapir: "Tapir", tamanoir: "Tamanoir", pangolin: "Pangolin",
  okapi: "Okapi", mandrill: "Mandrill", tarsier: "Tarsier", hamster: "Hamster",
  "cochon-inde": "Cochon d’Inde", furet: "Furet", chinchilla: "Chinchilla", gerbille: "Gerbille",
  hippocampe: "Hippocampe", crabe: "Crabe", homard: "Homard", raie: "Raie", narval: "Narval",
  kangourou: "Kangourou", wombat: "Wombat", ornithorynque: "Ornithorynque", echidne: "Échidné",
  "diable-de-tasmanie": "Diable de Tasmanie", dingo: "Dingo", quokka: "Quokka", fennec: "Fennec",
  dromadaire: "Dromadaire", chameau: "Chameau", baleine: "Baleine", "poisson-clown": "Poisson-clown",
  meduse: "Méduse", calamar: "Calamar", seiche: "Seiche", murene: "Murène", "poisson-lune": "Poisson-lune",
  "poisson-chirurgien": "Poisson-chirurgien", lamantin: "Lamantin", dugong: "Dugong",
  "poisson-lion": "Poisson-lion",
  abeille: "Abeille", bourdon: "Bourdon", coccinelle: "Coccinelle", papillon: "Papillon", mante: "Mante",
  libellule: "Libellule", fourmi: "Fourmi", scarabee: "Scarabée", escargot: "Escargot", araignee: "Araignée",
  chimpanze: "Chimpanzé", gibbon: "Gibbon", jaguar: "Jaguar", ocelot: "Ocelot", salamandre: "Salamandre",
  triton: "Triton", crapaud: "Crapaud", harfang: "Harfang", "boeuf-musque": "Bœuf musqué", lagopede: "Lagopède",
};

/** Creative starting points; adding a suggestion never adds a sprite to the game. */
export const BREED_SUGGESTIONS: Record<string, readonly string[]> = {
  chat: ["Européen", "Siamois", "Persan", "Maine Coon", "British Shorthair", "Bengal", "Sphynx", "Ragdoll"],
  chien: ["Labrador", "Golden Retriever", "Berger allemand", "Husky", "Dalmatien", "Beagle", "Caniche", "Shiba Inu", "Berger australien"],
  mouton: ["Mérinos", "Ouessant", "Suffolk", "Nez noir du Valais"],
  oiseau: ["Perruche ondulée", "Calopsitte", "Ara", "Canari", "Chardonneret"],
  serpent: ["Python royal", "Serpent des blés", "Boa constricteur", "Couleuvre"],
  vache: ["Prim’Holstein", "Normande", "Highland", "Charolaise"],
  chevre: ["Alpine", "Saanen", "Angora", "Chèvre naine"],
  poule: ["Soie", "Sussex", "Brahma", "Marans"],
  lapin: ["Bélier", "Angora", "Rex", "Nain"],
  cheval: ["Shetland", "Frison"],
  cochon: ["Kunekune"],
};

export function normalizedAnimalMetadata(animal: AnimalMetadata & { color: CharacterColor }) {
  return {
    species: animal.species?.trim() ?? "",
    breed: animal.breed?.trim() ?? "",
    dominantColors: [...new Set([animal.color, ...(animal.dominantColors ?? [])])],
    tags: [...new Set(animal.tags ?? [])],
  };
}

const PEOPLE_CATEGORIES: Record<string, string> = {
  celebrites: "Célébrités", cinema: "Cinéma", television: "Télévision", cuisine: "Cuisine", humour: "Humour", musique: "Musique", sport: "Sport",
  politique: "Politique", france: "France", presidents: "Présidents", histoire: "Histoire", senateurs: "Sénateurs", deputes: "Députés",
  antiquite: "Antiquité", "moyen-age": "Moyen Âge", renaissance: "Renaissance", sciences: "Sciences", arts: "Arts", "droits-civiques": "Droits civiques", souverains: "Souverains",
};

export function animalCategoryLabel(tag: string): string {
  return ANIMAL_CATEGORIES[tag as keyof typeof ANIMAL_CATEGORIES] ?? PEOPLE_CATEGORIES[tag] ?? tag.replace(/-/g, " ");
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
