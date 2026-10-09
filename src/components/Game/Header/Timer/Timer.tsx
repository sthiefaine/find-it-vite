import { useTranslation } from "../../../../i18n";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../../../../store/store";
import { useEffect, useRef } from "react";
import { playSound } from "../../../../audio/engine";
import "./Timer.css";
import NumberFlow from "@number-flow/react";

export const Timer = () => {
  const { t: tr } = useTranslation();
  const { timeLeft, calm, searching, runSeed } = useGameStore(
    useShallow((state) => ({ timeLeft: state.timeLeft, calm: state.calm, runSeed: state.runSeed,
      searching: state.gameState === GameStateEnum.PLAYING && !state.pauseTimer && !state.animationLevelLoading && !state.worldBanner && state.bonusEndsAt === null }))
  );
  const warned = useRef(false);
  useEffect(() => { warned.current = false; }, [runSeed]);
  useEffect(() => {
    if (timeLeft > 10) warned.current = false;
    if (calm || !searching || warned.current || timeLeft > 5 || timeLeft <= 0) return;
    warned.current = true;
    playSound("warning");
  }, [timeLeft, calm, searching]);

  const isUrgent = !calm && timeLeft <= 10 && timeLeft > 0;

  return (
    <div className={`timer ${isUrgent ? "timer-urgent" : ""} ${calm ? "timer-calm" : ""}`}>
      <div className="timer-label">{tr("Temps")}</div>
      <div className="timer-value">
        {calm ? <span aria-label={tr("Sans limite")}>∞</span> : <NumberFlow value={timeLeft} />}
      </div>
    </div>
  );
};

export default Timer;
