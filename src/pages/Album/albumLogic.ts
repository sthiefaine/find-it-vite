// Calculs d'affichage de l'album (sans React)
import type { Save } from "../../save/schema";
import { WORLDS } from "../../content/worlds";
import { animalsPack, celebritiesPack, historyPack, peoplePack } from "../../helpers/characters";
import type { CharacterDetails } from "../../helpers/characters";
import { MEDAL_THRESHOLDS } from "../../content/progress";
import type { Mastery } from "../../content/progress";
import { isPersonUnlocked, type PersonUnlockSave } from "../../content/personUnlocks";
import { isAnimalUnlocked } from "../../content/unlockedAnimals";
import type { AnimalUnlockSave } from "../../content/unlockedAnimals";

type AlbumSave = Pick<Save, "collection">;

export const ALBUM_COLLECTIONS = [
  { ...WORLDS[0], characters: WORLDS.flatMap(world => (world.id === "animaux" ? animalsPack : world.characters).map(character => world.id === "ocean" ? { ...character, tags: ["ocean"] } : character)), alwaysAvailable: false, allowColorFilter: true },
  { id: "politique", name: "Politique", emoji: "🏛️", characters: peoplePack,
    background: "linear-gradient(160deg, #dce6ff 0%, #a9bce8 100%)", alwaysAvailable: false, allowColorFilter: false },
  { id: "histoire", name: "Histoire", emoji: "📜", characters: historyPack,
    background: "linear-gradient(160deg, #f9e8c8 0%, #d7b77c 100%)", alwaysAvailable: false, allowColorFilter: false },
  { id: "personnes", name: "Célébrités", emoji: "⭐", characters: celebritiesPack,
    background: "linear-gradient(160deg, #f4dfff 0%, #c5a1ed 100%)", alwaysAvailable: false, allowColorFilter: false },
];
export const isAlbumCharacterUnlocked = (save: AlbumSave & PersonUnlockSave & AnimalUnlockSave, character: CharacterDetails) =>
  character.serie === "politics" || character.serie === "history" || character.serie === "celebrity"
    ? isPersonUnlocked(save, character.name) : isAnimalUnlocked(save, character.name);
const albumCharacters = ALBUM_COLLECTIONS.flatMap((collection) => collection.characters);

export function unlockedAlbumCount(save: AlbumSave & PersonUnlockSave & AnimalUnlockSave, characters: readonly CharacterDetails[] = albumCharacters) {
  return { caught: characters.filter(character => isAlbumCharacterUnlocked(save, character)).length, total: characters.length };
}

export function caughtCount(save: AlbumSave, characters: CharacterDetails[] = albumCharacters) {
  const caught = characters.filter((c) => (save.collection[c.name] ?? 0) > 0).length;
  return { caught, total: characters.length };
}

export const MEDALS: Partial<Record<Mastery, string>> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

// Prochain palier de maîtrise : combien de fois encore, et quelle médaille
export function nextMedal(count: number): { left: number; medal: string } | null {
  for (const threshold of MEDAL_THRESHOLDS) {
    const medal = MEDALS[threshold.mastery];
    if (count < threshold.count && medal) return { left: threshold.count - count, medal };
  }
  return null;
}
