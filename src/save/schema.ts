// Sauvegarde locale du joueur. Pour faire évoluer le format :
// 1. créer SaveV2 (ex. avec profils, mondes, étoiles, album…),
// 2. passer SAVE_VERSION à 2 et `Save` à SaveV2,
// 3. ajouter la migration 1 → 2 dans migrations.ts.

export const SAVE_VERSION = 1 as const;
export const SAVE_KEY = "find-it:save";

export type SaveSettings = {
  sound: boolean;
};

export type SaveProgress = {
  bestScore: number;
  bestLevel: number;
  gamesPlayed: number;
  totalFound: number;
};

export type SaveV1 = {
  version: 1;
  settings: SaveSettings;
  progress: SaveProgress;
};

// Format courant
export type Save = SaveV1;

export function defaultSave(): SaveV1 {
  return {
    version: SAVE_VERSION,
    settings: { sound: true },
    progress: { bestScore: 0, bestLevel: 1, gamesPlayed: 0, totalFound: 0 },
  };
}
