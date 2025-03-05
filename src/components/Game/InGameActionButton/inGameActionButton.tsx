import {
  CircleStop,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import styles from "./inGameActionButton.module.css";
import { motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { playClickSound } from "../../../helpers/sounds";
import { Button } from "../../Buttons/button/button";

export default function InGameActionButton() {
  const { gameState, setSound, sound, setSoundSrc } = useGameStore(
    useShallow((state) => ({
      gameState: state.gameState,
      setSound: state.setSound,
      sound: state.sound,
      setSoundSrc: state.setSoundSrc,
    }))
  );

  const handleOnClickSoundButton = () => {
    if (!sound) {
      console.log('test')
      setSoundSrc(playClickSound);
      return setSound(!sound);
    }
    setSound(!sound);
  };
  return (
    <div className={styles.container}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {sound ? (
          <Button
            icon={<Volume2 />}
            onClick={() => handleOnClickSoundButton()}
          />
        ) : (
          <Button
            icon={<VolumeX />}
            onClick={() => handleOnClickSoundButton()}
          />
        )}
      </motion.div>
      {gameState === GameStateEnum.PLAYING && (
        <>
          <motion.div
            style={{ width: "100%" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              icon={<CircleStop />}
              text="Arreter"
              gameState={GameStateEnum.END}
            />
          </motion.div>
        </>
      )}

      {(gameState === GameStateEnum.END || gameState === GameStateEnum.FINISH) && (
        <>
          <motion.div
            style={{ width: "100%" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              icon={<RefreshCw />}
              text="Rejouer"
              gameState={GameStateEnum.RESET}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}
