// Calculs d'affichage de l'album (sans React)
import type { Save } from "../../save/schema";
import { WORLDS } from "../../content/worlds";
import { peoplePack } from "../../helpers/characters";
import type { CharacterDetails } from "../../helpers/characters";
import { MEDAL_THRESHOLDS } from "../../content/progress";
import type { Mastery } from "../../content/progress";

type AlbumSave = Pick<Save, "collection">;

export const ALBUM_COLLECTIONS = [
  ...WORLDS.map((world) => ({ ...world, alwaysAvailable: false, allowColorFilter: true })),
  { id: "politique", name: "Politique française", emoji: "🏛️", characters: peoplePack,
    background: "linear-gradient(160deg, #dce6ff 0%, #a9bce8 100%)", alwaysAvailable: true, allowColorFilter: false },
];
const albumCharacters = ALBUM_COLLECTIONS.flatMap((collection) => collection.characters);

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
