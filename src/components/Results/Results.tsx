import { formatDailyDate } from "../../i18n/format";
import { useTranslation, translate as tr } from "../../i18n";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, Variants } from "framer-motion";
import { useShallow } from "zustand/shallow";
import { useNavigate } from "react-router-dom";
import { portraitStyle } from "../../helpers/portraitScale";
import NumberFlow from "@number-flow/react";
import {
  CircleX,
  Compass,
  Flag,
  House,
  Map as MapIcon,
  ChevronRight,
  RefreshCw,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";
import { GameStateEnum, GameRecord, useGameStore } from "../../../store/store";
import {
  playClickSound,
  playFinishSound,
  playNewHihScoreSound,
} from "../../helpers/sounds";
import {
  adventureRunMessage,
  formatSeconds,
  frenchSpacing,
  resultsTitle,
  scoreMessage,
} from "./resultsHelpers";
import { dailyShareText } from "../../game/modes";
import { GameIcon } from "../Icons/GameIcon";
import { DAILY_REWARD_TARGET } from "../../game/dailyReward";
import { STREAK_REWARD } from "../../game/streaks";
import { albumCharacterLabel } from "../../pages/Album/albumNames";
import "./Results.css";

// Apparition des blocs les uns après les autres
const STEP_S = 0.08;
const RECORD_STEP = 2;

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STEP_S, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24 },
  },
};

const pop: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 22 },
  },
};

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
  const { locale, t: tr } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
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
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameRecord) return;
    const dialog = dialogRef.current;
    dialog?.focus({ preventScroll: true });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const buttons = dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [gameRecord]);

  const mode = gameRecord?.mode ?? "endless";
  const score = gameRecord?.score ?? 0;
  const isNewRecord = gameRecord?.isNewRecord ?? false;
  const won = gameRecord?.won ?? false;
  const run = gameRecord?.adventure ?? null;
  const shownValue = mode === "adventure" ? (run?.stepsCleared ?? 0) : score;
  const escaped =
    gameState === GameStateEnum.FINISH &&
    !wantedFound &&
    wantedCharacter;

  // Le score défile, puis le son arrive avec la ligne du record
  useEffect(() => {
    if (!gameRecord) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setShownScore(shownValue), reducedMotion ? 0 : 250));
    timers.push(
      setTimeout(
        () => setSoundSrc(isNewRecord ? playNewHihScoreSound : playFinishSound),
        (0.1 + STEP_S * RECORD_STEP) * 1000
      )
    );
    return () => timers.forEach(clearTimeout);
  }, [gameRecord, shownValue, isNewRecord, setSoundSrc, reducedMotion]);

  if (!gameRecord) return null;

  const click = () => setSoundSrc(playClickSound);

  const handleReplay = () => {
    click();
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

  const dailyReward = gameRecord.dailyReward;
  const dailyEarned = dailyReward?.unlocked || dailyReward?.claimedBefore;
  const dailyPerson = dailyReward?.person;
  const dailyLeft = Math.max(0, DAILY_REWARD_TARGET - gameRecord.streaks.found);
  const title = () => mode === "daily" && dailyReward?.unlocked && dailyPerson
    ? tr("Nouveau personnage !") : resultsTitle(mode, { won, score, dailyLabel: dailyLabel(gameRecord) });

  const message = () => {
    if (mode === "daily") return dailyEarned ? tr("Récompense obtenue") : tr("Encore {{count}} portraits pour ta récompense.", { count: dailyLeft });
    if (mode === "adventure" && run) return adventureRunMessage({ ...run, phases: [] });
    return frenchSpacing(scoreMessage(score));
  };

  const celebration = mode === "daily" ? !!dailyEarned : mode === "adventure" ? won : score > 0;
  const tap = reducedMotion ? undefined : { scale: 0.97 };

  return (
    <motion.div
      className={`results-overlay results-${mode}`}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-title"
      aria-describedby="results-message"
    >
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        className="results-card"
        variants={list}
        initial={reducedMotion ? false : "hidden"}
        animate="show"
      >
        <motion.header className="results-title" variants={pop}>
          <div className="results-emblem" aria-hidden="true">
            <GameIcon name={celebration ? "trophy" : "paw"} />
            {celebration && <>
              <GameIcon name="star" className="results-sparkle results-sparkle-left" />
              <GameIcon name="star" className="results-sparkle results-sparkle-right" />
            </>}
          </div>
          <h2 id="results-title" className={title().length > 10 ? "results-title-long" : ""}>{title()}</h2>
          <p id="results-message" className="results-message">{message()}</p>
        </motion.header>

        {mode === "daily" && dailyReward && <motion.div className={`results-daily-prize${dailyEarned ? " is-earned" : ""}`} variants={pop}>
          <div className="results-daily-portrait">
            {dailyPerson ? <img src={dailyPerson.imageSrc} alt="" style={portraitStyle(dailyPerson.imageSrc)} /> : <GameIcon name="star" />}
            <span><GameIcon name={dailyEarned ? "check" : "daily"} /></span>
          </div>
          <div className="results-daily-copy">
            <span>{tr(dailyEarned ? dailyPerson ? "Débloqué" : "Récompense obtenue" : "À débloquer")}</span>
            <strong>{dailyPerson ? albumCharacterLabel(dailyPerson, locale) : tr("Étoiles gagnées : +{{count}}", { count: 5 })}</strong>
            {dailyEarned ? <button type="button" onClick={() => goTo(dailyPerson ? `/album?person=${encodeURIComponent(dailyPerson.name)}` : "/album")}>{tr("Voir dans l’album")}<ChevronRight size={15} aria-hidden="true" /></button>
              : <><div className="results-daily-track" role="progressbar" aria-label={tr("Défi du jour")} aria-valuemin={0} aria-valuemax={DAILY_REWARD_TARGET} aria-valuenow={Math.min(gameRecord.streaks.found, DAILY_REWARD_TARGET)}><span style={{ width: `${Math.min(gameRecord.streaks.found / DAILY_REWARD_TARGET, 1) * 100}%` }} /></div><b>{Math.min(gameRecord.streaks.found, DAILY_REWARD_TARGET)}/{DAILY_REWARD_TARGET}</b></>}
          </div>
        </motion.div>}

        {mode === "adventure" && run ? (
          <>
            <motion.div className="results-score" variants={item} aria-label={`${run.stepsCleared} ${tr("étapes", { count: run.stepsCleared })}`}>
              <GameIcon name="trophy" className="results-score-star" />
              <div className="results-score-total">
                <span className="results-score-value"><NumberFlow value={shownScore} animated={!reducedMotion} /></span>
                <span className="results-score-label">{tr("étapes", { count: run.stepsCleared })}</span>
              </div>
            </motion.div>
            <motion.ul className="results-stats" variants={item}>
              <li className="stat-level">
                <GameIcon name="star" />
                <strong>{run.starsEarned}</strong>
                <span>{tr("étoiles gagnées", { count: run.starsEarned })}</span>
              </li>
              <li className="stat-found">
                <GameIcon name="check" />
                <strong>{stats.found}</strong>
                <span>{tr("trouvés", { count: stats.found })}</span>
              </li>
              <li className="stat-world">
                <Compass size={22} />
                <strong>{run.discoveredWorlds.length}</strong>
                <span>{tr("mondes", { count: run.discoveredWorlds.length })}</span>
              </li>
              <li className="stat-new">
                <Sparkles size={22} />
                <strong>{gameRecord.newCharacters.length}</strong>
                <span>{tr("nouveaux", { count: gameRecord.newCharacters.length })}</span>
              </li>
            </motion.ul>
          </>
        ) : (
          <>
            <motion.div className="results-score" variants={item}>
              <GameIcon name="trophy" className="results-score-star" />
              <div className="results-score-total">
                <span className="results-score-value"><NumberFlow value={shownScore} animated={!reducedMotion} /></span>
                <span className="results-score-label">{tr("points", { count: score })}</span>
              </div>
            </motion.div>

            <motion.div variants={item}>
              {mode === "daily" ? (
                <div className="results-record">
                  <GameIcon name="trophy" /> {tr("Meilleur du jour :")} {gameRecord.dailyBest}
                </div>
              ) : gameRecord.calm ? (
                <div className="results-record"><GameIcon name="infinity" /> {tr("Mode calme")}</div>
              ) : isNewRecord ? (
                <motion.div
                  className="results-record results-record-new"
                  animate={reducedMotion ? undefined : { scale: [1, 1.03, 1] }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  <GameIcon name="trophy" /> {tr("Nouveau record !")} </motion.div>
              ) : (
                <div className="results-record">
                  <GameIcon name="trophy" /> {tr("Record :")} {gameRecord.bestScore}
                </div>
              )}
            </motion.div>

            <motion.ul className="results-stats" variants={item}>
              <li className="stat-found">
                <GameIcon name="check" />
                <strong>{stats.found}</strong>
                <span>{tr("trouvés", { count: stats.found })}</span>
              </li>
              <li className="stat-miss">
                <CircleX size={22} />
                <strong>{stats.misses}</strong>
                <span>{tr("erreurs", { count: stats.misses })}</span>
              </li>
              <li className="stat-fast">
                <Zap size={22} />
                <strong>{formatSeconds(stats.fastestFoundMs)}</strong>
                <span>{tr("plus rapide")}</span>
              </li>
              <li className="stat-level">
                <Flag size={22} />
                <strong>{gameRecord.level}</strong>
                <span>{tr("niveau")}</span>
              </li>
            </motion.ul>
          </>
        )}

        {mode === "adventure" && gameRecord.newCharacters.length > 0 && (
          <motion.div
            className="results-new"
            variants={item}
          >
            <span className="results-new-label"><GameIcon name="album" />
              {frenchSpacing(
                gameRecord.newCharacters.length > 1 ? tr("Nouvelles découvertes !") : tr("Nouvelle découverte !")
              )}
            </span>
            <div className="results-new-list">
              {gameRecord.newCharacters.slice(0, 5).map((c) => (
                <figure key={c.name}>
                  <img src={c.imageSrc} alt="" width={48} height={48} style={portraitStyle(c.imageSrc)} />
                  <figcaption>{tr(c.label)}</figcaption>
                </figure>
              ))}
            </div>
          </motion.div>
        )}

        {escaped && (
          <motion.div className="results-escaped" variants={item}>
            <img src={wantedCharacter.imageSrc} alt="" width={52} height={52} style={portraitStyle(wantedCharacter.imageSrc)} />
            <div>
              <span>{tr("Il t'a échappé")}</span>
              <strong>{tr(wantedCharacter.label)}</strong>
            </div>
          </motion.div>
        )}

        <motion.section className="results-loot" variants={item} aria-label={tr("Ton butin")}>
          <GameIcon name="star" />
          <div><span>{tr("Ton butin")}</span><strong>+{gameRecord.earnedStars}</strong></div>
          <span className="results-loot-caption">{tr("Dans ta réserve d’étoiles")}</span>
          {(gameRecord.streaks.cleanBonuses + gameRecord.streaks.quickBonuses > 0) && <div className="results-loot-bonuses">
            {gameRecord.streaks.cleanBonuses > 0 && <span><GameIcon name="check" />{tr("Sans erreur")} <b>+{gameRecord.streaks.cleanBonuses * STREAK_REWARD}</b></span>}
            {gameRecord.streaks.quickBonuses > 0 && <span><Zap size={14} aria-hidden="true" />{tr("Rapidité")} <b>+{gameRecord.streaks.quickBonuses * STREAK_REWARD}</b></span>}
          </div>}
        </motion.section>
        <motion.div className="results-actions" variants={item}>
          <motion.button type="button" className="results-btn results-btn-replay"
            onClick={mode === "daily" && dailyEarned ? () => goTo("/adventure") : handleReplay} whileTap={tap}>
            <GameIcon name="play" /> {tr(mode === "daily" && dailyEarned ? "Continuer à jouer" : "Rejouer")}
          </motion.button>
          {mode === "daily" && <div className="results-row">
            <motion.button type="button" className="results-btn results-btn-second" onClick={handleShare} whileTap={tap}><Share2 size={18} />{copied ? frenchSpacing(tr("Copié !")) : tr("Partager")}</motion.button>
            {dailyEarned && <motion.button type="button" className="results-btn results-btn-second" onClick={handleReplay} whileTap={tap}><RefreshCw size={18} />{tr("Rejouer")}</motion.button>}
          </div>}
          <div className="results-row">
            {mode !== "daily" && (
              <motion.button
                className="results-btn results-btn-home results-btn-map"
                onClick={() => goTo("/adventure")}
                whileTap={tap}
              >
                <MapIcon size={22} /> {tr("Carte")} </motion.button>
            )}
            <motion.button
              className="results-btn results-btn-home"
              onClick={() => goTo("/")}
              whileTap={tap}
            >
              <House size={22} /> {tr("Accueil")} </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// « Défi du 03/10 »
function dailyLabel(record: GameRecord): string {
  const [, month, day] = (record.dailyDate ?? "").split("-");
  return month && day ? tr("Défi du {{date}}", { date: formatDailyDate(record.dailyDate ?? "") }) : tr("Défi du jour");
}
