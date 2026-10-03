/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from "react";
import { GameStateEnum, useGameStore } from "../../../../../store/store";
import { useShallow } from "zustand/shallow";
import { charactersDetails } from "../../../../helpers/characters";
import { useLocation } from "react-router-dom";
import { dailySeed, generateLevel, randomSeed, seedFromCode } from "../../../../engine";
import type { Rule, Tier } from "../../../../engine";
import type { CharacterDetails } from "../../../../helpers/characters";
import { useSaveStore } from "../../../../save/saveStore";
import { TIERS } from "../../../../save/schema";
import { tickClock } from "../../../../game/session";
import {
  levelTarget,
  MAX_PLAY_TIME_S,
  MISSION_TIME_S,
  missionSeed,
  readModeParams,
} from "../../../../game/modes";
import type { GameMode } from "../../../../game/modes";
import { getWorld } from "../../../../content/worlds";
import { todayISO } from "../../../../content/progress";

const TICK_MS = 100;
const BONUS_GRACE_MS = 150;

// Debug : /game?seed=123&level=8 (seed en nombre ou en code), &tier=expert en option
export function readDebugParams(search: string): {
  seed?: number;
  level?: number;
  tier?: Tier;
} {
  const params = new URLSearchParams(search);
  const rawSeed = params.get("seed");
  const rawLevel = params.get("level");
  const rawTier = params.get("tier");
  let seed: number | undefined;
  if (rawSeed) {
    seed = /^\d+$/.test(rawSeed)
      ? Number(rawSeed) >>> 0
      : seedFromCode(rawSeed) ?? undefined;
  }
  const level = rawLevel && /^\d+$/.test(rawLevel) ? Math.max(1, Number(rawLevel)) : undefined;
  const tier = TIERS.includes(rawTier as Tier) ? (rawTier as Tier) : undefined;
  return { seed, level, tier };
}

// Persos possibles : ceux du monde en Aventure, les 12 animaux en Défi
function poolFor(mode: GameMode, worldId: string | null): CharacterDetails[] {
  if (mode === "adventure" && worldId) return getWorld(worldId)?.characters ?? charactersDetails;
  if (mode === "daily") return getWorld("animaux")?.characters ?? charactersDetails;
  return charactersDetails;
}

const ADVENTURE_RULES: Rule[] = ["classic", "memory", "silhouette", "oddOneOut", "findAll"];

export function IsPlaying() {
  const {
    gameState,
    setGameState,
    setTimeLeft,
    setClearGameStore,
    timeLeft,
    setAnimationLevelLoading,
    setTimeLeftValue,
    setCurrentSpec,
    startRun,
    level,
    animationLevelLoading,
    submitGameResult,
    pauseTimer,
    bonusEndsAt,
    currentSpec,
    startBonus,
    endBonus,
  } = useGameStore(
    useShallow((state) => {
      return {
        gameState: state.gameState,
        setGameState: state.setGameState,
        setTimeLeft: state.setTimeLeft,
        setClearGameStore: state.setClearGameStore,
        timeLeft: state.timeLeft,
        setTimeLeftValue: state.setTimeLeftValue,
        setAnimationLevelLoading: state.setAnimationLevelLoading,
        setCurrentSpec: state.setCurrentSpec,
        startRun: state.startRun,
        level: state.level,
        animationLevelLoading: state.animationLevelLoading,
        submitGameResult: state.submitGameResult,
        pauseTimer: state.pauseTimer,
        bonusEndsAt: state.bonusEndsAt,
        currentSpec: state.currentSpec,
        startBonus: state.startBonus,
        endBonus: state.endBonus,
      };
    })
  );
  const saveLoaded = useSaveStore((s) => s.loaded);
  const location = useLocation();
  const pathName = location.pathname;
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Étape de la partie pour laquelle le niveau a été généré
  const setupFor = useRef<string | null>(null);

  // Le niveau courant est entièrement déterminé par (mode, runSeed, level, tier, pool)
  const setupLevel = (isInitialSetup = false) => {
    const { runSeed, tier, level, mode, worldId, adventureLevel } = useGameStore.getState();
    const world = worldId ? getWorld(worldId) : undefined;
    const target = levelTarget(mode, runSeed, level, world?.startIndex, adventureLevel);
    const spec = generateLevel(target.index, {
      seed: target.seed,
      tier,
      pool: poolFor(mode, worldId),
      // En Aventure, un bonus doré figerait le chrono des 5 avis de la mission
      ...(mode === "adventure" && { allowedRules: ADVENTURE_RULES }),
    });
    setupFor.current = `${runSeed}:${level}`;
    setCurrentSpec(spec);

    if (loadingTimer.current) clearTimeout(loadingTimer.current);
    loadingTimer.current = setTimeout(
      () => {
        loadingTimer.current = null;
        setAnimationLevelLoading(false);
      },
      isInitialSetup ? 3000 : 1000
    );
  };

  const startGame = (savedTier: Tier) => {
    const debug = readDebugParams(location.search);
    const params = readModeParams(location.search);
    setClearGameStore();
    if (params.mode === "adventure") {
      setTimeLeftValue(MISSION_TIME_S);
      startRun({
        mode: "adventure",
        worldId: params.worldId,
        adventureLevel: params.level,
        runSeed: missionSeed(params.worldId, params.level),
        tier: debug.tier ?? savedTier,
        level: 1,
      });
    } else if (params.mode === "daily") {
      const date = todayISO();
      setTimeLeftValue(MAX_PLAY_TIME_S);
      startRun({ mode: "daily", dailyDate: date, runSeed: dailySeed(date), tier: "normal", level: 1 });
    } else {
      setTimeLeftValue(MAX_PLAY_TIME_S);
      startRun({
        mode: "endless",
        calm: useSaveStore.getState().save.settings.calm,
        runSeed: debug.seed ?? randomSeed(),
        tier: debug.tier ?? savedTier,
        level: debug.level ?? 1,
      });
    }
    setupLevel(true);
    setAnimationLevelLoading(true);
    setGameState(GameStateEnum.PLAYING);
  };

  useEffect(() => {
    const { gameState, runSeed } = useGameStore.getState();
    // pas de nouveau niveau si la partie s'est terminée pendant la transition
    if (gameState === GameStateEnum.PLAYING && setupFor.current !== `${runSeed}:${level}`) {
      setAnimationLevelLoading(true);
      setupLevel();
    }
  }, [level]);

  useEffect(() => {
    if (pathName === "/game") {
      switch (gameState) {
        case GameStateEnum.NONE:
          setGameState(GameStateEnum.INIT);
          break;
        case GameStateEnum.INIT: {
          // la sauvegarde est lue en asynchrone : on attend de connaître le profil
          if (!saveLoaded) break;
          const savedTier = useSaveStore.getState().save.profile.tier;
          if (!savedTier) {
            setGameState(GameStateEnum.CHOOSE_PROFILE);
            break;
          }
          startGame(savedTier);
          break;
        }
        case GameStateEnum.RESET: {
          setClearGameStore();
          setGameState(GameStateEnum.INIT);
          break;
        }
        default:
          break;
      }
    } else {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
      setClearGameStore();
      setGameState(GameStateEnum.NONE);
    }
  }, [pathName, setGameState, gameState, saveLoaded]);

  // Autre mode ou autre niveau dans l'URL (« Niveau suivant », retour) : nouvelle partie
  const lastSearch = useRef(location.search);
  useEffect(() => {
    if (lastSearch.current === location.search) return;
    lastSearch.current = location.search;
    if (pathName !== "/game") return;
    const { gameState } = useGameStore.getState();
    if (gameState !== GameStateEnum.NONE && gameState !== GameStateEnum.CHOOSE_PROFILE)
      setGameState(GameStateEnum.RESET);
  }, [location.search]);

  // Fin de partie (chrono à 0 ou bouton Arrêter) : on enregistre le résultat
  useEffect(() => {
    if (
      pathName === "/game" &&
      (gameState === GameStateEnum.FINISH || gameState === GameStateEnum.END)
    ) {
      submitGameResult();
    }
  }, [gameState, pathName]);

  // Chrono à 0 : fin de partie
  useEffect(() => {
    if (gameState !== GameStateEnum.PLAYING) return;
    if (timeLeft < 0) setTimeLeftValue(0);
    else if (timeLeft === 0 && !animationLevelLoading) setGameState(GameStateEnum.FINISH);
  }, [gameState, timeLeft, animationLevelLoading]);

  // Décompte : arrêté pendant le chargement d'un niveau, une pause ou un bonus.
  // La fraction de seconde en cours est gardée d'une pause à l'autre.
  const clockAcc = useRef(0);
  const calm = useGameStore((s) => s.calm);
  const clockRunning =
    !calm &&
    gameState === GameStateEnum.PLAYING &&
    !animationLevelLoading &&
    !pauseTimer &&
    bonusEndsAt === null;
  useEffect(() => {
    if (gameState !== GameStateEnum.PLAYING) clockAcc.current = 0;
    if (!clockRunning) return;
    let last = performance.now();
    const interval = setInterval(() => {
      const t = performance.now();
      const { seconds, accMs } = tickClock(clockAcc.current, t - last);
      last = t;
      clockAcc.current = accMs;
      if (seconds > 0) setTimeLeft(-seconds);
    }, TICK_MS);
    return () => {
      // on garde le temps écoulé depuis le dernier tick
      clockAcc.current = tickClock(clockAcc.current, Math.min(performance.now() - last, TICK_MS)).accMs;
      clearInterval(interval);
    };
  }, [clockRunning, gameState]);

  // goldRush : démarre quand le niveau est visible et hors pause (écran de découverte),
  // après un court délai pour laisser cette pause s'installer ; puis niveau suivant
  const bonusSeed = currentSpec?.rule === "goldRush" ? currentSpec.seed : null;
  useEffect(() => {
    if (bonusSeed === null || gameState !== GameStateEnum.PLAYING) return;
    if (animationLevelLoading) return;
    if (bonusEndsAt === null) {
      if (pauseTimer) return;
      const start = setTimeout(() => {
        const { pauseTimer, currentSpec } = useGameStore.getState();
        if (!pauseTimer && currentSpec?.seed === bonusSeed) startBonus(currentSpec.durationS ?? 8);
      }, BONUS_GRACE_MS);
      return () => clearTimeout(start);
    }
    const timeout = setTimeout(endBonus, Math.max(0, bonusEndsAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [bonusSeed, gameState, animationLevelLoading, pauseTimer, bonusEndsAt]);

  return null;
}
