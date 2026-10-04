import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useShallow } from "zustand/shallow";
import { useGameStore } from "../../../store/store";
import { STEP_TOAST_MS, welcomeText } from "../../game/adventureRun";
import { starsText } from "./stepToastText";
import "./StepToast.css";

// Bandeaux de l'Aventure, par-dessus le haut du plateau, sans bloquer le jeu :
// « Étape 3 ★★☆ » (1,5 s) et « Bienvenue dans l'Océan ! » (2 s, chrono en pause)
export default function StepToast() {
  const { stepToast, worldBanner } = useGameStore(
    useShallow((s) => ({ stepToast: s.stepToast, worldBanner: s.worldBanner }))
  );
  const [shownKey, setShownKey] = useState<number | null>(null);

  useEffect(() => {
    if (!stepToast) return;
    setShownKey(stepToast.key);
    const t = setTimeout(() => setShownKey(null), STEP_TOAST_MS);
    return () => clearTimeout(t);
  }, [stepToast]);

  const showStep = !!stepToast && shownKey === stepToast.key && !worldBanner;

  return (
    <div className="step-toast-layer" aria-live="polite">
      <AnimatePresence>
        {worldBanner ? (
          <motion.div
            key={`world-${worldBanner.key}`}
            className="world-banner"
            initial={{ opacity: 0, y: -30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
          >
            {welcomeText(worldBanner.phase)}
          </motion.div>
        ) : (
          showStep && (
            <motion.div
              key={`step-${stepToast.key}`}
              className="step-toast"
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              aria-label={`Étape ${stepToast.level}, ${stepToast.stars} étoile${stepToast.stars > 1 ? "s" : ""} sur 3`}
            >
              Étape {stepToast.level} <span className="step-toast-stars">{starsText(stepToast.stars)}</span>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
