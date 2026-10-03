// Sauvegarde locale du joueur. Pour faire évoluer le format :
// 1. créer SaveV(n+1),
// 2. passer SAVE_VERSION et `Save` à la nouvelle version,
// 3. ajouter la migration n → n+1 dans migrations.ts.
import type { Tier } from "../engine/types";

export const SAVE_VERSION = 2 as const;
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

// Profil choisi dans « Qui joue ? » (null : pas encore choisi)
export type SaveProfile = {
  tier: Tier | null;
};

export type SaveV2 = {
  version: 2;
  settings: SaveSettings;
  progress: SaveProgress;
  profile: SaveProfile;
};

export const TIERS: readonly Tier[] = ["easy", "normal", "expert"];

// Format courant
export type Save = SaveV2;

export function defaultSave(): SaveV2 {
  return {
    version: SAVE_VERSION,
    settings: { sound: true },
    progress: { bestScore: 0, bestLevel: 1, gamesPlayed: 0, totalFound: 0 },
    profile: { tier: null },
  };
}
