// Sauvegarde locale du joueur. Pour faire évoluer le format :
// 1. créer SaveV(n+1),
// 2. passer SAVE_VERSION et `Save` à la nouvelle version,
// 3. ajouter la migration n → n+1 dans migrations.ts.
import type { Tier } from "../engine/types";

export const SAVE_VERSION = 4 as const;
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

// v3 : mécaniques déjà découvertes (voir mechanicsOf dans engine/rules.ts)
export type SaveV3 = {
  version: 3;
  settings: SaveSettings;
  progress: SaveProgress;
  profile: SaveProfile;
  seenMechanics: string[];
};

// v4 : mode calme, cadre d'avis, Aventure, collection et défi du jour
export type FrameId = "classic" | "neon" | "gold" | "ice";

export type SaveSettingsV4 = SaveSettings & {
  calm: boolean; // pas de chrono en Infini
  frame: FrameId;
};

export type SaveAdventure = {
  stars: Record<string, number>; // clé `${worldId}:${level}`, valeur 0-3 (la meilleure)
};

export type SaveDaily = { date: string; best: number; played: number };

export type SaveV4 = {
  version: 4;
  settings: SaveSettingsV4;
  progress: SaveProgress;
  profile: SaveProfile;
  seenMechanics: string[];
  adventure: SaveAdventure;
  collection: Record<string, number>; // name du perso → fois trouvé comme recherché
  daily: SaveDaily | null;
};

export const TIERS: readonly Tier[] = ["easy", "normal", "expert"];
export const FRAME_IDS: readonly FrameId[] = ["classic", "neon", "gold", "ice"];

// Format courant
export type Save = SaveV4;

export function defaultSave(): SaveV4 {
  return {
    version: SAVE_VERSION,
    settings: { sound: true, calm: false, frame: "classic" },
    progress: { bestScore: 0, bestLevel: 1, gamesPlayed: 0, totalFound: 0 },
    profile: { tier: null },
    seenMechanics: [],
    adventure: { stars: {} },
    collection: {},
    daily: null,
  };
}

export const starsKey = (worldId: string, level: number) => `${worldId}:${level}`;
