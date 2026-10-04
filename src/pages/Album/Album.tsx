import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSaveStore } from "../../save/saveStore";
import { WORLDS } from "../../content/worlds";
import { masteryOf } from "../../content/progress";
import type { CharacterDetails } from "../../helpers/characters";
import { caughtCount, MEDALS, nextMedal } from "./albumLogic";
import { ANIMAL_COLORS, animalCategoryLabel, animalSpeciesLabel, normalizedAnimalMetadata } from "../../content/animalTaxonomy";
import { isAnimalUnlocked } from "../../content/unlockedAnimals";
import "../../components/Buttons/ui.css";
import "./Album.css";

type Picked = { character: CharacterDetails; count: number };

const Album = () => {
  const collection = useSaveStore((s) => s.save.collection);
  const [worldId, setWorldId] = useState(WORLDS[0].id);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [category, setCategory] = useState("");
  const [species, setSpecies] = useState("");
  const [color, setColor] = useState("");
  const world = WORLDS.find((w) => w.id === worldId) ?? WORLDS[0];
  const all = caughtCount({ collection });
  const categories = [...new Set(world.characters.flatMap((c) => c.tags ?? []))];
  const speciesList = [...new Set(world.characters.flatMap((c) => c.species ? [c.species] : []))];
  const visible = world.characters.filter((animal) => {
    const metadata = normalizedAnimalMetadata(animal);
    return (!category || metadata.tags.includes(category)) && (!species || metadata.species === species)
      && (!color || metadata.dominantColors.some((c) => c === color));
  });

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
                onClick={() => { setWorldId(w.id); setCategory(""); setSpecies(""); setColor(""); }}
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
        {world.id === "animaux" && <p className="album-unlock-hint">Cinq animaux sont disponibles dès le départ. Retrouve les autres dans l’Aventure ou le défi du jour pour les débloquer en Infini.</p>}

        <div className="album-filters">
          {categories.length > 0 && <label>Catégorie<select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Toutes</option>
            {categories.map((tag) => <option key={tag} value={tag}>{animalCategoryLabel(tag)}</option>)}
          </select></label>}
          {speciesList.length > 0 && <label>Espèce<select value={species} onChange={(event) => setSpecies(event.target.value)}>
            <option value="">Toutes</option>
            {speciesList.map((id) => <option key={id} value={id}>{animalSpeciesLabel(id)}</option>)}
          </select></label>}
          <label>Couleur<select value={color} onChange={(event) => setColor(event.target.value)}>
            <option value="">Toutes</option>
            {Object.entries(ANIMAL_COLORS).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}
          </select></label>
        </div>
        <p className="album-filter-count" aria-live="polite">{visible.length} portrait{visible.length > 1 ? "s" : ""}</p>
        <div className="album-grid">
          {visible.map((c) => {
            const count = collection[c.name] ?? 0;
            const mastery = masteryOf(count);
            const medal = MEDALS[mastery];
            if (!isAnimalUnlocked({ collection }, c.name)) {
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
                className={`album-card album-card-${mastery}${count === 0 ? " album-card-available" : ""}`}
                onClick={() => setPicked({ character: c, count })}
              >
                {medal && <span className="album-card-medal">{medal}</span>}
                <img src={c.imageSrc} alt="" draggable={false} />
                <span className="album-card-label">{c.label}</span>
                {count === 0 && <span className="album-available-label">Disponible</span>}
              </button>
            );
          })}
        </div>
        {visible.length === 0 && <p className="album-empty">Aucun animal ne correspond à ces filtres.</p>}
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
              {picked.character.breed && <span>{picked.character.breed}</span>}
              <div className="album-colors" aria-label="Couleurs dominantes">
                {normalizedAnimalMetadata(picked.character).dominantColors.map((color) => <span key={color} title={ANIMAL_COLORS[color].label} style={{ background: ANIMAL_COLORS[color].hex }} aria-label={ANIMAL_COLORS[color].label} />)}
              </div>
              <span className="album-big-count">
                {picked.count > 0 ? `Trouvé ${picked.count} fois` : "Disponible en Infini"}
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
