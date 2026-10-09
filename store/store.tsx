import { create } from "zustand";
import { CharacterDetails } from "../src/helpers/characters";
import { useSaveStore } from "../src/save/saveStore";
import type { LevelSpec, Tier } from "../src/engine/types";
import { mechanicsOf } from "../src/engine/rules";
import { bonusRemainingMs, newMechanics, resumeBonusAt } from "../src/game/session";
import { advanceMission, MISSION_GOAL, nextTime } from "../src/game/modes";
import type { GameMode } from "../src/game/modes";
import { getWorld, WORLDS } from "../src/content/worlds";
import type { WorldId } from "../src/content/worlds";
import { isWorldUnlocked, todayISO } from "../src/content/progress";
import { entersNewPhase, globalStep, runSummary, stepInfo, stepStars } from "../src/game/adventureRun";
import type { PhaseId, StepResult } from "../src/game/adventureRun";
import { advanceStreaks, emptyStreaks, type StreakEvent, type Streaks } from "../src/game/streaks";
import { dailyRewardClaimed, dailyRewardPerson } from "../src/game/dailyReward";
import { isPortraitUnlocked } from "../src/content/portraitUnlocks";

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
  won: boolean; // Aventure : au moins une étape franchie
  stars: number; // Aventure : étoiles gagnées pendant la partie
  adventure: AdventureRunRecord | null;
  newCharacters: CharacterDetails[]; // persos attrapés pour la 1re fois
  dailyDate: string | null;
  dailyBest: number;
  earnedStars: number;
  streaks: Streaks;
  dailyReward: { person: CharacterDetails | null; claimedBefore: boolean; unlocked: boolean; stars: number } | null;
};

// Bilan d'une partie d'Aventure (continue)
export type AdventureRunRecord = {
  startStep: number;
  endStep: number; // étape en cours à l'arrêt
  steps: StepResult[]; // étapes franchies, dans l'ordre
  stepsCleared: number;
  starsEarned: number;
  phases: PhaseId[]; // mondes parcourus, dans l'ordre
  discoveredWorlds: WorldId[]; // mondes ouverts pendant la partie
};

export type StepToast = { key: number; level: number; stars: number };
export type WorldBanner = { key: number; phase: PhaseId };

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
  adventureLevel: number; // Aventure : étape dans le monde (1 à 20)
  adventureStep: number; // Aventure : étape globale, puis Grand Mélange après les mondes actifs
  startStep: number; // Aventure : étape de départ de la partie
  missionFound: number; // Aventure : avis trouvés dans l'étape en cours (0 à 5)
  stepPlayMs: number; // Aventure : temps de jeu réel de l'étape en cours (hors pauses)
  runSteps: StepResult[]; // Aventure : étapes franchies pendant la partie
  runPhases: PhaseId[]; // Aventure : mondes parcourus
  lockedAtStart: WorldId[]; // Aventure : mondes fermés au départ de la partie
  stepToast: StepToast | null; // bandeau « Étape 3 ★★☆ »
  worldBanner: WorldBanner | null; // bandeau « Bienvenue… » : chrono en pause
  calm: boolean; // pas de chrono (Infini et Aventure)
  dailyDate: string | null;
  newCharacters: CharacterDetails[];
  unlockQueue: CharacterDetails[];
  runSeed: number; // graine de la partie : avec level et tier, fixe tout le niveau
  tier: Tier;
  currentSpec: LevelSpec | null;
  pauseTimer: boolean;
  obstacleBlocking: boolean; // masque de premier plan : touchers bloqués, chrono et foule toujours actifs
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
  streaks: Streaks;
  bonusToast: { key: number; stars: number } | null;
  dailyReward: GameRecord["dailyReward"];
  runStars: number;
  foundIds: number[]; // cibles déjà trouvées dans le niveau en cours
  isDiscovery: boolean; // le niveau contient une mécanique jamais vue
  freshMechanics: string[]; // mécaniques nouvelles du niveau (vide hors découverte)
  bonusEndsAt: number | null; // fin du goldRush en cours (Date.now()), null sinon
  bonusPausedMs: number | null; // goldRush en pause (app en arrière-plan) : temps restant
  bonusDone: boolean; // le goldRush du niveau est terminé
};

export type GameActions = {
  startRun: (run: RunConfig) => void;
  dismissUnlock: () => void;
  // Aventure : temps de jeu réel (chrono en marche, ou qui le serait en mode calme)
  addPlayTime: (ms: number) => void;
  hideWorldBanner: () => void;
  // Niveau terminé, après l'animation : niveau suivant ou fin de mission
  advanceLevel: () => void;
  setCurrentSpec: (spec: LevelSpec) => void;
  setPauseTimer: (pause: boolean) => void;
  setObstacleBlocking: (blocked: boolean) => void;
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
  adventureStep: 1,
  startStep: 1,
  missionFound: 0,
  stepPlayMs: 0,
  runSteps: [],
  runPhases: [],
  lockedAtStart: [],
  stepToast: null,
  worldBanner: null,
  calm: false,
  dailyDate: null,
  newCharacters: [],
  unlockQueue: [],
  runSeed: 0,
  tier: "normal",
  currentSpec: null,
  pauseTimer: false,
  obstacleBlocking: false,
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
  streaks: emptyStreaks(),
  bonusToast: null,
  dailyReward: null,
  runStars: 0,
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
  startRun: ({ runSeed, tier, level, mode = "endless", worldId = null, adventureLevel = 1, calm = false, dailyDate = null }) => {
    const step = mode === "adventure" && worldId ? globalStep(worldId, adventureLevel) : 1;
    const save = useSaveStore.getState().save;
    const date = mode === "daily" ? dailyDate ?? todayISO() : null;
    set({
      runSeed,
      tier,
      level,
      currentSpec: null,
      mode,
      worldId,
      adventureLevel,
      adventureStep: step,
      startStep: step,
      // mode calme : Infini et Aventure ; le Défi du jour garde son chrono
      calm: mode !== "daily" && calm,
      dailyDate: date,
      missionFound: 0,
      stepPlayMs: 0,
      runSteps: [],
      runPhases: mode === "adventure" ? [stepInfo(step).phase] : [],
      lockedAtStart: WORLDS.filter((w) => !isWorldUnlocked(save, w)).map((w) => w.id),
      stepToast: null,
      worldBanner: null,
      newCharacters: [],
      unlockQueue: [],
      runStars: 0,
      streaks: emptyStreaks(),
      bonusToast: null,
      dailyReward: date ? { person: dailyRewardPerson(save, date), claimedBefore: dailyRewardClaimed(save, date), unlocked: false, stars: 0 } : null,
    });
  },
  dismissUnlock: () => {
    const { unlockQueue, gameState } = get();
    if (!unlockQueue.length) return;
    const remaining = unlockQueue.slice(1);
    set({ unlockQueue: remaining });
    if (remaining.length || gameState !== GameStateEnum.PAUSED) return;
    set({ gameState: GameStateEnum.PLAYING, pauseTimer: false });
    // The capture animation may have finished while the reveal was open.
    // Its delayed callback checks the old level, so only this advance can run.
    if (get().wantedFound) get().advanceLevel();
  },
  addPlayTime: (ms) => {
    if (get().mode !== "adventure" || !(ms > 0)) return;
    set({ stepPlayMs: get().stepPlayMs + ms });
  },
  hideWorldBanner: () => {
    if (get().worldBanner) set({ worldBanner: null });
  },
  advanceLevel: () => {
    const { mode, missionFound, gameState, level, adventureStep, runPhases } = get();
    if (gameState !== GameStateEnum.PLAYING) return;
    if (mode === "adventure" && missionFound >= MISSION_GOAL) {
      // étape franchie : la suivante, sans écran intermédiaire (monde suivant après la 10)
      const next = stepInfo(adventureStep + 1);
      const newPhase = entersNewPhase(adventureStep);
      set({
        adventureStep: next.step,
        worldId: next.worldId,
        adventureLevel: next.level,
        missionFound: 0,
        stepPlayMs: 0,
        level: level + 1,
        ...(newPhase && {
          worldBanner: { key: next.step, phase: next.phase },
          stepToast: null,
          runPhases: [...runPhases, next.phase],
        }),
      });
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
  setObstacleBlocking: (blocked: boolean) => set({ obstacleBlocking: blocked }),
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
    if (delta < 0 && get().unlockQueue.length) return;
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
      updateStreaks({ type: "found", elapsedMs: levelShownAt === null ? null : Math.round(now() - levelShownAt) });
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
    if (get().mode === "adventure" && get().missionFound >= MISSION_GOAL) get().advanceLevel();
    else set({ level: level + 1 });
  },
  recordMiss: () => {
    const { stats } = get();
    set({ stats: { ...stats, misses: stats.misses + 1 } });
    updateStreaks({ type: "miss" });
  },
  // Une seule fois par partie
  submitGameResult: () => {
    if (get().gameRecord) return;
    // partie finie sans fermer la carte de découverte : mécaniques vues quand même
    get().markDiscoverySeen();
    const { score, level, stats, mode, calm, adventureLevel, newCharacters } = get();
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
      adventure: null,
      newCharacters,
      dailyDate: null,
      dailyBest: 0,
      earnedStars: get().runStars,
      streaks: get().streaks,
      dailyReward: get().dailyReward,
    };
    if (mode === "adventure") {
      // les étoiles sont déjà enregistrées à chaque étape franchie
      const { runSteps, startStep, adventureStep, runPhases, lockedAtStart } = get();
      const summary = runSummary(runSteps);
      const nowSave = useSaveStore.getState().save;
      record.level = adventureLevel;
      record.won = summary.cleared > 0;
      record.stars = summary.stars;
      record.adventure = {
        startStep,
        endStep: adventureStep,
        steps: runSteps,
        stepsCleared: summary.cleared,
        starsEarned: summary.stars,
        phases: runPhases,
        discoveredWorlds: lockedAtStart.filter((id) => {
          const w = getWorld(id);
          return w !== undefined && isWorldUnlocked(nowSave, w);
        }),
      };
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
  const unlockedBefore = isPortraitUnlocked(save.save, wanted.name);
  save.recordCollection(wanted.name);
  if (!unlockedBefore && isPortraitUnlocked(useSaveStore.getState().save, wanted.name)) queueUnlock(wanted);
  useGameStore.setState({ runStars: useGameStore.getState().runStars + 1 });
  if (before > 0) return;
  const { newCharacters } = useGameStore.getState();
  if (!newCharacters.some((c) => c.name === wanted.name))
    useGameStore.setState({ newCharacters: [...newCharacters, wanted] });
}

function updateStreaks(event: StreakEvent) {
  const current = useGameStore.getState();
  const next = advanceStreaks(current.streaks, event);
  const bonus = next.reward ? useSaveStore.getState().awardStreakBonus(next.reward) : 0;
  useGameStore.setState({ streaks: next.streaks, runStars: current.runStars + bonus,
    ...(bonus > 0 && { bonusToast: { key: ++bonusKey, stars: bonus } }),
  });
  if (current.mode !== "daily" || !current.dailyDate || current.dailyReward?.claimedBefore || current.dailyReward?.unlocked) return;
  const reward = useSaveStore.getState().claimDailyReward(current.dailyDate, next.streaks.found);
  if (reward?.person) queueUnlock(reward.person);
  if (reward) useGameStore.setState({
    dailyReward: { ...reward, claimedBefore: false, unlocked: true },
    runStars: useGameStore.getState().runStars + reward.stars,
  });
}

function queueUnlock(character: CharacterDetails) {
  const state = useGameStore.getState();
  if (state.gameState !== GameStateEnum.PLAYING && !(state.gameState === GameStateEnum.PAUSED && state.unlockQueue.length)) return;
  if (state.unlockQueue.some(portrait => portrait.name === character.name)) return;
  useGameStore.setState({ unlockQueue: [...state.unlockQueue, character], gameState: GameStateEnum.PAUSED, pauseTimer: true });
}

let bonusKey = 0;

let toastKey = 0;

function countMissionStep() {
  const { mode, missionFound } = useGameStore.getState();
  if (mode !== "adventure" || missionFound >= MISSION_GOAL) return;
  const { found, done } = advanceMission(missionFound, MISSION_GOAL);
  useGameStore.setState({ missionFound: found });
  if (done) completeStep();
}

// Étape franchie : étoiles enregistrées tout de suite, bandeau « Étape 3 ★★☆ »
function completeStep() {
  const { adventureStep, stepPlayMs, runSteps } = useGameStore.getState();
  const info = stepInfo(adventureStep);
  const stars = stepStars(stepPlayMs);
  if (info.worldId) useSaveStore.getState().recordStars(info.worldId, info.level, stars);
  useGameStore.setState({
    runSteps: [...runSteps, { step: info.step, worldId: info.worldId, level: info.level, stars }],
    stepPlayMs: 0,
    stepToast: { key: ++toastKey, level: info.level, stars },
  });
}

// Le réglage son vient de la sauvegarde, chargée en asynchrone au démarrage
useSaveStore.subscribe((state) => {
  const sound = state.save.settings.sound;
  if (useGameStore.getState().sound !== sound) useGameStore.setState({ sound });
});
