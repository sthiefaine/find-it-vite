import { useTranslation } from "../../i18n";
import { useEffect, useState } from "react";
import { useGameStore } from "../../../store/store";
import { playCountdownSound } from "../../helpers/sounds";
import { countdownAt } from "../../game/levelPreparation";
import styles from "./Countdown.module.css";

// Affichage seulement : le chargement des textures décide quand le jeu démarre.
export const Countdown = ({ until }: { until: number }) => {
  const { t: tr } = useTranslation();
  const [count, setCount] = useState(() => countdownAt(until, performance.now()));
  useEffect(() => {
    const update = () => setCount(countdownAt(until, performance.now()));
    update();
    const timer = setInterval(update, 80);
    return () => clearInterval(timer);
  }, [until]);
  const setSoundSrc = useGameStore(state => state.setSoundSrc);
  useEffect(() => {
    if (count > 0) setSoundSrc(playCountdownSound);
  }, [count, setSoundSrc]);

  return <div className={styles.container} role="status" aria-live="polite" aria-atomic="true">
    {count > 0
      ? <span key={count} className={styles.timer}>{count}</span>
      : <span className={styles.waiting} aria-label={tr("Chargement des images")}><i /><i /><i /></span>}
  </div>;
};
