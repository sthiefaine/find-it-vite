import { useShallow } from "zustand/shallow";
import {useGameStore } from "../../../../../store/store";
import "./Timer.css";
import NumberFlow from "@number-flow/react";

export const Timer = () => {
  const {
    timeLeft,
  } = useGameStore(
    useShallow((state) => ({
      timeLeft: state.timeLeft,
      setTimeLeft: state.setTimeLeft,
      setGameState: state.setGameState,
      pauseTimer: state.pauseTimer,
      gameState: state.gameState,
    }))
  );

  const isUrgent = timeLeft <= 10 && timeLeft > 0;

  return (
    <div className={`timer ${isUrgent ? 'timer-urgent' : ''}`}>
      <div className="timer-label">Temps</div>
      <div className="timer-value"><NumberFlow value={timeLeft} /></div>
    </div>
  );
};

export default Timer;