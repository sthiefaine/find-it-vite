import { useTranslation } from "../../i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { X } from "lucide-react";

import { randomSeed } from "../../engine";
import { portraitStyle } from "../../helpers/portraitScale";
import { playThemeFromSearch, playThemePool } from "../../content/playThemes";
import type { PlayThemeId } from "../../content/playThemes";
import {
  playCountdownSound,
  playHitBombSound,
  playNewHihScoreSound,
  playPopSound,
  playStartSound,
} from "../../helpers/sounds";
import {
  generateRound,
  initialDuelState,
  LOCK_MS,
  nextRoundState,
  other,
  PAUSE_MS,
  tap,
  winnerOf,
} from "./duelLogic";
import type { DuelRound, DuelState, DuelTarget, Player } from "./duelLogic";
import { playDuelSound } from "./sound";
import { preloadImages } from "../../game/assetReadiness";
import * as haptics from "../../platform/haptics";
import "./Duel.css";

type Phase = "setup" | "ready" | "countdown" | "playing" | "victory";
type AssetsStatus = "loading" | "ready" | "error";
const COUNT_STEP_MS = 800;

export default function Duel() {
  const location = useLocation();
  const theme = playThemeFromSearch(location.search);
  // Une navigation vers un autre thème démarre une nouvelle session, sans
  // conserver une manche ou un délai encore lié au thème précédent.
  return <DuelSession key={theme} theme={theme} />;
}

function DuelSession({ theme }: { theme: PlayThemeId }) {
  const { t: tr } = useTranslation();
  const navigate = useNavigate();
  const pool = useMemo(() => playThemePool("duel", theme, {}), [theme]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [target, setTarget] = useState<DuelTarget>(5);
  const [ready, setReady] = useState<Record<Player, boolean>>({ top: false, bottom: false });
  const [count, setCount] = useState(3);
  const [round, setRound] = useState<DuelRound | null>(null);
  const [duel, setDuel] = useState<DuelState>(initialDuelState);
  const [locked, setLocked] = useState<Record<Player, boolean>>({ top: false, bottom: false });
  const [missKey, setMissKey] = useState<Record<Player, number>>({ top: 0, bottom: 0 });
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [assetsStatus, setAssetsStatus] = useState<AssetsStatus>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Miroirs pour les touchers simultanés (pas d'état périmé)
  const duelRef = useRef(duel);
  const roundRef = useRef(round);
  const phaseRef = useRef(phase);
  const confirmRef = useRef(confirmQuit);
  const readyRef = useRef(ready);
  const seedRef = useRef(0);
  const timers = useRef<number[]>([]);
  phaseRef.current = phase;
  confirmRef.current = confirmQuit;

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const setDuelState = (s: DuelState) => {
    duelRef.current = s;
    setDuel(s);
  };
  const setRoundState = (r: DuelRound) => {
    roundRef.current = r;
    setRound(r);
  };

  // Pas de zoom, de défilement ni de menu contextuel pendant le duel
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const opts = { passive: false } as AddEventListenerOptions;
    document.addEventListener("touchmove", stop, opts);
    document.addEventListener("gesturestart", stop, opts);
    document.addEventListener("dblclick", stop, opts);
    document.addEventListener("contextmenu", stop, opts);
    return () => {
      document.removeEventListener("touchmove", stop);
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("dblclick", stop);
      document.removeEventListener("contextmenu", stop);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    // Le pool entier reste prêt pour toutes les manches et les revanches.
    // Le cache est partagé avec le jeu solo ; aucun téléchargement par manche.
    const controller = new AbortController();
    setAssetsStatus("loading");
    void preloadImages(pool.map(character => character.imageSrc), controller.signal).then(
      () => { if (!controller.signal.aborted) setAssetsStatus("ready"); },
      () => { if (!controller.signal.aborted) setAssetsStatus("error"); },
    );
    return () => controller.abort();
  }, [pool, loadAttempt]);

  // 3-2-1
  useEffect(() => {
    if (phase !== "countdown" || count <= 0) return;
    const t = window.setTimeout(() => setCount((c) => c - 1), COUNT_STEP_MS);
    return () => window.clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    if (phase !== "countdown" || count > 0 || assetsStatus !== "ready") return;
    playDuelSound(playStartSound);
    setPhase("playing");
  }, [phase, count, assetsStatus]);

  const retryAssets = () => {
    setAssetsStatus("loading");
    setLoadAttempt(attempt => attempt + 1);
  };

  const startCountdown = () => {
    seedRef.current = randomSeed();
    setDuelState(initialDuelState());
    setRoundState(generateRound(seedRef.current, 1, undefined, pool));
    setLocked({ top: false, bottom: false });
    setCount(3);
    setPhase("countdown");
    playDuelSound(playCountdownSound);
  };

  const chooseTarget = (t: DuelTarget) => {
    setTarget(t);
    readyRef.current = { top: false, bottom: false };
    setReady(readyRef.current);
    setPhase("ready");
  };

  const pressReady = (p: Player) => {
    if (phaseRef.current !== "ready" || readyRef.current[p]) return;
    const next = { ...readyRef.current, [p]: true };
    readyRef.current = next;
    setReady(next);
    if (next.top && next.bottom) later(startCountdown, 250);
  };

  const onCell = (player: Player, cellIndex: number) => {
    const r = roundRef.current;
    if (phaseRef.current !== "playing" || assetsStatus !== "ready" || confirmRef.current || !r) return;
    const { state, result } = tap(duelRef.current, player, cellIndex, r.wantedIndex, performance.now());
    if (result === "ignored") return;
    setDuelState(state);
    if (result === "miss") {
      playDuelSound(playHitBombSound, 0.4);
      haptics.error();
      setLocked((l) => ({ ...l, [player]: true }));
      setMissKey((k) => ({ ...k, [player]: k[player] + 1 }));
      later(() => setLocked((l) => ({ ...l, [player]: false })), LOCK_MS);
      return;
    }
    playDuelSound(playPopSound);
    haptics.tapLight();
    later(() => {
      const winner = winnerOf(state.score, target);
      setLocked({ top: false, bottom: false });
      if (winner) {
        playDuelSound(playNewHihScoreSound);
        haptics.success();
        setPhase("victory");
        return;
      }
      setRoundState(generateRound(seedRef.current, r.number + 1, r.spec.wanted.name, pool));
      setDuelState(nextRoundState(duelRef.current));
    }, PAUSE_MS);
  };

  const rematch = () => {
    clearTimers();
    readyRef.current = { top: false, bottom: false };
    setReady(readyRef.current);
    setDuelState(initialDuelState());
    setPhase("ready");
  };

  const quit = () => {
    clearTimers();
    navigate("/");
  };

  const onQuitButton = () => {
    if (phase === "setup" || phase === "victory") quit();
    else setConfirmQuit(true);
  };

  const winner = winnerOf(duel.score, target);

  const renderHalf = (p: Player) => {
    let content: ReactNode = null;
    if (phase === "setup") content = <SetupPanel onChoose={chooseTarget} />;
    else if (phase === "ready")
      content = <ReadyPanel target={target} isReady={ready[p]} otherReady={ready[other(p)]} onReady={() => pressReady(p)} />;
    else if (phase === "countdown") content = <CountdownPanel count={count} assetsStatus={assetsStatus} onRetry={retryAssets} />;
    else if (phase === "playing" && round && assetsStatus === "ready")
      content = (
        <PlayPanel
          round={round}
          player={p}
          locked={locked[p]}
          missKey={missKey[p]}
          roundWinner={duel.roundWinner}
          onCell={(i) => onCell(p, i)}
        />
      );
    else if (phase === "victory")
      content = <VictoryPanel won={winner === p} score={duel.score} player={p} onRematch={rematch} onHome={quit} />;
    return (
      <section key={p} className={`duel-half duel-half--${p}`} data-player={p}>
        {content}
        {confirmQuit && (
          <div className="duel-confirm">
            <p>{tr("Quitter le duel ?")}</p>
            <div className="duel-row">
              <button className="duel-btn duel-btn--danger" onClick={quit}>
                {tr("Oui")} </button>
              <button className="duel-btn" onClick={() => setConfirmQuit(false)}>
                {tr("Non")} </button>
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="duel" onContextMenu={(e) => e.preventDefault()}>
      {renderHalf("top")}
      <div className="duel-middle">
        <ScoreChip player="bottom" score={duel.score} target={target} />
        <button className="duel-quit" aria-label={tr("Quitter")} onClick={onQuitButton}>
          <X size={20} strokeWidth={3} />
        </button>
        <ScoreChip player="top" score={duel.score} target={target} />
      </div>
      {renderHalf("bottom")}
    </div>
  );
}

function ScoreChip({ player, score, target }: { player: Player; score: Record<Player, number>; target: number }) {
  return (
    <div className={`duel-score duel-score--${player}`}>
      <span className={`duel-score-own duel-c-${player}`}>{score[player]}</span>
      <span className="duel-score-sep">–</span>
      <span className={`duel-score-opp duel-c-${other(player)}`}>{score[other(player)]}</span>
      <span className="duel-score-target">/ {target}</span>
    </div>
  );
}

function SetupPanel({ onChoose }: { onChoose: (t: DuelTarget) => void }) {
  const { t: tr } = useTranslation();
  return (
    <div className="duel-panel">
      <h2 className="duel-title">{tr("Duel")}</h2>
      <div className="duel-row">
        {([5, 10] as DuelTarget[]).map((t) => (
          <button key={t} className="duel-btn duel-btn--big" onPointerDown={() => onChoose(t)}>
            {tr("Premier à {{target}}", { target: t })}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadyPanel(props: { target: number; isReady: boolean; otherReady: boolean; onReady: () => void }) {
  const { t: tr } = useTranslation();
  return (
    <div className="duel-panel">
      <h2 className="duel-title">{tr("Prêts ?")}</h2>
      <p className="duel-sub">{tr("Premier à {{target}}", { target: props.target })}</p>
      {props.isReady ? (
        <p className="duel-wait">{props.otherReady ? tr("C'est parti !") : tr("On attend l'autre…")}</p>
      ) : (
        <motion.button
          className="duel-btn duel-btn--ready"
          onPointerDown={props.onReady}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          {tr("Prêt !")} </motion.button>
      )}
    </div>
  );
}

function CountdownPanel({ count, assetsStatus, onRetry }: { count: number; assetsStatus: AssetsStatus; onRetry: () => void }) {
  const { t: tr } = useTranslation();
  if (count <= 0 && assetsStatus !== "ready") {
    const failed = assetsStatus === "error";
    return <div className="duel-panel duel-assets" role={failed ? "alert" : "status"}>
      <p>{failed ? tr("Certaines images n’ont pas pu être chargées.") : tr("Préparation du duel…")}</p>
      {failed && <button type="button" className="duel-btn" onClick={onRetry}>{tr("Réessayer")}</button>}
    </div>;
  }
  return (
    <div className="duel-panel">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={count}
          className="duel-count"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {count > 0 ? count : tr("Go !")}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PlayPanel(props: {
  round: DuelRound;
  player: Player;
  locked: boolean;
  missKey: number;
  roundWinner: Player | null;
  onCell: (i: number) => void;
}) {
  const { t: tr } = useTranslation();
  const { round, player, locked, missKey, roundWinner, onCell } = props;
  const controls = useAnimationControls();
  useEffect(() => {
    if (missKey > 0) void controls.start({ x: [0, -12, 12, -8, 8, -4, 0], transition: { duration: 0.4 } });
  }, [missKey, controls]);

  const won = roundWinner === player;
  const lost = roundWinner !== null && !won;
  return (
    <div className={`duel-play${locked ? " is-locked" : ""}`}>
      <div className="duel-poster">
        <span className="duel-poster-label">{tr("Trouve")}</span>
        <img src={round.spec.wanted.imageSrc} alt={tr(round.spec.wanted.label)} draggable={false} style={portraitStyle(round.spec.wanted.imageSrc)} />
      </div>
      <motion.div
        className="duel-grid"
        animate={controls}
        style={{ gridTemplateColumns: `repeat(${round.gridSize}, 1fr)` }}
      >
        {round.cells.map((c, i) => {
          const isTarget = i === round.wantedIndex;
          return (
            <div
              key={`${round.number}-${i}`}
              className={`duel-cell${roundWinner && isTarget ? " is-target" : ""}`}
              data-wanted={isTarget ? "1" : undefined}
              onPointerDown={(e) => {
                e.preventDefault();
                onCell(i);
              }}
            >
              <img src={c.imageSrc} alt="" draggable={false} style={portraitStyle(c.imageSrc)} />
            </div>
          );
        })}
      </motion.div>
      <AnimatePresence>
        {locked && (
          <motion.div className="duel-flag duel-flag--miss" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {tr("Raté !")} </motion.div>
        )}
        {won && (
          <motion.div
            key="won"
            className="duel-flag duel-flag--win"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.3, 1], opacity: 1, rotate: [0, -8, 8, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            +1 🎉
          </motion.div>
        )}
        {lost && (
          <motion.div key="lost" className="duel-flag duel-flag--lost" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {tr("Il était là !")} </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VictoryPanel(props: {
  won: boolean;
  player: Player;
  score: Record<Player, number>;
  onRematch: () => void;
  onHome: () => void;
}) {
  const { t: tr } = useTranslation();
  const { won, player, score } = props;
  return (
    <motion.div className="duel-panel" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <div className="duel-trophy">{won ? "🏆" : "💪"}</div>
      <h2 className="duel-title">{won ? tr("Bravo !") : tr("Revanche ?")}</h2>
      <p className="duel-sub">
        {score[player]} – {score[other(player)]}
      </p>
      <div className="duel-row">
        <button className="duel-btn duel-btn--big" onClick={props.onRematch}>
          {tr("Revanche")} </button>
        <button className="duel-btn" onClick={props.onHome}>
          {tr("Accueil")} </button>
      </div>
    </motion.div>
  );
}
