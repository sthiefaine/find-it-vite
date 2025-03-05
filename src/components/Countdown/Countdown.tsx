import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import styles from "./countdown.module.css";
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

  const getColor = (countdownValue: number) => {
    switch (countdownValue) {
      case 3:
        return "rgb(102, 126, 234)";
      case 2:
        return "rgb(49, 90, 231)";
      case 1:
        return "rgb(68, 178, 232)";
      default:
        return "#ffffff";
    }
  };

  if (countdown === 0) return null;

  return (
    <div className={styles.container}>
      <motion.span
        className={styles.timer}
        key={countdown}
        initial={{
          scale: 0.5,
          rotate: rotate,
          color: getColor(countdown / 1000),
        }}
        animate={{
          scale: 1,
          rotate: rotateOrigin,
          color: getColor(countdown / 1000),
        }}
        transition={{ duration: 1 }}
      >
        {countdown / 1000}
      </motion.span>
    </div>
  );
};
