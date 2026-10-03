import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import type { Tier } from "../../engine/types";
import "./ProfilePicker.css";

const PROFILES: { tier: Tier; emoji: string; label: string; age: string }[] = [
  { tier: "easy", emoji: "🐣", label: "Petit", age: "5-8 ans" },
  { tier: "normal", emoji: "🦊", label: "Moyen", age: "9-12 ans" },
  { tier: "expert", emoji: "🦁", label: "Expert", age: "13 ans et +" },
];

type Props = {
  onPick: (tier: Tier) => void;
  onCancel?: () => void; // absent au premier lancement : il faut choisir
  current?: Tier | null;
};

// Fenêtre « Qui joue ? » : règle la difficulté de la partie.
// Rendue dans <body> pour que le voile couvre tout l'écran, en-tête compris
// (sinon le bouton retour reste visible au-dessus, mais intouchable).
export default function ProfilePicker({ onPick, onCancel, current }: Props) {
  return createPortal(
    <motion.div
      className={`profile-overlay${onCancel ? "" : " profile-overlay-first"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
    >
      <motion.div
        className="profile-card"
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
      >
        <h2 id="profile-title">Qui joue ?</h2>
        <div className="profile-choices">
          {PROFILES.map((p, i) => (
            <motion.button
              key={p.tier}
              className={`profile-choice profile-${p.tier}${
                current === p.tier ? " profile-current" : ""
              }`}
              onClick={() => onPick(p.tier)}
              whileTap={{ scale: 0.94 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              data-tier={p.tier}
            >
              <span className="profile-emoji" aria-hidden="true">
                {p.emoji}
              </span>
              <span className="profile-text">
                <strong>{p.label}</strong>
                <span>{p.age}</span>
              </span>
            </motion.button>
          ))}
        </div>
        {onCancel && (
          <button className="profile-cancel" onClick={onCancel}>
            Annuler
          </button>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}
