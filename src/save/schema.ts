// Sauvegarde locale du joueur. Pour faire évoluer le format :
// 1. créer SaveV(n+1),
// 2. passer SAVE_VERSION et `Save` à la nouvelle version,
// 3. ajouter la migration n → n+1 dans migrations.ts.
import type { Tier } from "../engine/types";

export const SAVE_VERSION = 10 as const;
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

// v5 : plus de fenêtre « Qui joue ? » ; seulement Enfant (easy) ou Normal, normal par défaut
export type PlayerTier = Extract<Tier, "easy" | "normal">;
export type SaveProfileV5 = { tier: PlayerTier };

export type SaveV5 = Omit<SaveV4, "version" | "profile"> & {
  version: 5;
  profile: SaveProfileV5;
};

// v6 : Aventure en partie continue. Un monde s'ouvre quand l'étape 10 du précédent
// est franchie ; ceux déjà ouverts par l'ancienne règle (total d'étoiles) sont gardés ici.
export type SaveAdventureV6 = SaveAdventure & { unlocked?: string[] };

export type SaveV6 = Omit<SaveV5, "version" | "adventure"> & {
  version: 6;
  adventure: SaveAdventureV6;
};

// v7 : 20 étapes par monde. Les mondes déjà accessibles dans la campagne à dix
// étapes sont inscrits dans unlocked ; les clés d'étoiles ne sont jamais déplacées.
export type SaveV7 = Omit<SaveV6, "version"> & { version: 7 };

// v8: spendable stars and purchased portraits, separate from adventure ratings.
export type SaveV8 = Omit<SaveV7, "version"> & {
  version: 8;
  wallet: { stars: number; onlineRewards: Record<string, number> };
  purchasedPeople: string[];
};

export type SaveGoals = { person: string | null; contract: string | null; completedContracts: string[] };
export type SaveV9 = Omit<SaveV8, "version"> & { version: 9; goals: SaveGoals };
// v10: automatic in-game bonuses and daily portrait rewards replace selected goals.
export type SaveV10 = Omit<SaveV9, "version" | "goals"> & { version: 10; dailyRewards: Record<string, string | null> };

export const ADVENTURE_WORLD_IDS: readonly string[] = ["animaux", "ocean", "dinos", "halloween", "espace"];

export const TIERS: readonly Tier[] = ["easy", "normal", "expert"];
export const PLAYER_TIERS: readonly PlayerTier[] = ["easy", "normal"];
export const DEFAULT_TIER: PlayerTier = "normal";
export const FRAME_IDS: readonly FrameId[] = ["classic", "neon", "gold", "ice"];

// Format courant
export type Save = SaveV10;

export function defaultSave(): Save {
  return {
    version: SAVE_VERSION,
    settings: { sound: true, calm: false, frame: "classic" },
    progress: { bestScore: 0, bestLevel: 1, gamesPlayed: 0, totalFound: 0 },
    profile: { tier: DEFAULT_TIER },
    seenMechanics: [],
    adventure: { stars: {}, unlocked: [] },
    collection: {},
    daily: null,
    wallet: { stars: 0, onlineRewards: {} },
    purchasedPeople: [],
    dailyRewards: {},
  };
}

export const starsKey = (worldId: string, level: number) => `${worldId}:${level}`;
