import { useEffect, useRef, useState } from "react";
import { useSaveStore } from "../../save/saveStore";
import { FRAMES, isFrameUnlocked } from "../../content/progress";
import { DEFAULT_TIER } from "../../save/schema";
import type { PlayerTier } from "../../save/schema";
import "../../components/Buttons/ui.css";
import "./Options.css";

const PROFILES: { tier: PlayerTier; emoji: string; label: string }[] = [
  { tier: "easy", emoji: "🐣", label: "Enfant" },
  { tier: "normal", emoji: "🦊", label: "Normal" },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`opt-switch${on ? " opt-switch-on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className="opt-switch-knob">{on ? "✓" : ""}</span>
    </button>
  );
}

const Options = () => {
  const save = useSaveStore((s) => s.save);
  const { setSound, setCalm, setFrame, setProfileTier, resetSave } = useSaveStore.getState();
  const [confirmReset, setConfirmReset] = useState(false);
  const { sound, calm, frame } = save.settings;
  const tier = save.profile.tier ?? DEFAULT_TIER;
  // Sur petit écran, la confirmation tombe sous le bord : on la fait défiler dans la vue
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirmReset) confirmRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [confirmReset]);

  return (
    <div className="fi-screen">
      <div className="fi-inner opt-inner">
        <section className="opt-card opt-row">
          <span className="opt-icon" aria-hidden="true">{sound ? "🔊" : "🔇"}</span>
          <span className="opt-name">Son</span>
          <Toggle on={sound} onChange={setSound} label="Son" />
        </section>

        <section className="opt-card">
          <h2 className="opt-title">Qui joue ?</h2>
          <div className="opt-tiers">
            {PROFILES.map((p) => (
              <button
                key={p.tier}
                className={`opt-tier${tier === p.tier ? " opt-tier-on" : ""}`}
                aria-pressed={tier === p.tier}
                data-tier={p.tier}
                onClick={() => setProfileTier(p.tier)}
              >
                <span className="opt-tier-emoji" aria-hidden="true">{p.emoji}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="opt-card">
          <div className="opt-row">
            <span className="opt-icon" aria-hidden="true">🐢</span>
            <span className="opt-name">Mode calme</span>
            <Toggle on={calm} onChange={setCalm} label="Mode calme" />
          </div>
          <p className="opt-hint">Pas de chrono : on cherche tranquille.</p>
        </section>

        <section className="opt-card">
          <h2 className="opt-title">Cadre de l'avis</h2>
          <div className="opt-frames">
            {FRAMES.map((f) => {
              const unlocked = isFrameUnlocked(save, f.id);
              return (
                <button
                  key={f.id}
                  className={`opt-frame${frame === f.id ? " opt-frame-on" : ""}`}
                  disabled={!unlocked}
                  aria-pressed={frame === f.id}
                  onClick={() => setFrame(f.id)}
                >
                  <span className={`opt-frame-preview opt-frame-${f.id}`} aria-hidden="true">
                    🐾
                  </span>
                  <span className="opt-frame-name">
                    {unlocked ? f.name : <>🔒 {f.unlockStars}<span className="fi-star">★</span></>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="opt-card opt-danger">
          {!confirmReset ? (
            <button className="opt-reset" onClick={() => setConfirmReset(true)}>
              🗑️ Tout effacer
            </button>
          ) : (
            <div className="opt-confirm" ref={confirmRef}>
              <p>Sûr ? Étoiles et album seront perdus.</p>
              <div className="opt-confirm-btns">
                <button className="opt-no" onClick={() => setConfirmReset(false)}>
                  Non
                </button>
                <button
                  className="opt-reset"
                  onClick={() => {
                    void resetSave();
                    setConfirmReset(false);
                  }}
                >
                  Oui, effacer
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Options;
