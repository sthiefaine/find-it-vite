import { create } from "zustand";
import { CharacterDetails } from "../src/helpers/characters";
import { useSaveStore } from "../src/save/saveStore";
import type { LevelSpec, Tier } from "../src/engine/types";
import { mechanicsOf } from "../src/engine/rules";
import { bonusRemainingMs, newMechanics, resumeBonusAt } from "../src/game/session";
import { advanceMission, MISSION_GOAL, missionStars, nextTime } from "../src/game/modes";
import type { GameMode } from "../src/game/modes";
import type { WorldId } from "../src/content/worlds";
import { todayISO } from "../src/content/progress";

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

export type GameStats = {
  found: number;
  misses: number;
  fastestFoundMs: number | null; // entre l'apparition du niveau et le bon toucher
};

// Résultat enregistré dans la sauvegarde à la fin de la partie
export type GameRecord = {
  mode: GameMode;
  score: number;
  level: number;
  isNewRecord: boolean;
  bestScore: number;
  calm: boolean; // Infini sans chrono : pas de record
  won: boolean; // Aventure : mission réussie
  stars: number; // Aventure : 0 à 3
  newCharacters: CharacterDetails[]; // persos attrapés pour la 1re fois
  dailyDate: string | null;
  dailyBest: number;
};

export type RunConfig = {
  runSeed: number;
  tier: Tier;
  level: number;
  mode?: GameMode;
  worldId?: WorldId | null;
  adventureLevel?: number;
  calm?: boolean;
  dailyDate?: string | null;
};

type GameState = {
  mode: GameMode;
  worldId: WorldId | null; // Aventure
  adventureLevel: number; // Aventure : niveau du monde (1 à 10)
  missionFound: number; // Aventure : avis trouvés (0 à 5)
  calm: boolean; // Infini sans chrono
  dailyDate: string | null;
  newCharacters: CharacterDetails[];
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
  foundIds: number[]; // cibles déjà trouvées dans le niveau en cours
  isDiscovery: boolean; // le niveau contient une mécanique jamais vue
  freshMechanics: string[]; // mécaniques nouvelles du niveau (vide hors découverte)
  bonusEndsAt: number | null; // fin du goldRush en cours (Date.now()), null sinon
  bonusPausedMs: number | null; // goldRush en pause (app en arrière-plan) : temps restant
  bonusDone: boolean; // le goldRush du niveau est terminé
};

export type GameActions = {
  startRun: (run: RunConfig) => void;
  // Niveau terminé, après l'animation : niveau suivant ou fin de mission
  advanceLevel: () => void;
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
  // Cible trouvée : levelDone met à jour wantedFound et le « plus rapide »
  recordTargetFound: (id: number, levelDone: boolean) => void;
  recordMiss: () => void;
  startBonus: (durationS: number) => void;
  // Fin du bonus (chrono écoulé ou tout trouvé) : niveau suivant, une seule fois
  endBonus: () => void;
  // App en arrière-plan / de retour : le goldRush garde son temps restant
  pauseBonus: () => void;
  resumeBonus: () => void;
  // Carte de découverte fermée : les mécaniques du niveau sont désormais vues
  markDiscoverySeen: () => void;
  submitGameResult: () => void;
};

export type GameStore = GameState & GameActions;

export const defaultInitState: GameState = {
  mode: "endless",
  worldId: null,
  adventureLevel: 1,
  missionFound: 0,
  calm: false,
  dailyDate: null,
  newCharacters: [],
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
  foundIds: [],
  isDiscovery: false,
  freshMechanics: [],
  bonusEndsAt: null,
  bonusPausedMs: null,
  bonusDone: false,
};

const now = () => performance.now();

type Discovery = { isDiscovery: boolean; freshMechanics: string[] };

// Découverte calculée une seule fois par niveau (StrictMode peut rejouer setCurrentSpec).
// Rien n'est marqué « vu » ici : voir markDiscoverySeen.
let lastDiscovery: { spec: LevelSpec; discovery: Discovery } | null = null;

function discoveryOf(spec: LevelSpec): Discovery {
  const prev = lastDiscovery?.spec;
  if (prev && prev.seed === spec.seed && prev.index === spec.index && prev.layout === spec.layout)
    return lastDiscovery!.discovery;
  const fresh = newMechanics(mechanicsOf(spec), useSaveStore.getState().save.seenMechanics);
  const discovery = { isDiscovery: fresh.length > 0, freshMechanics: fresh };
  lastDiscovery = { spec, discovery };
  return discovery;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaultInitState,
  setSoundSrc: (data) => set({soundSrc: data}),
  setSound: (data) => {
    set({ sound: data });
    useSaveStore.getState().setSound(data);
  },
  startRun: ({ runSeed, tier, level, mode = "endless", worldId = null, adventureLevel = 1, calm = false, dailyDate = null }) =>
    set({
      runSeed,
      tier,
      level,
      currentSpec: null,
      mode,
      worldId,
      adventureLevel,
      calm: mode === "endless" && calm,
      dailyDate,
      missionFound: 0,
      newCharacters: [],
    }),
  advanceLevel: () => {
    const { mode, missionFound, gameState, level } = get();
    if (gameState !== GameStateEnum.PLAYING) return;
    if (mode === "adventure" && missionFound >= MISSION_GOAL) {
      set({ gameState: GameStateEnum.FINISH });
      return;
    }
    set({ level: level + 1 });
  },
  setCurrentSpec: (spec) => {
    const { isDiscovery, freshMechanics } = discoveryOf(spec);
    set({
      currentSpec: spec,
      wantedCharacter: spec.wanted,
      wantedFound: false,
      foundIds: [],
      bonusEndsAt: null,
      bonusPausedMs: null,
      bonusDone: false,
      isDiscovery,
      freshMechanics,
    });
  },
  markDiscoverySeen: () => {
    const { freshMechanics } = get();
    if (freshMechanics.length > 0) useSaveStore.getState().markMechanicsSeen(freshMechanics);
  },
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
  // Mode calme : le chrono ne bouge pas (ni bonus ni pénalité)
  setTimeLeft: (delta: number) => {
    if (get().calm) return;
    set({ timeLeft: nextTime(get().mode, get().timeLeft, delta) });
  },
  setTimeLeftValue: (timeLeft: number) => set({ timeLeft: timeLeft }),
  setClearGameStore: () => {
    lastDiscovery = null;
    set({
      ...defaultInitState,
      stats: { ...defaultInitState.stats },
      freshMechanics: [],
      sound: get().sound,
    });
  },
  recordTargetFound: (id, levelDone) => {
    const { stats, levelShownAt, foundIds, currentSpec, wantedFound } = get();
    if (foundIds.includes(id)) return;
    // un avis réussi (hors bonus doré) : collection et progression de mission
    if (levelDone && !wantedFound && currentSpec && currentSpec.rule !== "goldRush") {
      collect(currentSpec.wanted);
      countMissionStep();
    }
    // « plus rapide » : temps pour finir un niveau, hors bonus
    // niveau réussi sans fermer la carte de découverte : mécaniques vues quand même
    if (levelDone) get().markDiscoverySeen();
    const timed = levelDone && currentSpec?.rule !== "goldRush";
    const elapsed =
      !timed || levelShownAt === null ? null : Math.round(now() - levelShownAt);
    set({
      foundIds: [...foundIds, id],
      wantedFound: get().wantedFound || levelDone,
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
  startBonus: (durationS) => {
    if (get().bonusDone || get().bonusEndsAt !== null) return;
    set({ bonusEndsAt: Date.now() + durationS * 1000, bonusPausedMs: null });
  },
  pauseBonus: () => {
    const { bonusEndsAt, bonusPausedMs, bonusDone } = get();
    if (bonusDone || bonusEndsAt === null || bonusPausedMs !== null) return;
    set({ bonusPausedMs: bonusRemainingMs(bonusEndsAt, Date.now()) });
  },
  resumeBonus: () => {
    const { bonusEndsAt, bonusPausedMs } = get();
    if (bonusEndsAt === null || bonusPausedMs === null) return;
    set({ bonusEndsAt: resumeBonusAt(bonusPausedMs, Date.now()), bonusPausedMs: null });
  },
  endBonus: () => {
    const { bonusDone, currentSpec, gameState, level } = get();
    if (bonusDone || currentSpec?.rule !== "goldRush") return;
    set({ bonusEndsAt: null, bonusPausedMs: null, bonusDone: true });
    get().markDiscoverySeen();
    if (gameState !== GameStateEnum.PLAYING) return;
    // le bonus compte comme un avis en Aventure
    countMissionStep();
    if (get().mode === "adventure" && get().missionFound >= MISSION_GOAL)
      set({ gameState: GameStateEnum.FINISH });
    else set({ level: level + 1 });
  },
  recordMiss: () => {
    const { stats } = get();
    set({ stats: { ...stats, misses: stats.misses + 1 } });
  },
  // Une seule fois par partie
  submitGameResult: () => {
    if (get().gameRecord) return;
    // partie finie sans fermer la carte de découverte : mécaniques vues quand même
    get().markDiscoverySeen();
    const { score, level, stats, mode, calm, missionFound, timeLeft, worldId, adventureLevel, newCharacters } =
      get();
    const save = useSaveStore.getState();
    const record: GameRecord = {
      mode,
      score,
      level,
      isNewRecord: false,
      bestScore: save.save.progress.bestScore,
      calm,
      won: false,
      stars: 0,
      newCharacters,
      dailyDate: null,
      dailyBest: 0,
    };
    if (mode === "adventure") {
      record.level = adventureLevel;
      record.won = missionFound >= MISSION_GOAL;
      record.stars = missionStars(record.won, timeLeft);
      if (record.won && worldId) save.recordStars(worldId, adventureLevel, record.stars);
    } else if (mode === "daily") {
      // le Défi a son propre meilleur score : il ne touche pas au record Infini
      const date = get().dailyDate ?? todayISO();
      save.recordDaily(date, score);
      const daily = useSaveStore.getState().save.daily;
      record.dailyDate = date;
      record.dailyBest = daily && daily.date === date ? daily.best : score;
    } else if (mode === "endless" && !calm) {
      const outcome = save.recordGame({ score, level, found: stats.found });
      record.isNewRecord = outcome.isNewRecord;
      record.bestScore = outcome.bestScore;
    }
    set({ gameRecord: record });
  },
}));

// Ajoute le recherché à la collection ; retient s'il est attrapé pour la 1re fois
function collect(wanted: CharacterDetails) {
  const save = useSaveStore.getState();
  const before = save.save.collection[wanted.name] ?? 0;
  save.recordCollection(wanted.name);
  if (before > 0) return;
  const { newCharacters } = useGameStore.getState();
  if (!newCharacters.some((c) => c.name === wanted.name))
    useGameStore.setState({ newCharacters: [...newCharacters, wanted] });
}

function countMissionStep() {
  const { mode, missionFound } = useGameStore.getState();
  if (mode !== "adventure") return;
  useGameStore.setState({ missionFound: advanceMission(missionFound, MISSION_GOAL).found });
}

// Le réglage son vient de la sauvegarde, chargée en asynchrone au démarrage
useSaveStore.subscribe((state) => {
  const sound = state.save.settings.sound;
  if (useGameStore.getState().sound !== sound) useGameStore.setState({ sound });
});
