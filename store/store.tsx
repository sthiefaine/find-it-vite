import { create } from "zustand";
import { CharacterDetails } from "../src/helpers/characters";
import { GridCell } from "../src/helpers/gameUtils";

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
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  END = "END",
  FINISH = "FINISH",
  RESET = "RESET",
  GAME_OVER = "GAME_OVER",
}

type AnimateTime = "-" | "+" | "";

type GameState = {
  grid: GridCell[] | null;
  pauseTimer: boolean;
  wantedCharacter: CharacterDetails | null;
  animationLevelLoading?: boolean;
  debug?: boolean;
  level: number;
  gameState: GameStateEnum;
  timeLeft: number;
  score: number;
  animateTime?: AnimateTime;
  highScoreSubmitted?: boolean;
  isHighScore?: boolean;
  soundSrc: string;
  sound: boolean;
  maxCellPerRow: number;

};

export type GameActions = {
  setGrid: (GridCell: GridCell[] | null) => void;
  setPauseTimer: (pause: boolean) => void;
  setWantedCharacter: (data: CharacterDetails | null) => void;
  setGameState: (gameState: GameStateEnum) => void;
  setAnimationLevelLoading: (animationLevelLoading: boolean) => void;
  setLevel: (level: number) => void;
  setScore: (score: number) => void;
  setTimeLeft: (timeLeft: number) => void;
  setTimeLeftValue: (timeLeft: number) => void;
  setClearGameStore: () => void;
  setMaxCellPerRow: (maxCellPerRow: number) => void;
  setSound: (sound: boolean) => void;
  setSoundSrc: (soundSrc: string) => void;

};

export type GameStore = GameState & GameActions;

export const defaultInitState: GameState = {
  grid: null,
  pauseTimer: false,
  wantedCharacter: null,
  animationLevelLoading: false,
  debug: true,
  level: 6,
  gameState: GameStateEnum.INIT,
  timeLeft: 0,
  score: 0,
  animateTime: "",
  maxCellPerRow: 10,
  sound: true,
  soundSrc: "",
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaultInitState,
  setSoundSrc: (data) => set({soundSrc: data}),
  setSound: (data) => set({sound: data}),
  setGrid: (data) => set({ grid: data }),
  setMaxCellPerRow: (data) => set({ maxCellPerRow: data }),
  setPauseTimer: (pause: boolean) => set({ pauseTimer: pause }),
  setWantedCharacter: (data: CharacterDetails | null) =>
    set({ wantedCharacter: data }),
  setLevel: (level: number) => set({ level: get().level + level }),
  setGameState: (gameState: GameStateEnum) => set({ gameState }),
  setAnimationLevelLoading: (animationLevelLoading: boolean) =>
    set({ animationLevelLoading }),
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
  setClearGameStore: () => set({ ...defaultInitState, sound: get().sound }),
}));
