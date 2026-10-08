import { MIN_POOL_SIZE } from "../engine/generateLevel";
import { animalsPack, historyPack, peoplePack, playableFlagsPack } from "../helpers/characters";
import type { CharacterDetails } from "../helpers/characters";
import { unlockedAnimals } from "./unlockedAnimals";
import type { AnimalUnlockSave } from "./unlockedAnimals";
import { unlockedPeople, type PersonUnlockSave } from "./personUnlocks";
export type CharacterUnlockSave = AnimalUnlockSave & PersonUnlockSave;

export type PlayMode = "endless" | "duel";
export type PlayThemeId = "animaux" | "ferme" | "foret" | "savane" | "ocean" | "politique" | "histoire" | "personnes" | "drapeaux";
export type PlayTheme = {
  id: PlayThemeId;
  label: string;
  description: string;
  emoji: string;
  preview?: string;
  comingSoon?: boolean;
};

export const PLAY_THEMES: readonly PlayTheme[] = [
  { id: "animaux", label: "Animaux", description: "Un grand mélange de petites têtes.", emoji: "🐾", preview: "/assets/images/characters/animals/capybara.png" },
  { id: "ferme", label: "À la ferme", description: "Vaches, moutons et leurs voisins.", emoji: "🌾", preview: "/assets/images/characters/animals/vache.png" },
  { id: "foret", label: "Forêt", description: "Les habitants des bois et des sous-bois.", emoji: "🌲", preview: "/assets/images/characters/animals/renard.png" },
  { id: "savane", label: "Savane", description: "Un safari de portraits à retrouver.", emoji: "🌿", preview: "/assets/images/characters/animals/giraffe.png" },
  { id: "ocean", label: "Océan", description: "Une plongée parmi les animaux marins.", emoji: "🐳", preview: "/assets/images/characters/animals/dauphin.png" },
  { id: "politique", label: "Politique française", description: "Des personnalités, députés et sénateurs à reconnaître.", emoji: "🏛️", preview: "/assets/images/characters/people/emmanuel-macron.png" },
  { id: "histoire", label: "Histoire", description: "Des figures de toutes les époques à retrouver.", emoji: "📜", preview: "/assets/images/characters/history/napoleon-bonaparte.png" },
  { id: "personnes", label: "Personnes", description: "Une nouvelle galerie de visages.", emoji: "🙂", comingSoon: true },
  { id: "drapeaux", label: "Drapeaux", description: "Les couleurs du monde entier.", emoji: "🏳️", preview: "/assets/images/characters/flags/fr.png" },
];

function publishedThemePool(id: PlayThemeId): CharacterDetails[] {
  switch (id) {
    case "politique": return peoplePack;
    case "histoire": return historyPack;
    case "drapeaux": return playableFlagsPack;
    case "animaux": return animalsPack;
    case "ferme":
    case "foret":
    case "savane":
    case "ocean": return animalsPack.filter((animal) => animal.tags?.includes(id));
    default: return [];
  }
}

function availablePool(mode: PlayMode, id: PlayThemeId, save: CharacterUnlockSave): CharacterDetails[] {
  const published = publishedThemePool(id);
  if (id === "politique" || id === "histoire") return unlockedPeople(save, published);
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
  return PLAY_THEMES.find((theme) => theme.id === id && !theme.comingSoon)?.id ?? "animaux";
}

export function playThemePool(mode: PlayMode, id: PlayThemeId, save: CharacterUnlockSave): CharacterDetails[] {
  const pool = availablePool(mode, id, save);
  // Un lien ancien, un thème à venir ou trop peu de portraits ne doit jamais
  // contourner le déblocage : le repli conserve le catalogue autorisé du mode.
  return pool.length >= MIN_POOL_SIZE ? pool : availablePool(mode, "animaux", save);
}
