/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { GameStateEnum, useGameStore } from "../../../../../store/store";
import { useShallow } from "zustand/shallow";
import { useLocation, useNavigate } from "react-router-dom";
import { dailySeed, randomSeed, seedFromCode } from "../../../../engine";
import type { Tier } from "../../../../engine";
import { generatePlayableLevel } from "../../../../game/playableLevel";
import { useSaveStore } from "../../../../save/saveStore";
import { DEFAULT_TIER, TIERS } from "../../../../save/schema";
import { MAX_TICK_DELTA_MS, tickClock } from "../../../../game/session";
import { levelTarget, MAX_PLAY_TIME_S, missionSeed, readModeParams } from "../../../../game/modes";
import { stepTarget, WORLD_BANNER_MS } from "../../../../game/adventureRun";
import { isLevelUnlocked, todayISO } from "../../../../content/progress";
import { isPageVisible, subscribeAppActive } from "../../../../platform/appLifecycle";
import { characterPoolFor } from "../../../../game/characterPool";
import { playThemeFromSearch } from "../../../../content/playThemes";
import { readAccessoryPreview, withAccessoryPreview } from "../../../../game/accessories";

const TICK_MS = 100;
const BONUS_GRACE_MS = 150;

// Debug (dev seulement) : /game?seed=123&level=8 (seed en nombre ou en code), &tier=expert
// en option. En prod, ces paramètres sont ignorés.
export function readDebugParams(
  search: string,
  dev: boolean = import.meta.env.DEV
): {
  seed?: number;
  level?: number;
  tier?: Tier;
} {
  if (!dev) return {};
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
    pauseTimer,
    bonusEndsAt,
    bonusPausedMs,
    currentSpec,
    startBonus,
    endBonus,
    pauseBonus,
    resumeBonus,
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
        bonusPausedMs: state.bonusPausedMs,
        currentSpec: state.currentSpec,
        startBonus: state.startBonus,
        endBonus: state.endBonus,
        pauseBonus: state.pauseBonus,
        resumeBonus: state.resumeBonus,
      };
    })
  );
  const saveLoaded = useSaveStore((s) => s.loaded);
  const location = useLocation();
  const navigate = useNavigate();
  const pathName = location.pathname;
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Étape de la partie pour laquelle le niveau a été généré
  const setupFor = useRef<string | null>(null);

  // Le niveau courant est entièrement déterminé par (mode, runSeed, level, tier, pool)
  const setupLevel = (isInitialSetup = false) => {
    const { runSeed, tier, level, mode, adventureStep, missionFound } = useGameStore.getState();
    const pool = characterPoolFor(mode, adventureStep, useSaveStore.getState().save, playThemeFromSearch(location.search));
    // en Aventure : index de l'étape, une graine par avis, jamais deux fois le même recherché
    const target =
      mode === "adventure"
        ? stepTarget(adventureStep, missionFound + 1, pool)
        : levelTarget(mode, runSeed, level);
    const generated = generatePlayableLevel(target.index, {
      seed: target.seed,
      tier,
      pool,
    });
    const spec = withAccessoryPreview(generated, readAccessoryPreview(location.search, import.meta.env.DEV));
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
    // Idempotent : en dev, StrictMode rejoue l'effet avec un état périmé ; on ne relance
    // pas une partie déjà démarrée (Rejouer repasse par RESET → INIT, donc reste possible).
    if (useGameStore.getState().gameState !== GameStateEnum.INIT) return;
    const debug = readDebugParams(location.search);
    const params = readModeParams(location.search);
    // Mission verrouillée (URL tapée à la main, lien partagé…) : retour à la carte
    if (
      params.mode === "adventure" &&
      !isLevelUnlocked(useSaveStore.getState().save, params.worldId, params.level)
    ) {
      navigate("/adventure", { replace: true });
      return;
    }
    setClearGameStore();
    if (params.mode === "adventure") {
      setTimeLeftValue(MAX_PLAY_TIME_S);
      startRun({
        mode: "adventure",
        worldId: params.worldId,
        adventureLevel: params.level,
        runSeed: missionSeed(params.worldId, params.level),
        tier: debug.tier ?? savedTier,
        level: 1,
        calm: useSaveStore.getState().save.settings.calm,
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
          // Profil des Options ; sans choix, on joue en Normal
          startGame(useSaveStore.getState().save.profile.tier ?? DEFAULT_TIER);
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
    if (gameState !== GameStateEnum.NONE) setGameState(GameStateEnum.RESET);
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
  const worldBanner = useGameStore((s) => s.worldBanner);
  const addPlayTime = useGameStore((s) => s.addPlayTime);
  const hideWorldBanner = useGameStore((s) => s.hideWorldBanner);
  // App en arrière-plan (onglet caché, app native en pause) : chrono et bonus en pause
  const [appActive, setAppActive] = useState(isPageVisible);
  useEffect(() => subscribeAppActive(setAppActive), []);
  useEffect(() => {
    if (appActive) resumeBonus();
    else pauseBonus();
  }, [appActive, bonusEndsAt]);
  // Le joueur cherche (chrono en marche, ou qui le serait en mode calme)
  const searching =
    appActive &&
    gameState === GameStateEnum.PLAYING &&
    !animationLevelLoading &&
    !pauseTimer &&
    bonusEndsAt === null &&
    worldBanner === null;
  const clockRunning = !calm && searching;

  // Aventure : temps de jeu réel de l'étape, pour ses étoiles (même en mode calme)
  useEffect(() => {
    if (!searching) return;
    let last = performance.now();
    const interval = setInterval(() => {
      const t = performance.now();
      addPlayTime(Math.min(MAX_TICK_DELTA_MS, t - last));
      last = t;
    }, TICK_MS);
    return () => {
      addPlayTime(Math.min(TICK_MS, performance.now() - last));
      clearInterval(interval);
    };
  }, [searching]);

  // Bandeau de nouveau monde : 2 s, chrono en pause
  useEffect(() => {
    if (!worldBanner) return;
    const timeout = setTimeout(hideWorldBanner, WORLD_BANNER_MS);
    return () => clearTimeout(timeout);
  }, [worldBanner]);

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
      if (pauseTimer || !appActive) return;
      const start = setTimeout(() => {
        const { pauseTimer, currentSpec } = useGameStore.getState();
        if (!pauseTimer && isPageVisible() && currentSpec?.seed === bonusSeed) startBonus(currentSpec.durationS ?? 8);
      }, BONUS_GRACE_MS);
      return () => clearTimeout(start);
    }
    if (bonusPausedMs !== null || !appActive) return; // en pause : échéance recalée à la reprise
    const timeout = setTimeout(endBonus, Math.max(0, bonusEndsAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [bonusSeed, gameState, animationLevelLoading, pauseTimer, bonusEndsAt, bonusPausedMs, appActive]);

  return null;
}
