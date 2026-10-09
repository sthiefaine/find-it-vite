import { MIN_POOL_SIZE } from "../engine/generateLevel";
import { animalsPack, historyPack, peoplePack, playableFlagsPack } from "../helpers/characters";
import type { CharacterDetails } from "../helpers/characters";
import { unlockedAnimals } from "./unlockedAnimals";
import type { AnimalUnlockSave } from "./unlockedAnimals";
import { unlockedPeople, type PersonUnlockSave } from "./personUnlocks";
import { charactersInRegion } from "./characterRegions";
export type CharacterUnlockSave = AnimalUnlockSave & PersonUnlockSave;

export type PlayMode = "endless" | "duel";
export type ThemeFamilyId = "animaux" | "personnages" | "drapeaux";
export type PlayThemeId = "animaux" | "ferme" | "foret" | "savane" | "ocean" | "jungle" | "polaires" | "politique" | "politique-br" | "politique-us" | "histoire" | "histoire-fr" | "histoire-us" | "personnes" | "drapeaux";
export type PlayTheme = {
  id: PlayThemeId;
  family: ThemeFamilyId;
  group?: "politique" | "histoire";
  region?: "fr" | "br" | "us";
  label: string;
  shortLabel: string;
  description: string;
  emoji: string;
  preview?: string;
  comingSoon?: boolean;
};

export const THEME_FAMILIES: readonly { id: ThemeFamilyId; label: string; emoji: string; defaultThemeId: PlayThemeId }[] = [
  { id: "animaux", label: "Animaux", emoji: "🐾", defaultThemeId: "ferme" },
  { id: "personnages", label: "Personnages", emoji: "🙂", defaultThemeId: "politique" },
  { id: "drapeaux", label: "Drapeaux", emoji: "🏳️", defaultThemeId: "drapeaux" },
];

export function defaultThemeForFamily(family: ThemeFamilyId): PlayThemeId {
  return THEME_FAMILIES.find(item => item.id === family)?.defaultThemeId ?? "ferme";
}

export const PLAY_THEMES: readonly PlayTheme[] = [
  { id: "animaux", family: "animaux", label: "Animaux", shortLabel: "Tous", description: "Un grand mélange de petites têtes.", emoji: "🐾", preview: "/assets/images/characters/animals/capybara.png" },
  { id: "ferme", family: "animaux", label: "À la ferme", shortLabel: "Ferme", description: "Vaches, moutons et leurs voisins.", emoji: "🌾", preview: "/assets/images/characters/animals/vache.png" },
  { id: "foret", family: "animaux", label: "Forêt", shortLabel: "Forêt", description: "Les habitants des bois et des sous-bois.", emoji: "🌲", preview: "/assets/images/characters/animals/renard.png" },
  { id: "savane", family: "animaux", label: "Savane", shortLabel: "Savane", description: "Un safari de portraits à retrouver.", emoji: "🌿", preview: "/assets/images/characters/animals/giraffe.png" },
  { id: "ocean", family: "animaux", label: "Océan", shortLabel: "Océan", description: "Une plongée parmi les animaux marins.", emoji: "🐳", preview: "/assets/images/characters/animals/dauphin.png" },
  { id: "jungle", family: "animaux", label: "Jungle", shortLabel: "Jungle", description: "Explore la jungle et ses habitants.", emoji: "🌴", preview: "/assets/images/characters/animals/toucan.png" },
  { id: "polaires", family: "animaux", label: "Régions froides", shortLabel: "Polaires", description: "Retrouve les animaux des régions froides.", emoji: "❄️", preview: "/assets/images/characters/animals/ours-polaire.png" },
  { id: "politique", family: "personnages", group: "politique", region: "fr", label: "Politique française", shortLabel: "France", description: "Des personnalités, députés et sénateurs à reconnaître.", emoji: "🏛️", preview: "/assets/images/characters/people/emmanuel-macron.png" },
  { id: "politique-br", family: "personnages", group: "politique", region: "br", label: "Politique brésilienne", shortLabel: "Brésil", description: "Ce thème arrive bientôt.", emoji: "🇧🇷", comingSoon: true },
  { id: "politique-us", family: "personnages", group: "politique", region: "us", label: "Politique américaine", shortLabel: "États-Unis", description: "Ce thème arrive bientôt.", emoji: "🇺🇸", comingSoon: true },
  { id: "histoire", family: "personnages", group: "histoire", label: "Histoire", shortLabel: "Monde", description: "Des figures de toutes les époques à retrouver.", emoji: "📜", preview: "/assets/images/characters/history/napoleon-bonaparte.png" },
  { id: "histoire-fr", family: "personnages", group: "histoire", region: "fr", label: "Histoire de France", shortLabel: "France", description: "Des figures qui ont marqué l’histoire de France.", emoji: "🇫🇷", preview: "/assets/images/characters/history/napoleon-bonaparte.png" },
  { id: "histoire-us", family: "personnages", group: "histoire", region: "us", label: "Histoire des États-Unis", shortLabel: "États-Unis", description: "Des figures qui ont marqué l’histoire des États-Unis.", emoji: "🇺🇸", preview: "/assets/images/characters/history/rosa-parks.png" },
  { id: "personnes", family: "personnages", label: "Personnes", shortLabel: "Personnes", description: "Une nouvelle galerie de visages.", emoji: "🙂", comingSoon: true },
  { id: "drapeaux", family: "drapeaux", label: "Drapeaux", shortLabel: "Tous", description: "Les couleurs du monde entier.", emoji: "🏳️", preview: "/assets/images/characters/flags/fr.png" },
];

export function publishedThemePool(id: PlayThemeId): CharacterDetails[] {
  switch (id) {
    case "politique": return peoplePack;
    case "histoire": return historyPack;
    case "histoire-fr": return charactersInRegion(historyPack, "fr");
    case "histoire-us": return charactersInRegion(historyPack, "us");
    case "drapeaux": return playableFlagsPack;
    case "animaux": return animalsPack;
    case "ferme":
    case "foret":
    case "savane":
    case "ocean":
    case "jungle":
    case "polaires": return animalsPack.filter((animal) => animal.tags?.includes(id));
    default: return [];
  }
}

function availablePool(mode: PlayMode, id: PlayThemeId, save: CharacterUnlockSave): CharacterDetails[] {
  const published = publishedThemePool(id);
  if (PLAY_THEMES.find(theme => theme.id === id)?.family === "personnages") return unlockedPeople(save, published);
  return mode === "duel" || id === "drapeaux" ? published : unlockedAnimals(save, published);
}

export function themeOptions(mode: PlayMode, save: CharacterUnlockSave) {
  return PLAY_THEMES.map((theme) => {
    const totalCount = publishedThemePool(theme.id).length;
    const availableCount = availablePool(mode, theme.id, save).length;
    return { theme, availableCount, totalCount, enabled: !theme.comingSoon && availableCount >= MIN_POOL_SIZE };
  });
}

export function playThemeFromSearch(search: string): PlayThemeId {
  const id = new URLSearchParams(search).get("theme");
  return PLAY_THEMES.find((theme) => theme.id === id && !theme.comingSoon)?.id ?? "ferme";
}

export function playThemePool(mode: PlayMode, id: PlayThemeId, save: CharacterUnlockSave): CharacterDetails[] {
  const pool = availablePool(mode, id, save);
  // A country with too few unlocked figures stays unavailable. Callers check
  // themeOptions before starting rather than silently switching its catalogue.
  if (id === "histoire-fr" || id === "histoire-us") return pool;
  // Un lien ancien, un thème à venir ou trop peu de portraits ne doit jamais
  // contourner le déblocage : le repli conserve le catalogue autorisé du mode.
  return pool.length >= MIN_POOL_SIZE ? pool : availablePool(mode, "animaux", save);
}
