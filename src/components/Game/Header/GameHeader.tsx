import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import "@pixi/events";
import "./GameHeader.css";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { useShallow } from "zustand/shallow";
import { Timer } from "./Timer/Timer";
import ScoreDisplay from "./ScoreDisplay/ScoreDisplay";
import { Sprite, Stage } from "@pixi/react";
import { Countdown } from "../../Countdown/Countdown";
import { Discovery } from "../../Discovery/Discovery";
import { MODIFIER_ICON, RULE_ICON, targetCount } from "../../../engine/rules";
import type { LevelSpec } from "../../../engine/types";

const MEMORY_SHOW_MS = { easy: 2500, normal: 1500, expert: 1500 } as const;
const MEMORY_PEEK_MS = 1000;
const MEMORY_PEEK_COST_S = 2;
const FLIP_MS = 400;

const stampIcon = (spec: LevelSpec | null) => {
  if (!spec) return RULE_ICON.classic;
  if (spec.rule === "classic" && spec.modifiers.includes("flashlight"))
    return MODIFIER_ICON.flashlight;
  return RULE_ICON[spec.rule];
};

export const GameHeader = () => {
  const {
    animationLevelLoading,
    wantedCharacter,
    score,
    gameState,
    spec,
    tier,
    isDiscovery,
    foundCount,
    pauseTimer,
    setPauseTimer,
    setTimeLeft,
  } = useGameStore(
    useShallow((state) => ({
      wantedCharacter: state.wantedCharacter,
      animationLevelLoading: state.animationLevelLoading,
      score: state.score,
      gameState: state.gameState,
      spec: state.currentSpec,
      tier: state.tier,
      isDiscovery: state.isDiscovery,
      foundCount: state.foundIds.length,
      pauseTimer: state.pauseTimer,
      setPauseTimer: state.setPauseTimer,
      setTimeLeft: state.setTimeLeft,
    }))
  );

  const [isAnimating, setIsAnimating] = useState(false);
  const [spriteAlpha, setSpriteAlpha] = useState(0);
  const [flashEffect, setFlashEffect] = useState(false);

  const spriteRef = useRef(null);
  const PixiRef = useRef<Stage | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (wantedCharacter && !animationLevelLoading) {
      setFlashEffect(true);
      setSpriteAlpha(0);
      setIsAnimating(true);

      const flashTimeout = setTimeout(() => setFlashEffect(false), 800);

      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }

      const startTime = performance.now();
      const duration = 1000;

      const animate = (currentTime: number) => {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);

        setSpriteAlpha(Math.min(progress * 2, 1));

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          animationFrameId.current = null;
        }
      };

      animationFrameId.current = requestAnimationFrame(animate);
      return () => {
        clearTimeout(flashTimeout);
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      };
    }
  }, [wantedCharacter, animationLevelLoading]);

  const levelKey = spec ? `${spec.seed}-${spec.index}` : "";
  const rule = spec?.rule ?? "classic";
  const shown = !animationLevelLoading && !!wantedCharacter;

  // --- Découverte : une fois par niveau, après le chargement ---
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const showDiscovery =
    !!spec &&
    isDiscovery &&
    shown &&
    gameState === GameStateEnum.PLAYING &&
    dismissedKey !== levelKey;
  // Chrono en pause pendant la fenêtre de découverte
  useEffect(() => {
    if (!showDiscovery) return;
    setPauseTimer(true);
    return () => setPauseTimer(false);
  }, [showDiscovery, levelKey, setPauseTimer]);
  const ready = shown && !showDiscovery && gameState === GameStateEnum.PLAYING;

  // --- memory : carte retournée ---
  const isMemory = rule === "memory";
  const [cardHidden, setCardHidden] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const flip = useCallback((hidden: boolean) => {
    setFlipping(true);
    later(() => setCardHidden(hidden), FLIP_MS / 2);
    later(() => setFlipping(false), FLIP_MS);
  }, []);

  const memorized = useRef(false);
  useEffect(() => {
    clearTimers();
    setCardHidden(false);
    setFlipping(false);
    setPeeking(false);
    memorized.current = false;
    return clearTimers;
  }, [levelKey]);
  // Le portrait reste visible un moment, une seule fois par niveau
  useEffect(() => {
    if (!isMemory || !ready || memorized.current) return;
    const t = setTimeout(() => {
      memorized.current = true;
      flip(true);
    }, MEMORY_SHOW_MS[tier]);
    return () => clearTimeout(t);
  }, [levelKey, isMemory, ready, tier, flip]);

  const peek = () => {
    if (!isMemory || !ready || !cardHidden || flipping || peeking) return;
    setTimeLeft(-MEMORY_PEEK_COST_S);
    setPeeking(true);
    flip(false);
    later(() => flip(true), FLIP_MS + MEMORY_PEEK_MS);
    later(() => setPeeking(false), 2 * FLIP_MS + MEMORY_PEEK_MS);
  };

  // --- goldRush : compte à rebours purement visuel ---
  const [bonusLeft, setBonusLeft] = useState(0);
  useEffect(() => {
    setBonusLeft(spec?.durationS ?? 0);
  }, [levelKey, spec?.durationS]);
  const bonusTicking = rule === "goldRush" && ready && !pauseTimer && bonusLeft > 0;
  useEffect(() => {
    if (!bonusTicking) return;
    const t = setTimeout(() => setBonusLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [bonusTicking, bonusLeft]);

  // --- Nom affiché sous le portrait ---
  const remaining = spec ? Math.max(0, targetCount(spec) - foundCount) : 0;
  const renderName = () => {
    if (!shown) return "???";
    switch (rule) {
      case "silhouette":
        return "???";
      case "memory":
        return cardHidden ? "???" : wantedCharacter!.label;
      case "oddOneOut":
        return "L'intrus\u00a0!";
      case "goldRush":
        return "BONUS\u00a0!";
      case "findAll":
        return (
          <>
            {wantedCharacter!.label}
            <span key={remaining} className="wanted-count">
              ×{remaining}
            </span>
          </>
        );
      default:
        return wantedCharacter!.label;
    }
  };

  const showBack = isMemory && shown && cardHidden;
  const isGold = rule === "goldRush" && shown;

  return (
    <div className="header-container">
      <div className="header-content">
        <Timer />

        <div
          className={`wanted-poster ${flashEffect ? "flash-effect" : ""} ${
            isGold ? "wanted-gold" : ""
          } ${showBack && !flipping ? "wanted-tappable" : ""}`}
          onPointerDown={peek}
        >
          <div
            className={`wanted-image-container ${flipping ? "card-flipping" : ""}`}
          >
            {animationLevelLoading &&
              gameState === GameStateEnum.PLAYING &&
              score === 0 && <Countdown />}
            <Stage
              ref={PixiRef}
              width={60}
              height={60}
              options={{
                backgroundAlpha: 0,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
              }}
            >
              {shown && (
                <Sprite
                  ref={spriteRef}
                  image={wantedCharacter!.imageSrc}
                  width={60}
                  height={60}
                  alpha={spriteAlpha}
                  tint={rule === "silhouette" ? 0x000000 : 0xffffff}
                  visible={!showBack && !isGold}
                  eventMode="static"
                />
              )}
            </Stage>
            {showBack && (
              <div className="card-back">
                <span>?</span>
              </div>
            )}
            {rule === "oddOneOut" && shown && (
              <div className="odd-sign">≠</div>
            )}
            {isGold && (
              <div className="gold-face">
                <span className="gold-star">⭐</span>
                <span className="gold-count">{bonusLeft}</span>
              </div>
            )}
            {peeking && <div className="peek-cost">−{MEMORY_PEEK_COST_S} s</div>}
            <div className="wanted-stamp">{stampIcon(spec)}</div>
            {isAnimating && <div className="character-glow"></div>}
          </div>
          <div className="wanted-name-container">
            <p className={`wanted-name ${isAnimating ? "name-appear" : ""}`}>
              {renderName()}
            </p>
          </div>
        </div>

        <ScoreDisplay score={score} />
      </div>
      {createPortal(
        <AnimatePresence>
          {showDiscovery && spec && (
            <Discovery
              key={levelKey}
              spec={spec}
              onClose={() => setDismissedKey(levelKey)}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default GameHeader;
