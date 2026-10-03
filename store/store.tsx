import { create } from "zustand";
import { CharacterDetails } from "../src/helpers/characters";
import { useSaveStore } from "../src/save/saveStore";
import type { LevelSpec, Tier } from "../src/engine/types";

export const gameConstants = {
  LEVEL: 1,
  TIME_LIMIT: 30000,
  POINTS_MULTIPLIER: 0.9,
  TIME_MULTIPLIER: 1.2,
  REGULAR_SCORE: 5,
  GOLDEN_SCORE: 15,
  COUNTDOWN: 3000,
  MINIMUM_SCORE: 5,
  DECREASE_SCORE: -5,
  MAX_PLAY_TIME: 60,
};

export enum GameStateEnum {
  NONE = "NONE",
  INIT = "INIT",
  CHOOSE_PROFILE = "CHOOSE_PROFILE", // fenêtre « Qui joue ? » avant la partie
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  END = "END",
  FINISH = "FINISH",
  RESET = "RESET",
  GAME_OVER = "GAME_OVER",
}

type AnimateTime = "-" | "+" | "";

export type GameStats = {
  found: number;
  misses: number;
  fastestFoundMs: number | null; // entre l'apparition du niveau et le bon toucher
};

// Résultat enregistré dans la sauvegarde à la fin de la partie
export type GameRecord = {
  score: number;
  level: number;
  isNewRecord: boolean;
  bestScore: number;
};

type GameState = {
  runSeed: number; // graine de la partie : avec level et tier, fixe tout le niveau
  tier: Tier;
  currentSpec: LevelSpec | null;
  pauseTimer: boolean;
  wantedCharacter: CharacterDetails | null;
  animationLevelLoading?: boolean;
  debug?: boolean;
  level: number;
  gameState: GameStateEnum;
  timeLeft: number;
  score: number;
  animateTime?: AnimateTime;
  soundSrc: string;
  sound: boolean;
  stats: GameStats;
  levelShownAt: number | null;
  wantedFound: boolean; // le perso du niveau en cours a été trouvé
  gameRecord: GameRecord | null; // non nul une fois la partie enregistrée
};

export type GameActions = {
  startRun: (run: { runSeed: number; tier: Tier; level: number }) => void;
  setCurrentSpec: (spec: LevelSpec) => void;
  setPauseTimer: (pause: boolean) => void;
  setGameState: (gameState: GameStateEnum) => void;
  setAnimationLevelLoading: (animationLevelLoading: boolean) => void;
  setLevel: (level: number) => void;
  setScore: (score: number) => void;
  setTimeLeft: (timeLeft: number) => void;
  setTimeLeftValue: (timeLeft: number) => void;
  setClearGameStore: () => void;
  setSound: (sound: boolean) => void;
  setSoundSrc: (soundSrc: string) => void;
  recordFound: () => void;
  recordMiss: () => void;
  submitGameResult: () => void;
};

export type GameStore = GameState & GameActions;

export const defaultInitState: GameState = {
  runSeed: 0,
  tier: "normal",
  currentSpec: null,
  pauseTimer: false,
  wantedCharacter: null,
  animationLevelLoading: false,
  debug: false,
  level: 1,
  gameState: GameStateEnum.INIT,
  timeLeft: 0,
  score: 0,
  animateTime: "",
  sound: useSaveStore.getState().save.settings.sound,
  soundSrc: "",
  stats: { found: 0, misses: 0, fastestFoundMs: null },
  levelShownAt: null,
  wantedFound: false,
  gameRecord: null,
};

const now = () => performance.now();

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaultInitState,
  setSoundSrc: (data) => set({soundSrc: data}),
  setSound: (data) => {
    set({ sound: data });
    useSaveStore.getState().setSound(data);
  },
  startRun: ({ runSeed, tier, level }) =>
    set({ runSeed, tier, level, currentSpec: null }),
  setCurrentSpec: (spec) =>
    set({ currentSpec: spec, wantedCharacter: spec.wanted, wantedFound: false }),
  setPauseTimer: (pause: boolean) => set({ pauseTimer: pause }),
  setLevel: (level: number) => set({ level: get().level + level }),
  setGameState: (gameState: GameStateEnum) => set({ gameState }),
  setAnimationLevelLoading: (animationLevelLoading: boolean) =>
    set({
      animationLevelLoading,
      levelShownAt: animationLevelLoading ? null : now(),
    }),
  setScore: (score: number) =>
    set({ score: get().score + score <= 0 ? 0 : get().score + score }),
  setTimeLeft: (timeLeft: number) =>
    set({
      timeLeft:
        get().timeLeft + timeLeft <= 0
          ? 0
          : get().timeLeft + timeLeft >= gameConstants.MAX_PLAY_TIME
          ? gameConstants.MAX_PLAY_TIME
          : get().timeLeft + timeLeft,
    }),
  setTimeLeftValue: (timeLeft: number) => set({ timeLeft: timeLeft }),
  setClearGameStore: () =>
    set({ ...defaultInitState, stats: { ...defaultInitState.stats }, sound: get().sound }),
  recordFound: () => {
    const { stats, levelShownAt } = get();
    const elapsed = levelShownAt === null ? null : Math.round(now() - levelShownAt);
    set({
      wantedFound: true,
      stats: {
        ...stats,
        found: stats.found + 1,
        fastestFoundMs:
          elapsed === null
            ? stats.fastestFoundMs
            : Math.min(elapsed, stats.fastestFoundMs ?? Infinity),
      },
    });
  },
  recordMiss: () => {
    const { stats } = get();
    set({ stats: { ...stats, misses: stats.misses + 1 } });
  },
  // Une seule fois par partie
  submitGameResult: () => {
    if (get().gameRecord) return;
    const { score, level, stats } = get();
    const outcome = useSaveStore
      .getState()
      .recordGame({ score, level, found: stats.found });
    set({
      gameRecord: {
        score,
        level,
        isNewRecord: outcome.isNewRecord,
        bestScore: outcome.bestScore,
      },
    });
  },
}));

// Le réglage son vient de la sauvegarde, chargée en asynchrone au démarrage
useSaveStore.subscribe((state) => {
  const sound = state.save.settings.sound;
  if (useGameStore.getState().sound !== sound) useGameStore.setState({ sound });
});
