// Calculs d'affichage de l'album (sans React)
import type { Save } from "../../save/schema";
import { allCharacters } from "../../content/worlds";
import type { CharacterDetails } from "../../helpers/characters";
import { masteryOf } from "../../content/progress";
import type { Mastery } from "../../content/progress";

type AlbumSave = Pick<Save, "collection">;

export function caughtCount(save: AlbumSave, characters: CharacterDetails[] = allCharacters()) {
  const caught = characters.filter((c) => (save.collection[c.name] ?? 0) > 0).length;
  return { caught, total: characters.length };
}

export const MEDALS: Partial<Record<Mastery, string>> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
};

// Prochain palier de maîtrise : combien de fois encore, et quelle médaille
export function nextMedal(count: number): { left: number; medal: string } | null {
  const current = masteryOf(count);
  for (let n = count + 1; n <= count + 50; n++) {
    const m = masteryOf(n);
    if (m !== current && MEDALS[m]) return { left: n - count, medal: MEDALS[m] };
  }
  return null;
}
