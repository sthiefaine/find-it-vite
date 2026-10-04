import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import styles from "./Countdown.module.css";
import { useShallow } from "zustand/react/shallow";
import { gameConstants, GameStateEnum, useGameStore } from "../../../store/store";
import { randomIntFromInterval } from "../../helpers/gameUtils";
import { playCountdownSound, playStartSound } from "../../helpers/sounds";

export const Countdown = () => {
  const { setGameState, setSoundSrc } = useGameStore(
    useShallow((state) => {
      return {
        setGameState: state.setGameState,
        setSoundSrc: state.setSoundSrc,
      };
    })
  );
  const [countdown, setCountdown] = useState(gameConstants.COUNTDOWN);
  const [rotate, setRotate] = useState(0);
  const [rotateOrigin, setRotateOrigin] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      setRotate(randomIntFromInterval(-10, 10));
      setRotateOrigin(randomIntFromInterval(-10, 10));
      setSoundSrc(playCountdownSound);

      const timeout = setTimeout(() => {
        setCountdown(countdown - 1000);
      }, 1000);
      return () => clearTimeout(timeout);
    } else if (countdown === 0) {
      setSoundSrc(playStartSound);
      setGameState(GameStateEnum.PLAYING);
    }
  }, [countdown, setGameState, setSoundSrc]);

  // Couleurs des menus : violet, orange, rose
  const getColor = (countdownValue: number) => {
    switch (countdownValue) {
      case 3:
        return "#8739f9";
      case 2:
        return "#ff8a00";
      case 1:
        return "#ff3d7f";
      default:
        return "#8739f9";
    }
  };

  if (countdown === 0) return null;

  return (
    <div className={styles.container}>
      <motion.span
        className={styles.timer}
        key={countdown}
        style={{ backgroundColor: getColor(countdown / 1000) }}
        initial={{ scale: 0.4, rotate: rotate }}
        animate={{ scale: 1, rotate: rotateOrigin }}
        transition={{ type: "spring", stiffness: 300, damping: 14 }}
      >
        {countdown / 1000}
      </motion.span>
    </div>
  );
};
