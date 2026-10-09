import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Zap } from "lucide-react";
import { useGameStore } from "../../../../store/store";
import { useTranslation } from "../../../i18n";
import "./CaptureCelebration.css";

export function CaptureCelebration() {
  const feedback = useGameStore(state => state.captureFeedback);
  const { t: tr } = useTranslation();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(feedback?.celebration === "combo");
    if (feedback?.celebration !== "combo") return;
    const timer = setTimeout(() => setVisible(false), 950);
    return () => clearTimeout(timer);
  }, [feedback]);
  return <div className="capture-celebration-layer" role="status" aria-live="polite" aria-atomic="true">
    <AnimatePresence>
      {visible && feedback && <motion.div key={feedback.key} className="capture-celebration"
        initial={reduced ? false : { opacity: 0, scale: .85, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}>
        <Zap aria-hidden="true" fill="currentColor" />{tr("Série de {{count}} !", { count: feedback.count })}
      </motion.div>}
    </AnimatePresence>
  </div>;
}
