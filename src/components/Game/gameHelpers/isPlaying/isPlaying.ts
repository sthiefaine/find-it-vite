/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from "react";
import {
  gameConstants,
  GameStateEnum,
  useGameStore,
} from "../../../../../store/store";
import { useShallow } from "zustand/shallow";
import { charactersDetails } from "../../../../helpers/characters";
import { useLocation } from "react-router-dom";
import { generateLevel, randomSeed, seedFromCode } from "../../../../engine";
import type { Tier } from "../../../../engine";
import { useSaveStore } from "../../../../save/saveStore";
import { TIERS } from "../../../../save/schema";

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
      };
    })
  );
  const saveLoaded = useSaveStore((s) => s.loaded);
  const location = useLocation();
  const pathName = location.pathname;
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le niveau courant est entièrement déterminé par (runSeed, level, tier, pool)
  const setupLevel = (isInitialSetup = false) => {
    const { runSeed, tier, level } = useGameStore.getState();
    const spec = generateLevel(level, {
      seed: runSeed,
      tier,
      pool: charactersDetails,
      allowedRules: ["classic"],
      allowedModifiers: ["lookalikes"],
    });
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
    setClearGameStore();
    setTimeLeftValue(gameConstants.MAX_PLAY_TIME);
    startRun({
      runSeed: debug.seed ?? randomSeed(),
      tier: debug.tier ?? savedTier,
      level: debug.level ?? 1,
    });
    setupLevel(true);
    setAnimationLevelLoading(true);
    setGameState(GameStateEnum.PLAYING);
  };

  useEffect(() => {
    const { gameState, currentSpec } = useGameStore.getState();
    // pas de nouveau niveau si la partie s'est terminée pendant la transition
    if (gameState === GameStateEnum.PLAYING && currentSpec?.index !== level) {
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

  // Fin de partie (chrono à 0 ou bouton Arrêter) : on enregistre le résultat
  useEffect(() => {
    if (
      pathName === "/game" &&
      (gameState === GameStateEnum.FINISH || gameState === GameStateEnum.END)
    ) {
      submitGameResult();
    }
  }, [gameState, pathName]);

  useEffect(() => {
    if (gameState === GameStateEnum.PLAYING && !animationLevelLoading) {
      if (timeLeft < 0) {
        setTimeLeftValue(0);
      }

      if (timeLeft === 0) {
        setGameState(GameStateEnum.FINISH);
      }

      const interval = setInterval(() => {
        if (timeLeft === 1) {
          setTimeLeftValue(0);
          clearInterval(interval);
          return;
        }
        setTimeLeft(-1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [gameState, timeLeft, setTimeLeft, animationLevelLoading]);

  return null;
}
