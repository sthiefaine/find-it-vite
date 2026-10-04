import { useCallback, useEffect, useRef, useState } from "react";
import "./GameHeader.css";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { useShallow } from "zustand/shallow";
import { Timer } from "./Timer/Timer";
import ScoreDisplay from "./ScoreDisplay/ScoreDisplay";
import { Countdown } from "../../Countdown/Countdown";
import { MODIFIER_ICON, RULE_ICON, targetCount } from "../../../engine/rules";
import type { LevelSpec } from "../../../engine/types";
import { useSaveStore } from "../../../save/saveStore";
import { MISSION_GOAL } from "../../../game/modes";
import { AnimalPortrait } from "../../AnimalPortrait/AnimalPortrait";
import { getAccessory } from "../../../content/accessories";

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
    markDiscoverySeen,
    foundCount,
    setTimeLeft,
    mode,
    missionFound,
  } = useGameStore(
    useShallow((state) => ({
      wantedCharacter: state.wantedCharacter,
      animationLevelLoading: state.animationLevelLoading,
      score: state.score,
      gameState: state.gameState,
      spec: state.currentSpec,
      tier: state.tier,
      markDiscoverySeen: state.markDiscoverySeen,
      foundCount: state.foundIds.length,
      setTimeLeft: state.setTimeLeft,
      mode: state.mode,
      missionFound: state.missionFound,
    }))
  );
  const frame = useSaveStore((s) => s.save.settings.frame);

  // Apparition du portrait : pilotée par une classe CSS (opacité 0 dès la première frame)
  // et non plus par un état React mis à jour après coup, qui laissait passer une frame à
  // opacité 1 (le nouveau perso apparaissait, disparaissait puis revenait en fondu).
  const [isAnimating, setIsAnimating] = useState(false);
  useEffect(() => {
    if (!wantedCharacter || animationLevelLoading) return;
    setIsAnimating(true);
    const t = setTimeout(() => setIsAnimating(false), 900);
    return () => clearTimeout(t);
  }, [wantedCharacter, animationLevelLoading]);

  // Précharge l'image pendant le chargement du niveau : elle est décodée avant d'être montrée
  const imageSrc = wantedCharacter?.imageSrc;
  const accessorySrc = getAccessory(spec?.accessories?.target)?.imageSrc;
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.src = imageSrc;
  }, [imageSrc]);
  useEffect(() => {
    if (!accessorySrc) return;
    const img = new Image();
    img.src = accessorySrc;
  }, [accessorySrc]);

  // Le 3-2-1 n'est joué qu'au début de la partie, pas aux changements de niveau
  const countdownDone = useRef(false);
  useEffect(() => {
    if (gameState !== GameStateEnum.PLAYING) countdownDone.current = false;
  }, [gameState]);
  useEffect(() => {
    if (!animationLevelLoading && wantedCharacter) countdownDone.current = true;
  }, [animationLevelLoading, wantedCharacter]);

  const levelKey = spec ? `${spec.seed}-${spec.index}` : "";
  const rule = spec?.rule ?? "classic";
  const shown = !animationLevelLoading && !!wantedCharacter;

  const ready = shown && gameState === GameStateEnum.PLAYING;

  // Plus de fenêtre de découverte : le jeu reste fluide, les indices de l'avis suffisent
  // (tampon de la règle, silhouette, intrus, ×N, carte mémoire). Les nouvelles mécaniques
  // sont quand même marquées « vues » dès que le niveau est affiché.
  useEffect(() => {
    if (ready) markDiscoverySeen();
  }, [ready, levelKey, markDiscoverySeen]);

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

  // --- goldRush : compte à rebours calculé depuis la vraie fin du bonus ---
  // (bonusPausedMs : bonus figé pendant que l'app est en arrière-plan)
  const bonusEndsAt = useGameStore((s) => s.bonusEndsAt);
  const bonusPausedMs = useGameStore((s) => s.bonusPausedMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (bonusEndsAt === null || bonusPausedMs !== null) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, [bonusEndsAt, bonusPausedMs]);
  const bonusMs = bonusPausedMs ?? (bonusEndsAt === null ? null : bonusEndsAt - now);
  const bonusLeft = bonusMs === null ? null : Math.max(0, Math.ceil(bonusMs / 1000));

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
          className={`wanted-poster frame-${frame}${isAnimating ? " poster-pop" : ""}${
            isGold ? " wanted-gold" : ""
          }${showBack && !flipping ? " wanted-tappable" : ""}`}
          onPointerDown={peek}
        >
          <div
            className={`wanted-image-container${flipping ? " card-flipping" : ""}`}
          >
            {animationLevelLoading &&
              gameState === GameStateEnum.PLAYING &&
              !countdownDone.current && <Countdown />}
            {wantedCharacter && (
              // Monté pendant le chargement (caché) : l'image est prête quand elle apparaît.
              // La clé change avec le niveau : jamais l'ancien perso sous le nouveau.
              <AnimalPortrait
                key={`${levelKey}-${wantedCharacter.imageSrc}`}
                className={`wanted-portrait${shown ? " portrait-in" : ""}${
                  rule === "silhouette" ? " portrait-silhouette" : ""
                }`}
                imageSrc={wantedCharacter.imageSrc}
                size={62}
                label={wantedCharacter.label}
                accessoryId={spec?.accessories?.target}
                hidden={showBack || isGold}
              />
            )}
            {showBack && (
              <div className="card-back">
                <span>?</span>
              </div>
            )}
            {rule === "oddOneOut" && shown && <div className="odd-sign">≠</div>}
            {isGold && (
              <div className="gold-face">
                <span className="gold-star">⭐</span>
                {bonusLeft !== null && (
                  <span className="gold-count">{bonusLeft}</span>
                )}
              </div>
            )}
            {peeking && <div className="peek-cost">−{MEMORY_PEEK_COST_S} s</div>}
            {isAnimating && <div className="character-glow"></div>}
          </div>
          {/* La clé change avec l'icône : petite apparition quand la règle change */}
          <div key={stampIcon(spec)} className="wanted-stamp" aria-hidden>
            {stampIcon(spec)}
          </div>
          <div className="wanted-name-container">
            <p className={`wanted-name${isAnimating ? " name-appear" : ""}`}>
              {renderName()}
            </p>
          </div>
        </div>

        <div className="score-column">
          <ScoreDisplay score={score} />
          {mode === "adventure" && (
            <div className="mission-progress" aria-label={`${missionFound} avis sur ${MISSION_GOAL}`}>
              <span key={missionFound} className="mission-count">
                {missionFound}
              </span>
              /{MISSION_GOAL}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameHeader;
