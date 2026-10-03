import { useEffect, useState } from "react";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { useShallow } from "zustand/shallow";
import { useNavigate } from "react-router-dom";
import NumberFlow from "@number-flow/react";
import {
  CircleCheck,
  CircleX,
  Flag,
  House,
  RefreshCw,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { GameStateEnum, useGameStore } from "../../../store/store";
import {
  playClickSound,
  playFinishSound,
  playNewHihScoreSound,
} from "../../helpers/sounds";
import { formatSeconds, scoreMessage } from "./resultsHelpers";
import ProfilePicker from "../ProfilePicker/ProfilePicker";
import { useSaveStore } from "../../save/saveStore";
import type { Tier } from "../../engine/types";
import "./Results.css";

// Apparition des blocs les uns après les autres
const STEP_S = 0.3;
const RECORD_STEP = 2;

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STEP_S, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 380, damping: 22 },
  },
};

const pop: Variants = {
  hidden: { opacity: 0, scale: 0.3, rotate: -8 },
  show: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: "spring", stiffness: 420, damping: 12 },
  },
};

const SPARKLES = [
  { x: -120, y: -10, d: 0.1 },
  { x: 120, y: -14, d: 0.2 },
  { x: -95, y: 26, d: 0.3 },
  { x: 100, y: 28, d: 0.15 },
];

export default function Results() {
  const navigate = useNavigate();
  const {
    gameState,
    gameRecord,
    stats,
    wantedCharacter,
    wantedFound,
    setGameState,
    setSoundSrc,
  } = useGameStore(
    useShallow((state) => ({
      gameState: state.gameState,
      gameRecord: state.gameRecord,
      stats: state.stats,
      wantedCharacter: state.wantedCharacter,
      wantedFound: state.wantedFound,
      setGameState: state.setGameState,
      setSoundSrc: state.setSoundSrc,
    }))
  );
  const [shownScore, setShownScore] = useState(0);
  const [choosingProfile, setChoosingProfile] = useState(false);
  const profileTier = useSaveStore((s) => s.save.profile.tier);

  const score = gameRecord?.score ?? 0;
  const isNewRecord = gameRecord?.isNewRecord ?? false;
  const escaped =
    gameState === GameStateEnum.FINISH && !wantedFound && wantedCharacter;

  // Le score défile, puis le son arrive avec la ligne du record
  useEffect(() => {
    if (!gameRecord) return;
    const scoreTimer = setTimeout(() => setShownScore(score), 450);
    const soundTimer = setTimeout(
      () => setSoundSrc(isNewRecord ? playNewHihScoreSound : playFinishSound),
      (0.1 + STEP_S * RECORD_STEP) * 1000
    );
    return () => {
      clearTimeout(scoreTimer);
      clearTimeout(soundTimer);
    };
  }, [gameRecord, score, isNewRecord, setSoundSrc]);

  if (!gameRecord) return null;

  const handleReplay = () => {
    setSoundSrc(playClickSound);
    setGameState(GameStateEnum.RESET);
  };

  // Nouveau profil : on relance tout de suite une partie à ce niveau
  const handlePickProfile = (tier: Tier) => {
    setSoundSrc(playClickSound);
    useSaveStore.getState().setProfileTier(tier);
    setChoosingProfile(false);
    setGameState(GameStateEnum.RESET);
  };

  const handleHome = () => {
    setSoundSrc(playClickSound);
    navigate("/");
  };

  return (
    <motion.div
      className="results-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label="Fin de la partie"
    >
      <motion.div
        className="results-card"
        variants={list}
        initial="hidden"
        animate="show"
      >
        <motion.div className="results-title" variants={pop}>
          <h2>Bravo !</h2>
          {SPARKLES.map((s, i) => (
            <motion.span
              key={i}
              className="results-sparkle"
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0.8], scale: [0, 1.3, 1], x: s.x, y: s.y }}
              transition={{ delay: 0.25 + s.d, duration: 0.6 }}
            >
              <Star size={18} fill="currentColor" />
            </motion.span>
          ))}
          <p className="results-message">{scoreMessage(score)}</p>
        </motion.div>

        <motion.div className="results-score" variants={item}>
          <Star className="results-score-star" size={34} fill="currentColor" />
          <span className="results-score-value">
            <NumberFlow value={shownScore} />
          </span>
        </motion.div>

        <motion.div variants={item}>
          {isNewRecord ? (
            <motion.div
              className="results-record results-record-new"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ delay: 1, duration: 0.6, repeat: 2 }}
            >
              <Trophy size={22} /> Nouveau record !
            </motion.div>
          ) : (
            <div className="results-record">
              <Trophy size={18} /> Record : {gameRecord.bestScore}
            </div>
          )}
        </motion.div>

        <motion.ul className="results-stats" variants={item}>
          <li className="stat-found">
            <CircleCheck size={22} />
            <strong>{stats.found}</strong>
            <span>trouvés</span>
          </li>
          <li className="stat-miss">
            <CircleX size={22} />
            <strong>{stats.misses}</strong>
            <span>erreurs</span>
          </li>
          <li className="stat-fast">
            <Zap size={22} />
            <strong>{formatSeconds(stats.fastestFoundMs)}</strong>
            <span>plus rapide</span>
          </li>
          <li className="stat-level">
            <Flag size={22} />
            <strong>{gameRecord.level}</strong>
            <span>niveau</span>
          </li>
        </motion.ul>

        {escaped && (
          <motion.div className="results-escaped" variants={item}>
            <img src={wantedCharacter.imageSrc} alt="" width={52} height={52} />
            <div>
              <span>Il t'a échappé</span>
              <strong>{wantedCharacter.label}</strong>
            </div>
          </motion.div>
        )}

        <motion.div className="results-actions" variants={item}>
          <motion.button
            className="results-btn results-btn-replay"
            onClick={handleReplay}
            whileTap={{ scale: 0.94 }}
            autoFocus
          >
            <RefreshCw size={28} /> Rejouer
          </motion.button>
          <motion.button
            className="results-btn results-btn-home"
            onClick={handleHome}
            whileTap={{ scale: 0.94 }}
          >
            <House size={22} /> Accueil
          </motion.button>
        </motion.div>

        <motion.button
          className="results-profile"
          variants={item}
          onClick={() => setChoosingProfile(true)}
        >
          Changer de joueur
        </motion.button>
      </motion.div>
      <AnimatePresence>
        {choosingProfile && (
          <ProfilePicker
            key="profile"
            current={profileTier}
            onPick={handlePickProfile}
            onCancel={() => setChoosingProfile(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
