import { useShallow } from "zustand/shallow";
import { useGameStore } from "../../../../../store/store";
import "./Timer.css";
import NumberFlow from "@number-flow/react";

export const Timer = () => {
  const { timeLeft, calm } = useGameStore(
    useShallow((state) => ({ timeLeft: state.timeLeft, calm: state.calm }))
  );

  const isUrgent = !calm && timeLeft <= 10 && timeLeft > 0;

  return (
    <div className={`timer ${isUrgent ? "timer-urgent" : ""} ${calm ? "timer-calm" : ""}`}>
      <div className="timer-label">Temps</div>
      <div className="timer-value">
        {calm ? <span aria-label="Sans limite">∞</span> : <NumberFlow value={timeLeft} />}
      </div>
    </div>
  );
};

export default Timer;
