import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Zap } from "lucide-react";
import { useGameStore } from "../../../../store/store";
import { useTranslation } from "../../../i18n";
import { CLEAN_TARGET, QUICK_TARGET, STREAK_REWARD } from "../../../game/streaks";
import { DAILY_REWARD_TARGET } from "../../../game/dailyReward";
import { GameIcon } from "../../Icons/GameIcon";
import "./StreakDisplay.css";

export function StreakDisplay() {
  const { t: tr } = useTranslation();
  const streaks = useGameStore(state => state.streaks);
  const toast = useGameStore(state => state.bonusToast);
  const daily = useGameStore(state => state.dailyReward);
  const reduced = useReducedMotion();
  const [visibleToast, setVisibleToast] = useState(false);
  const [hint, setHint] = useState<"clean" | "quick" | null>(null);
  useEffect(() => {
    if (!toast) return;
    setVisibleToast(true);
    const timer = setTimeout(() => setVisibleToast(false), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 5000);
    return () => clearTimeout(timer);
  }, [hint]);
  const rows = [
    { id: "clean", target: CLEAN_TARGET, value: streaks.clean % CLEAN_TARGET, description: tr("{{count}} portraits d’affilée sans erreur.", { count: CLEAN_TARGET }), icon: <GameIcon name="check" /> },
    { id: "quick", target: QUICK_TARGET, value: streaks.quick % QUICK_TARGET, description: tr("{{count}} portraits d’affilée en moins de 10 secondes chacun.", { count: QUICK_TARGET }), icon: <Zap aria-hidden="true" fill="currentColor" /> },
  ] as const;
  return <div className="streak-hud">
    {rows.map(row => <button key={row.id} type="button" className={`streak-pill streak-${row.id}`}
      onClick={() => setHint(hint === row.id ? null : row.id)} aria-expanded={hint === row.id}
      aria-label={`${row.description} ${row.value}/${row.target}. ${tr("Étoiles gagnées : +{{count}}", { count: STREAK_REWARD })}`}>
      <span className="streak-fill" style={{ width: `${row.value / row.target * 100}%` }} />
      {row.icon}<b>{row.value}<small>/{row.target}</small></b><span className="streak-prize">+{STREAK_REWARD}<GameIcon name="star" /></span>
    </button>)}
    {daily && <div className={`streak-daily${daily.unlocked || daily.claimedBefore ? " is-earned" : ""}`}
      aria-label={daily.unlocked || daily.claimedBefore ? tr("Récompense obtenue") : tr("{{count}} trouvés = 1 personnage", { count: DAILY_REWARD_TARGET })}>
      <GameIcon name={daily.unlocked || daily.claimedBefore ? "check" : "album"} />
      <b>{daily.unlocked || daily.claimedBefore ? tr("Débloqué") : `${Math.min(streaks.found, DAILY_REWARD_TARGET)}/${DAILY_REWARD_TARGET}`}</b>
    </div>}
    {hint && <div className="streak-hint" role="status">{rows.find(row => row.id === hint)!.description}<strong>+{STREAK_REWARD}<GameIcon name="star" /></strong></div>}
    <AnimatePresence>
      {toast && visibleToast && <motion.div key={toast.key} className="streak-bonus" role="status"
        initial={reduced ? false : { opacity: 0, y: 8, scale: .8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}>
        +{toast.stars}<GameIcon name="star" />
      </motion.div>}
    </AnimatePresence>
  </div>;
}
