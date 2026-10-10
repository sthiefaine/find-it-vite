/* eslint-disable react-hooks/exhaustive-deps */
import { createElement, useEffect, useRef, useState } from "react";
import { GameStateEnum, useGameStore } from "../../../../../store/store";
import { useShallow } from "zustand/shallow";
import { useLocation, useNavigate } from "react-router-dom";
import { dailySeed, randomSeed, seedFromCode } from "../../../../engine";
import type { LevelSpec, Tier } from "../../../../engine";
import { useSaveStore } from "../../../../save/saveStore";
import { DEFAULT_TIER, TIERS } from "../../../../save/schema";
import { MAX_TICK_DELTA_MS, tickClock } from "../../../../game/session";
import { MAX_PLAY_TIME_S, missionSeed, readModeParams } from "../../../../game/modes";
import { WORLD_BANNER_MS } from "../../../../game/adventureRun";
import { isLevelUnlocked, todayISO } from "../../../../content/progress";
import { isPageVisible, subscribeAppActive } from "../../../../platform/appLifecycle";
import { levelAssetUrls, preloadImages, startLevelAssetLoad } from "../../../../game/assetReadiness";
import { beginLevelCountdown, generateRunLevel, levelCountdownUntil, nextRunLevel } from "../../../../game/levelPreparation";
import { playStartSound } from "../../../../helpers/sounds";
import { LevelAssetStatus } from "./LevelAssetStatus";
import { playThemeFromSearch, themeOptions } from "../../../../content/playThemes";
import { CHAPTER_MISSIONS, isChapterMissionUnlocked } from "../../../../content/campaign";

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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [failedSpec, setFailedSpec] = useState<LevelSpec | null>(null);
  // Étape de la partie pour laquelle le niveau a été généré
  const setupFor = useRef<string | null>(null);

  // Le niveau courant est entièrement déterminé par (mode, runSeed, level, tier, pool)
  const setupLevel = () => {
    const state = useGameStore.getState();
    const { runSeed, level } = state;
    const spec = generateRunLevel(state, useSaveStore.getState().save, location.search, import.meta.env.DEV);
    setupFor.current = `${runSeed}:${level}`;
    beginLevelCountdown(spec, performance.now());
    setAnimationLevelLoading(true);
    setCurrentSpec(spec);
  };

  const inGame = pathName === "/game" && (gameState === GameStateEnum.PLAYING || gameState === GameStateEnum.PAUSED);
  useEffect(() => {
    if (!inGame || !currentSpec || !animationLevelLoading) return;
    const spec = currentSpec;
    setFailedSpec(null);
    const minimumMs = Math.max(0, (levelCountdownUntil(spec) ?? 0) - performance.now());
    return startLevelAssetLoad(spec, {
      minimumMs,
      previewBirds: import.meta.env.DEV && new URLSearchParams(location.search).get("birds") === "1",
    }, {
      isCurrent: () => {
        const state = useGameStore.getState();
        return state.currentSpec === spec &&
          (state.gameState === GameStateEnum.PLAYING || state.gameState === GameStateEnum.PAUSED);
      },
      onReady: () => {
        setAnimationLevelLoading(false);
        if (useGameStore.getState().gameState === GameStateEnum.PLAYING) useGameStore.getState().setSoundSrc(playStartSound);
      },
      onError: () => setFailedSpec(spec),
    });
  }, [inGame, currentSpec, animationLevelLoading, loadAttempt, location.search]);

  // Pendant la recherche, on prépare déjà tous les portraits et les obstacles
  // du prochain avis. Une fin de partie annule l'attente, jamais le cache partagé.
  useEffect(() => {
    if (!inGame || !currentSpec || animationLevelLoading) return;
    const state = useGameStore.getState();
    if (state.wantedFound || state.bonusDone) return;
    if (state.chapterId && state.adventureStep === CHAPTER_MISSIONS && state.missionFound === 4) return;
    const next = generateRunLevel(nextRunLevel(state), useSaveStore.getState().save, location.search, import.meta.env.DEV);
    const controller = new AbortController();
    const birds = import.meta.env.DEV && new URLSearchParams(location.search).get("birds") === "1";
    // Un préchargement raté sera retenté par la barrière du prochain niveau.
    void preloadImages(levelAssetUrls(next, birds), controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [inGame, currentSpec, animationLevelLoading, location.search]);

  const startGame = (savedTier: Tier) => {
    // Idempotent : en dev, StrictMode rejoue l'effet avec un état périmé ; on ne relance
    // pas une partie déjà démarrée (Rejouer repasse par RESET → INIT, donc reste possible).
    if (useGameStore.getState().gameState !== GameStateEnum.INIT) return;
    const debug = readDebugParams(location.search);
    const params = readModeParams(location.search);
    const query = new URLSearchParams(location.search);
    if (query.get("mode") === "adventure" && query.has("chapter") && !(params.mode === "adventure" && params.chapterId)) {
      navigate("/adventure", { replace: true });
      return;
    }
    if (params.mode === "endless") {
      const theme = playThemeFromSearch(location.search);
      const option = themeOptions("endless", useSaveStore.getState().save).find(option => option.theme.id === theme);
      if (!option?.enabled) {
        navigate(`/play?mode=endless&theme=${encodeURIComponent(theme)}`, { replace: true });
        return;
      }
    }
    // Mission verrouillée (URL tapée à la main, lien partagé…) : retour à la carte
    if (
      params.mode === "adventure" &&
      (params.chapterId ? !isChapterMissionUnlocked(useSaveStore.getState().save, params.chapterId, params.level)
        : params.mixStep ? !useSaveStore.getState().save.campaign.legacyMixUnlocked
          : !isLevelUnlocked(useSaveStore.getState().save, params.worldId!, params.level))
    ) {
      navigate("/adventure", { replace: true });
      return;
    }
    setClearGameStore();
    if (params.mode === "adventure") {
      if (params.chapterId && !useSaveStore.getState().enterChapter(params.chapterId, params.level)) {
        navigate("/adventure", { replace: true });
        return;
      }
      setTimeLeftValue(MAX_PLAY_TIME_S);
      startRun({
        mode: "adventure",
        worldId: params.worldId ?? null,
        chapterId: params.chapterId,
        resumeStep: params.mixStep,
        adventureLevel: params.level,
        runSeed: missionSeed(params.chapterId ?? params.worldId!, params.level),
        tier: debug.tier ?? savedTier,
        level: 1,
        calm: useSaveStore.getState().save.settings.calm,
      });
      if (!params.chapterId) useSaveStore.getState().recordLegacyCheckpoint(useGameStore.getState().adventureStep);
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
    setupLevel();
    setGameState(GameStateEnum.PLAYING);
  };

  useEffect(() => {
    const { gameState, runSeed } = useGameStore.getState();
    // pas de nouveau niveau si la partie s'est terminée pendant la transition
    if (gameState === GameStateEnum.PLAYING && setupFor.current !== `${runSeed}:${level}`) {
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
    if (gameState !== GameStateEnum.PLAYING && gameState !== GameStateEnum.PAUSED) clockAcc.current = 0;
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

  return inGame && gameState === GameStateEnum.PLAYING && currentSpec && animationLevelLoading && failedSpec === currentSpec ? createElement(LevelAssetStatus, {
    key: `${currentSpec.seed}:${currentSpec.index}`,
    onRetry: () => { setFailedSpec(null); setLoadAttempt(attempt => attempt + 1); },
    onExit: () => navigate("/"),
  }) : null;
}
