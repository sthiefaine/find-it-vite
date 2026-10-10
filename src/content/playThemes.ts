import { MIN_POOL_SIZE } from "../engine/generateLevel";
import { animalsPack, celebritiesPack, historyPack, peoplePack, playableFlagsPack } from "../helpers/characters";
import type { CharacterDetails } from "../helpers/characters";
import { portraitGameSource } from "../helpers/portraitAssets";
import { unlockedAnimals } from "./unlockedAnimals";
import type { AnimalUnlockSave } from "./unlockedAnimals";
import { unlockedPeople, type PersonUnlockSave } from "./personUnlocks";
import { characterRegionFlag, characterRegionLabel, charactersInRegion, regionsInPool } from "./characterRegions";
import type { CharacterRegion } from "./characterRegions";
export type CharacterUnlockSave = AnimalUnlockSave & PersonUnlockSave;

export type PlayMode = "endless" | "duel";
export type ThemeFamilyId = "animaux" | "personnages" | "drapeaux";
export type PlayThemeId = "animaux" | "ferme" | "foret" | "savane" | "ocean" | "jungle" | "polaires" | "personnages" | "politique" | "histoire" | "personnes" | "drapeaux" | `politique-${string}` | `histoire-${string}` | `personnes-${string}`;
export type PlayTheme = {
  id: PlayThemeId;
  family: ThemeFamilyId;
  group?: "tous" | "politique" | "histoire" | "celebrites";
  region?: CharacterRegion;
  label: string;
  labelKey?: string;
  shortLabel: string;
  description: string;
  emoji: string;
  preview?: string;
  comingSoon?: boolean;
};

export type ThemeTranslator = (key: string, params?: Record<string, string | number>) => string;

/** Translate the template and its country separately, using the caller's locale. */
export function translatedThemeLabel(theme: PlayTheme, translate: ThemeTranslator): string {
  const country = theme.region ? characterRegionLabel(theme.region) : theme.shortLabel;
  return translate(theme.labelKey ?? theme.label, { country: translate(country) });
}

export const THEME_FAMILIES: readonly { id: ThemeFamilyId; label: string; emoji: string; defaultThemeId: PlayThemeId }[] = [
  { id: "animaux", label: "Animaux", emoji: "🐾", defaultThemeId: "ferme" },
  { id: "personnages", label: "Personnages", emoji: "🙂", defaultThemeId: "personnages" },
  { id: "drapeaux", label: "Drapeaux", emoji: "🏳️", defaultThemeId: "drapeaux" },
];

export function defaultThemeForFamily(family: ThemeFamilyId): PlayThemeId {
  return THEME_FAMILIES.find(item => item.id === family)?.defaultThemeId ?? "ferme";
}

function countryThemes(prefix: "politique" | "histoire" | "personnes", pool: readonly CharacterDetails[], defaults: readonly CharacterRegion[] = []): PlayTheme[] {
  const group = prefix === "personnes" ? "celebrites" : prefix;
  const category = prefix === "personnes" ? "Célébrités" : prefix === "politique" ? "Politique" : "Histoire";
  const legacyLabels: Record<string, string> = { "politique-fr": "Politique française", "politique-br": "Politique brésilienne", "politique-us": "Politique américaine", "histoire-fr": "Histoire de France", "histoire-us": "Histoire des États-Unis" };
  return [...new Set([...defaults, ...regionsInPool(pool)])].map(region => {
    const countryPool = charactersInRegion(pool, region);
    const key = `${prefix}-${region}`;
    const id = prefix === "politique" && region === "fr" ? "politique" : key as PlayThemeId;
    const legacy = legacyLabels[key];
    return { id, family: "personnages", group, region, label: legacy ?? `${category} · ${characterRegionLabel(region)}`,
      ...(!legacy ? { labelKey: `${category} · {{country}}` } : {}), shortLabel: characterRegionLabel(region),
      description: "Des portraits liés à ce pays.", emoji: characterRegionFlag(region), preview: countryPool[0]?.imageSrc,
      comingSoon: countryPool.length < MIN_POOL_SIZE };
  });
}

const publishedThemes: readonly PlayTheme[] = [
  { id: "animaux", family: "animaux", label: "Animaux", shortLabel: "Tous", description: "Un grand mélange de petites têtes.", emoji: "🐾", preview: "/assets/images/characters/animals/capybara.png" },
  { id: "ferme", family: "animaux", label: "À la ferme", shortLabel: "Ferme", description: "Vaches, moutons et leurs voisins.", emoji: "🌾", preview: "/assets/images/characters/animals/vache.png" },
  { id: "foret", family: "animaux", label: "Forêt", shortLabel: "Forêt", description: "Les habitants des bois et des sous-bois.", emoji: "🌲", preview: "/assets/images/characters/animals/renard.png" },
  { id: "savane", family: "animaux", label: "Savane", shortLabel: "Savane", description: "Un safari de portraits à retrouver.", emoji: "🌿", preview: "/assets/images/characters/animals/giraffe.png" },
  { id: "ocean", family: "animaux", label: "Océan", shortLabel: "Océan", description: "Une plongée parmi les animaux marins.", emoji: "🐳", preview: "/assets/images/characters/animals/dauphin.png" },
  { id: "jungle", family: "animaux", label: "Jungle", shortLabel: "Jungle", description: "Explore la jungle et ses habitants.", emoji: "🌴", preview: "/assets/images/characters/animals/toucan.png" },
  { id: "polaires", family: "animaux", label: "Régions froides", shortLabel: "Polaires", description: "Retrouve les animaux des régions froides.", emoji: "❄️", preview: "/assets/images/characters/animals/ours-polaire.png" },
  { id: "personnages", family: "personnages", group: "tous", label: "Tous les personnages", shortLabel: "Tous", description: "Politique, histoire et célébrités à retrouver.", emoji: "🙂", preview: "/assets/images/characters/people/emmanuel-macron.png" },
  ...countryThemes("politique", peoplePack, ["fr", "br", "us"]),
  { id: "histoire", family: "personnages", group: "histoire", label: "Histoire", shortLabel: "Monde", description: "Des figures de toutes les époques à retrouver.", emoji: "📜", preview: "/assets/images/characters/history/napoleon-bonaparte.png" },
  ...countryThemes("histoire", historyPack, ["fr", "us"]),
  { id: "personnes", family: "personnages", group: "celebrites", label: "Célébrités", shortLabel: "Célébrités", description: "Cinéma, télévision, cuisine, humour, musique et sport.", emoji: "⭐", preview: celebritiesPack[0]?.imageSrc, comingSoon: celebritiesPack.length < MIN_POOL_SIZE },
  ...countryThemes("personnes", celebritiesPack),
  { id: "drapeaux", family: "drapeaux", label: "Drapeaux", shortLabel: "Tous", description: "Les couleurs du monde entier.", emoji: "🏳️", preview: "/assets/images/characters/flags/fr.png" },
];

export const PLAY_THEMES: readonly PlayTheme[] = publishedThemes.map(theme => ({
  ...theme,
  ...(theme.preview ? { preview: portraitGameSource(theme.preview) } : {}),
}));

export function publishedThemePool(id: PlayThemeId): CharacterDetails[] {
  switch (id) {
    case "personnages": return [...peoplePack, ...historyPack, ...celebritiesPack];
    case "personnes": return celebritiesPack;
    case "politique": return charactersInRegion(peoplePack, "fr");
    case "histoire": return historyPack;
    case "drapeaux": return playableFlagsPack;
    case "animaux": return animalsPack;
    case "ferme":
    case "foret":
    case "savane":
    case "ocean":
    case "jungle":
    case "polaires": return animalsPack.filter((animal) => animal.tags?.includes(id));
    default: {
      const country = /^(politique|histoire|personnes)-([a-z]{2})$/.exec(id);
      if (!country) return [];
      const pool = country[1] === "politique" ? peoplePack : country[1] === "histoire" ? historyPack : celebritiesPack;
      return charactersInRegion(pool, country[2]);
    }
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
  const theme = PLAY_THEMES.find(theme => theme.id === id);
  if (theme?.region && !theme.comingSoon) return pool;
  // Un lien ancien, un thème à venir ou trop peu de portraits ne doit jamais
  // contourner le déblocage : le repli conserve le catalogue autorisé du mode.
  return pool.length >= MIN_POOL_SIZE ? pool : availablePool(mode, "animaux", save);
}
