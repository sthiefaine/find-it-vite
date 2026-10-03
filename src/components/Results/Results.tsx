import { useEffect, useState } from "react";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { useShallow } from "zustand/shallow";
import { useNavigate } from "react-router-dom";
import NumberFlow from "@number-flow/react";
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Flag,
  House,
  Map as MapIcon,
  RefreshCw,
  Share2,
  Star,
  Timer as TimerIcon,
  Trophy,
  Zap,
} from "lucide-react";
import { GameStateEnum, GameRecord, useGameStore } from "../../../store/store";
import {
  playClickSound,
  playFinishSound,
  playNewHihScoreSound,
  playPunchLootSound,
} from "../../helpers/sounds";
import {
  formatSeconds,
  frenchSpacing,
  resultsTitle,
  retryMessage,
  scoreMessage,
} from "./resultsHelpers";
import ProfilePicker from "../ProfilePicker/ProfilePicker";
import { useSaveStore } from "../../save/saveStore";
import type { Tier } from "../../engine/types";
import { dailyShareText, MISSION_GOAL, nextUnlockedMissionUrl } from "../../game/modes";
import { getWorld } from "../../content/worlds";
import "./Results.css";

// Apparition des blocs les uns après les autres
const STEP_S = 0.3;
const RECORD_STEP = 2;
const STAR_FIRST_MS = 900;
const STAR_GAP_MS = 550;

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

// Presse-papier, avec repli pour les navigateurs sans API clipboard
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export default function Results() {
  const navigate = useNavigate();
  const {
    gameState,
    gameRecord,
    stats,
    wantedCharacter,
    wantedFound,
    timeLeft,
    missionFound,
    worldId,
    setGameState,
    setSoundSrc,
  } = useGameStore(
    useShallow((state) => ({
      gameState: state.gameState,
      gameRecord: state.gameRecord,
      stats: state.stats,
      wantedCharacter: state.wantedCharacter,
      wantedFound: state.wantedFound,
      timeLeft: state.timeLeft,
      missionFound: state.missionFound,
      worldId: state.worldId,
      setGameState: state.setGameState,
      setSoundSrc: state.setSoundSrc,
    }))
  );
  const [shownScore, setShownScore] = useState(0);
  const [litStars, setLitStars] = useState(0);
  const [copied, setCopied] = useState(false);
  const [choosingProfile, setChoosingProfile] = useState(false);
  const profileTier = useSaveStore((s) => s.save.profile.tier);
  const adventureSave = useSaveStore((s) => s.save.adventure);

  const mode = gameRecord?.mode ?? "endless";
  const score = gameRecord?.score ?? 0;
  const isNewRecord = gameRecord?.isNewRecord ?? false;
  const won = gameRecord?.won ?? false;
  const stars = gameRecord?.stars ?? 0;
  const escaped =
    mode !== "adventure" &&
    gameState === GameStateEnum.FINISH &&
    !wantedFound &&
    wantedCharacter;

  // Le score défile, puis le son arrive avec la ligne du record
  useEffect(() => {
    if (!gameRecord) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setShownScore(score), 450));
    if (gameRecord.mode === "adventure" && gameRecord.won) {
      // les étoiles s'allument une à une
      for (let i = 1; i <= gameRecord.stars; i++)
        timers.push(
          setTimeout(() => {
            setLitStars(i);
            setSoundSrc(playPunchLootSound);
          }, STAR_FIRST_MS + (i - 1) * STAR_GAP_MS)
        );
    } else {
      timers.push(
        setTimeout(
          () => setSoundSrc(isNewRecord ? playNewHihScoreSound : playFinishSound),
          (0.1 + STEP_S * RECORD_STEP) * 1000
        )
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [gameRecord, score, isNewRecord, setSoundSrc]);

  if (!gameRecord) return null;

  const click = () => setSoundSrc(playClickSound);

  const handleReplay = () => {
    click();
    setGameState(GameStateEnum.RESET);
  };

  // Nouveau profil : on relance tout de suite une partie à ce niveau
  const handlePickProfile = (tier: Tier) => {
    click();
    useSaveStore.getState().setProfileTier(tier);
    setChoosingProfile(false);
    setGameState(GameStateEnum.RESET);
  };

  const goTo = (path: string) => {
    click();
    navigate(path);
  };

  const handleShare = async () => {
    click();
    const text = dailyShareText(gameRecord.dailyDate ?? "", score);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Find It", text });
        return;
      } catch (e) {
        // partage annulé par le joueur : rien à faire
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const world = worldId ? getWorld(worldId) : undefined;
  // « Niveau suivant » seulement s'il est débloqué ; sinon la Carte est mise en avant
  const nextUrl =
    mode === "adventure" && won && worldId
      ? nextUnlockedMissionUrl({ adventure: adventureSave }, worldId, gameRecord.level)
      : null;
  const mapFirst = mode === "adventure" && won && !nextUrl;

  const title = () => resultsTitle(mode, { won, score, dailyLabel: dailyLabel(gameRecord) });

  const message = () => {
    if (mode === "adventure") {
      const name = world ? `${world.emoji} ${world.name} ${gameRecord.level}` : "";
      return frenchSpacing(
        won ? `Mission réussie · ${name}` : retryMessage(missionFound, MISSION_GOAL)
      );
    }
    return frenchSpacing(scoreMessage(score));
  };

  const showSparkles = mode !== "adventure" || won;

  return (
    <motion.div
      className={`results-overlay results-${mode}`}
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
          <h2 className={title().length > 10 ? "results-title-long" : ""}>{title()}</h2>
          {showSparkles &&
            SPARKLES.map((s, i) => (
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
          <p className="results-message">{message()}</p>
        </motion.div>

        {mode === "adventure" ? (
          <>
            {won && (
              <motion.div
                className="results-stars"
                variants={item}
                aria-label={`${stars} étoile${stars > 1 ? "s" : ""} sur 3`}
              >
                {[1, 2, 3].map((i) => (
                  <motion.span
                    key={i}
                    className={`results-star ${i <= litStars ? "results-star-lit" : ""}`}
                    animate={i <= litStars ? { scale: [0.4, 1.35, 1], rotate: [-25, 10, 0] } : {}}
                    transition={{ duration: 0.45 }}
                  >
                    <Star
                      size={i === 2 ? 58 : 46}
                      fill={i <= litStars ? "currentColor" : "none"}
                      strokeWidth={i <= litStars ? 1.5 : 2.5}
                    />
                  </motion.span>
                ))}
              </motion.div>
            )}
            <motion.ul className="results-stats results-stats-3" variants={item}>
              <li className="stat-found">
                <CircleCheck size={22} />
                <strong>
                  {missionFound}/{MISSION_GOAL}
                </strong>
                <span>avis</span>
              </li>
              <li className="stat-miss">
                <CircleX size={22} />
                <strong>{stats.misses}</strong>
                <span>erreurs</span>
              </li>
              <li className="stat-fast">
                <TimerIcon size={22} />
                <strong>{won ? `${timeLeft} s` : formatSeconds(stats.fastestFoundMs)}</strong>
                <span>{won ? "restantes" : "plus rapide"}</span>
              </li>
            </motion.ul>
          </>
        ) : (
          <>
            <motion.div className="results-score" variants={item}>
              <Star className="results-score-star" size={34} fill="currentColor" />
              <span className="results-score-value">
                <NumberFlow value={shownScore} />
              </span>
            </motion.div>

            <motion.div variants={item}>
              {mode === "daily" ? (
                <div className="results-record">
                  <Trophy size={18} /> Meilleur du jour&nbsp;: {gameRecord.dailyBest}
                </div>
              ) : gameRecord.calm ? (
                <div className="results-record">∞ Mode calme</div>
              ) : isNewRecord ? (
                <motion.div
                  className="results-record results-record-new"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ delay: 1, duration: 0.6, repeat: 2 }}
                >
                  <Trophy size={22} /> Nouveau record&nbsp;!
                </motion.div>
              ) : (
                <div className="results-record">
                  <Trophy size={18} /> Record&nbsp;: {gameRecord.bestScore}
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
          </>
        )}

        {mode === "adventure" && won && gameRecord.newCharacters.length > 0 && (
          <motion.div
            className="results-new"
            initial={{ opacity: 0, scale: 0.6, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
              delay: (STAR_FIRST_MS + stars * STAR_GAP_MS) / 1000,
              type: "spring",
              stiffness: 300,
              damping: 14,
            }}
          >
            <span className="results-new-label">
              {frenchSpacing(
                gameRecord.newCharacters.length > 1 ? "Nouveaux persos !" : "Nouveau perso !"
              )}
            </span>
            <div className="results-new-list">
              {gameRecord.newCharacters.slice(0, 5).map((c) => (
                <figure key={c.name}>
                  <img src={c.imageSrc} alt="" width={48} height={48} />
                  <figcaption>{c.label}</figcaption>
                </figure>
              ))}
            </div>
          </motion.div>
        )}

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
          {mode === "daily" && (
            <motion.button
              className="results-btn results-btn-share"
              onClick={handleShare}
              whileTap={{ scale: 0.94 }}
              autoFocus
            >
              <Share2 size={26} /> {copied ? frenchSpacing("Copié !") : "Partager"}
            </motion.button>
          )}
          {mapFirst && (
            <motion.button
              className="results-btn results-btn-replay"
              onClick={() => goTo("/adventure")}
              whileTap={{ scale: 0.94 }}
              autoFocus
            >
              <MapIcon size={28} /> Carte
            </motion.button>
          )}
          {nextUrl && (
            <motion.button
              className="results-btn results-btn-replay"
              onClick={() => goTo(nextUrl)}
              whileTap={{ scale: 0.94 }}
              autoFocus
            >
              Niveau suivant <ArrowRight size={28} />
            </motion.button>
          )}
          <motion.button
            className={`results-btn ${
              mode === "daily" || nextUrl || mapFirst ? "results-btn-second" : "results-btn-replay"
            }`}
            onClick={handleReplay}
            whileTap={{ scale: 0.94 }}
            autoFocus={mode !== "daily" && !nextUrl && !mapFirst}
          >
            <RefreshCw size={nextUrl || mapFirst || mode === "daily" ? 22 : 28} /> Rejouer
          </motion.button>
          <div className="results-row">
            {mode !== "daily" && !mapFirst && (
              <motion.button
                className="results-btn results-btn-home results-btn-map"
                onClick={() => goTo("/adventure")}
                whileTap={{ scale: 0.94 }}
              >
                <MapIcon size={22} /> Carte
              </motion.button>
            )}
            {mode !== "adventure" && (
              <motion.button
                className="results-btn results-btn-home"
                onClick={() => goTo("/")}
                whileTap={{ scale: 0.94 }}
              >
                <House size={22} /> Accueil
              </motion.button>
            )}
          </div>
        </motion.div>

        {mode === "endless" && (
          <motion.button
            className="results-profile"
            variants={item}
            onClick={() => setChoosingProfile(true)}
          >
            Changer de joueur
          </motion.button>
        )}
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

// « Défi du 03/10 »
function dailyLabel(record: GameRecord): string {
  const [, month, day] = (record.dailyDate ?? "").split("-");
  return month && day ? `Défi du ${day}/${month}` : "Défi du jour";
}
