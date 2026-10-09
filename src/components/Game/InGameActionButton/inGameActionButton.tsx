import { useTranslation } from "../../../i18n";
import { CircleStop, Volume2, VolumeX } from "lucide-react";
import styles from "./inGameActionButton.module.css";
import { motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { playClickSound } from "../../../helpers/sounds";
import { Button } from "../../Buttons/button/button";

export default function InGameActionButton() {
  const { t: tr } = useTranslation();
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
      setSound(true);
      setSoundSrc(playClickSound);
      return;
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
        <Button
          icon={sound ? <Volume2 /> : <VolumeX />}
          label={tr(sound ? "Couper le son" : "Activer le son")}
          onClick={() => handleOnClickSoundButton()}
        />
      </motion.div>
      {gameState === GameStateEnum.PLAYING && (
        <>
          <motion.div
            className={styles.stop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              icon={<CircleStop />}
              text={tr("Arrêter")}
              gameState={GameStateEnum.END}
            />
          </motion.div>
        </>
      )}
      {/* En fin de partie, Rejouer est sur l'écran de fin (components/Results) */}
    </div>
  );
}
