import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { X } from "lucide-react";

import { randomSeed } from "../../engine";
import { charactersDetails } from "../../helpers/characters";
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
import "./Duel.css";

type Phase = "setup" | "ready" | "countdown" | "playing" | "victory";
const COUNT_STEP_MS = 800;

export default function Duel() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [target, setTarget] = useState<DuelTarget>(5);
  const [ready, setReady] = useState<Record<Player, boolean>>({ top: false, bottom: false });
  const [count, setCount] = useState(3);
  const [round, setRound] = useState<DuelRound | null>(null);
  const [duel, setDuel] = useState<DuelState>(initialDuelState);
  const [locked, setLocked] = useState<Record<Player, boolean>>({ top: false, bottom: false });
  const [missKey, setMissKey] = useState<Record<Player, number>>({ top: 0, bottom: 0 });
  const [confirmQuit, setConfirmQuit] = useState(false);

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
    // Préchargement des têtes
    charactersDetails.forEach((c) => {
      const img = new Image();
      img.src = c.imageSrc;
    });
    return () => {
      document.removeEventListener("touchmove", stop);
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("dblclick", stop);
      document.removeEventListener("contextmenu", stop);
      clearTimers();
    };
  }, []);

  // 3-2-1
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      playDuelSound(playStartSound);
      setPhase("playing");
      return;
    }
    const t = window.setTimeout(() => setCount((c) => c - 1), COUNT_STEP_MS);
    return () => window.clearTimeout(t);
  }, [phase, count]);

  const startCountdown = () => {
    seedRef.current = randomSeed();
    setDuelState(initialDuelState());
    setRoundState(generateRound(seedRef.current, 1));
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
    if (phaseRef.current !== "playing" || confirmRef.current || !r) return;
    const { state, result } = tap(duelRef.current, player, cellIndex, r.wantedIndex, performance.now());
    if (result === "ignored") return;
    setDuelState(state);
    if (result === "miss") {
      playDuelSound(playHitBombSound, 0.4);
      setLocked((l) => ({ ...l, [player]: true }));
      setMissKey((k) => ({ ...k, [player]: k[player] + 1 }));
      later(() => setLocked((l) => ({ ...l, [player]: false })), LOCK_MS);
      return;
    }
    playDuelSound(playPopSound);
    later(() => {
      const winner = winnerOf(state.score, target);
      setLocked({ top: false, bottom: false });
      if (winner) {
        playDuelSound(playNewHihScoreSound);
        setPhase("victory");
        return;
      }
      setRoundState(generateRound(seedRef.current, r.number + 1, r.spec.wanted.name));
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
    else if (phase === "countdown") content = <CountdownPanel count={count} />;
    else if (phase === "playing" && round)
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
            <p>Quitter le duel ?</p>
            <div className="duel-row">
              <button className="duel-btn duel-btn--danger" onClick={quit}>
                Oui
              </button>
              <button className="duel-btn" onClick={() => setConfirmQuit(false)}>
                Non
              </button>
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
        <button className="duel-quit" aria-label="Quitter" onClick={onQuitButton}>
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
  return (
    <div className="duel-panel">
      <h2 className="duel-title">Duel</h2>
      <div className="duel-row">
        {([5, 10] as DuelTarget[]).map((t) => (
          <button key={t} className="duel-btn duel-btn--big" onPointerDown={() => onChoose(t)}>
            Premier à {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadyPanel(props: { target: number; isReady: boolean; otherReady: boolean; onReady: () => void }) {
  return (
    <div className="duel-panel">
      <h2 className="duel-title">Prêts ?</h2>
      <p className="duel-sub">Premier à {props.target}</p>
      {props.isReady ? (
        <p className="duel-wait">{props.otherReady ? "C'est parti !" : "On attend l'autre…"}</p>
      ) : (
        <motion.button
          className="duel-btn duel-btn--ready"
          onPointerDown={props.onReady}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          Prêt !
        </motion.button>
      )}
    </div>
  );
}

function CountdownPanel({ count }: { count: number }) {
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
          {count > 0 ? count : "Go !"}
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
        <span className="duel-poster-label">Trouve</span>
        <img src={round.spec.wanted.imageSrc} alt={round.spec.wanted.label} draggable={false} />
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
              <img src={c.imageSrc} alt="" draggable={false} />
            </div>
          );
        })}
      </motion.div>
      <AnimatePresence>
        {locked && (
          <motion.div className="duel-flag duel-flag--miss" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            Raté !
          </motion.div>
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
            Il était là !
          </motion.div>
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
  const { won, player, score } = props;
  return (
    <motion.div className="duel-panel" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <div className="duel-trophy">{won ? "🏆" : "💪"}</div>
      <h2 className="duel-title">{won ? "Bravo !" : "Revanche ?"}</h2>
      <p className="duel-sub">
        {score[player]} – {score[other(player)]}
      </p>
      <div className="duel-row">
        <button className="duel-btn duel-btn--big" onClick={props.onRematch}>
          Revanche
        </button>
        <button className="duel-btn" onClick={props.onHome}>
          Accueil
        </button>
      </div>
    </motion.div>
  );
}
