import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import "./Discovery.css";
import type { LevelSpec } from "../../engine/types";
import { discoveryContent, nbsp } from "./discoveryContent";

const AUTO_CLOSE_MS = 3000;

type Props = {
  spec: LevelSpec;
  onClose: () => void;
};

// Le parent met le chrono en pause tant que la fenêtre est affichée
export const Discovery = ({ spec, onClose }: Props) => {
  const { icon, hint, gesture } = discoveryContent(spec);
  const closed = useRef(false);

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  };

  useEffect(() => {
    const t = setTimeout(close, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="discovery-backdrop"
      onPointerDown={close}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: "none" }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-label={hint}
    >
      <motion.div
        className="discovery-card"
        initial={{ scale: 0.4, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0.6, transition: { duration: 0.15 } }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
      >
        <div className="discovery-badge">Nouveau !</div>
        <div className="discovery-stage">
          <motion.div
            className="discovery-icon"
            animate={
              gesture === "tap"
                ? { scale: [1, 1, 0.88, 1.08, 1] }
                : { scale: [1, 1.06, 1] }
            }
            transition={{ duration: 1.2, repeat: Infinity, times: gesture === "tap" ? [0, 0.45, 0.55, 0.7, 1] : undefined }}
          >
            {icon}
          </motion.div>
          {gesture === "tap" ? <TapHand /> : <SwipeHand />}
        </div>
        <p className="discovery-hint">{nbsp(hint)}</p>
        <motion.div
          className="discovery-progress"
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: AUTO_CLOSE_MS / 1000, ease: "linear" }}
        />
      </motion.div>
    </motion.div>
  );
};

// Main fantôme qui tape sur l'icône
const TapHand = () => (
  <>
    <motion.div
      className="discovery-ripple"
      animate={{ scale: [0.2, 0.2, 1.6], opacity: [0, 0.8, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, times: [0, 0.5, 1] }}
    />
    <motion.div
      className="discovery-hand discovery-hand-tap"
      animate={{ x: [30, 0, 0, 30], y: [40, 0, 0, 40], scale: [1, 1, 0.85, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, times: [0, 0.45, 0.55, 1] }}
    >
      👆
    </motion.div>
  </>
);

// Main fantôme qui glisse avec un halo de lumière
const SwipeHand = () => (
  <motion.div
    className="discovery-swipe"
    animate={{ x: [-90, 90, -90] }}
    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
  >
    <div className="discovery-light" />
    <div className="discovery-hand">👆</div>
  </motion.div>
);

export default Discovery;
