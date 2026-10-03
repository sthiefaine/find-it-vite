import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSaveStore } from "../../save/saveStore";
import { WORLDS } from "../../content/worlds";
import { masteryOf } from "../../content/progress";
import type { CharacterDetails } from "../../helpers/characters";
import { caughtCount, MEDALS, nextMedal } from "./albumLogic";
import "../../components/Buttons/ui.css";
import "./Album.css";

type Picked = { character: CharacterDetails; count: number };

const Album = () => {
  const collection = useSaveStore((s) => s.save.collection);
  const [worldId, setWorldId] = useState(WORLDS[0].id);
  const [picked, setPicked] = useState<Picked | null>(null);
  const world = WORLDS.find((w) => w.id === worldId) ?? WORLDS[0];
  const all = caughtCount({ collection });

  return (
    <div className="fi-screen">
      <div className="fi-inner album-inner">
        <div className="album-total">
          <span className="fi-chip album-total-chip">
            📖 {all.caught}/{all.total}
          </span>
        </div>

        <div className="album-tabs" role="tablist">
          {WORLDS.map((w) => {
            const n = caughtCount({ collection }, w.characters);
            return (
              <button
                key={w.id}
                role="tab"
                aria-selected={w.id === worldId}
                aria-label={w.name}
                className={`album-tab${w.id === worldId ? " album-tab-on" : ""}`}
                onClick={() => setWorldId(w.id)}
              >
                <span className="album-tab-emoji">{w.emoji}</span>
                <span className="album-tab-count">{n.caught}/{n.total}</span>
              </button>
            );
          })}
        </div>

        <h2 className="album-world" style={{ background: world.background }}>
          {world.name}
        </h2>

        <div className="album-grid">
          {world.characters.map((c) => {
            const count = collection[c.name] ?? 0;
            const mastery = masteryOf(count);
            const medal = MEDALS[mastery];
            if (count === 0) {
              return (
                <div key={c.name} className="album-card album-card-unknown" aria-label="Pas encore trouvé">
                  <img src={c.imageSrc} alt="" draggable={false} />
                  <span className="album-card-q">?</span>
                </div>
              );
            }
            return (
              <button
                key={c.name}
                className={`album-card album-card-${mastery}`}
                onClick={() => setPicked({ character: c, count })}
              >
                {medal && <span className="album-card-medal">{medal}</span>}
                <img src={c.imageSrc} alt="" draggable={false} />
                <span className="album-card-label">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {picked && (
          <motion.div
            className="album-overlay"
            onClick={() => setPicked(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className={`album-big album-card-${masteryOf(picked.count)}`}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.6 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
            >
              {MEDALS[masteryOf(picked.count)] && (
                <span className="album-card-medal">{MEDALS[masteryOf(picked.count)]}</span>
              )}
              <img src={picked.character.imageSrc} alt="" draggable={false} />
              <strong>{picked.character.label}</strong>
              <span className="album-big-count">
                Trouvé {picked.count} fois
              </span>
              {(() => {
                const next = nextMedal(picked.count);
                return next ? (
                  <span className="album-big-next">
                    Encore {next.left} → {next.medal}
                  </span>
                ) : null;
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Album;
