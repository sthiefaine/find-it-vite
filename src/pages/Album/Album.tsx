import { useTranslation } from "../../i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSaveStore } from "../../save/saveStore";
import { masteryOf } from "../../content/progress";
import type { CharacterDetails } from "../../helpers/characters";
import { portraitStyle } from "../../helpers/portraitScale";
import { ALBUM_COLLECTIONS, caughtCount, MEDALS, nextMedal } from "./albumLogic";
import { albumCharacterLabel, sortedAlbumEntries } from "./albumNames";
import { ANIMAL_COLORS, animalCategoryLabel, animalSpeciesLabel, normalizedAnimalMetadata } from "../../content/animalTaxonomy";
import { isAnimalUnlocked } from "../../content/unlockedAnimals";
import "../../components/Buttons/ui.css";
import "./Album.css";

type Picked = { character: CharacterDetails; count: number };

const Album = () => {
  const { locale, languageTag, t: tr } = useTranslation();
  const collection = useSaveStore((s) => s.save.collection);
  const [worldId, setWorldId] = useState(ALBUM_COLLECTIONS[0].id);
  const [picked, setPicked] = useState<Picked | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState("");
  const [species, setSpecies] = useState("");
  const [color, setColor] = useState("");
  const world = ALBUM_COLLECTIONS.find((w) => w.id === worldId) ?? ALBUM_COLLECTIONS[0];
  const all = caughtCount({ collection });
  const compareNames = useMemo(() => new Intl.Collator(languageTag, { sensitivity: "base" }).compare, [languageTag]);
  const categories = [...new Set(world.characters.flatMap((c) => c.tags ?? []))]
    .sort((left, right) => compareNames(tr(animalCategoryLabel(left)), tr(animalCategoryLabel(right))));
  const speciesList = [...new Set(world.characters.flatMap((c) => c.species ? [c.species] : []))]
    .sort((left, right) => compareNames(tr(animalSpeciesLabel(left)), tr(animalSpeciesLabel(right))));
  const colors = Object.entries(ANIMAL_COLORS)
    .sort(([, left], [, right]) => compareNames(tr(left.label), tr(right.label)));
  const entries = useMemo(() => sortedAlbumEntries(world.characters, locale), [world.characters, locale]);
  const visible = entries.filter(({ character: animal }) => {
    const metadata = normalizedAnimalMetadata(animal);
    return (!category || metadata.tags.includes(category)) && (!species || metadata.species === species)
      && (!world.allowColorFilter || !color || metadata.dominantColors.some((c) => c === color));
  });

  useEffect(() => {
    if (!picked) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPicked(null);
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [picked]);

  return (
    <div className="fi-screen">
      <div className="fi-inner album-inner">
        <div className="album-total">
          <span className="fi-chip album-total-chip">
            📖 {all.caught}/{all.total}
          </span>
        </div>

        <div className="album-tabs" role="tablist">
          {ALBUM_COLLECTIONS.map((w) => {
            const n = caughtCount({ collection }, w.characters);
            return (
              <button
                key={w.id}
                role="tab"
                aria-selected={w.id === worldId}
                aria-label={tr(w.name)}
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
          {tr(world.name)}
        </h2>
        {world.id === "animaux" && <p className="album-unlock-hint">{tr("Cinq animaux sont disponibles dès le départ. Retrouve les autres dans l’Aventure ou le défi du jour pour les débloquer en Infini.")}</p>}
        {world.alwaysAvailable && <p className="album-unlock-hint">{tr("Tous ces portraits sont disponibles dès le départ en Infini et en Duel.")}</p>}
        {world.alwaysAvailable && <p className="album-unlock-hint">{tr("Touche un portrait pour découvrir son histoire.")}</p>}

        <div className="album-filters">
          {categories.length > 0 && <label>{tr("Catégorie")}<select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">{tr("Toutes")}</option>
            {categories.map((tag) => <option key={tag} value={tag}>{tr(animalCategoryLabel(tag))}</option>)}
          </select></label>}
          {speciesList.length > 0 && <label>{tr("Espèce")}<select value={species} onChange={(event) => setSpecies(event.target.value)}>
            <option value="">{tr("Toutes")}</option>
            {speciesList.map((id) => <option key={id} value={id}>{tr(animalSpeciesLabel(id))}</option>)}
          </select></label>}
          {world.allowColorFilter && <label>{tr("Couleur")}<select value={color} onChange={(event) => setColor(event.target.value)}>
            <option value="">{tr("Toutes")}</option>
            {colors.map(([id, value]) => <option key={id} value={id}>{tr(value.label)}</option>)}
          </select></label>}
        </div>
        <p className="album-filter-count" aria-live="polite">{tr("{{count}} portraits", { count: visible.length })}</p>
        <div className="album-grid">
          {visible.map(({ character: c, label }) => {
            const count = collection[c.name] ?? 0;
            const mastery = masteryOf(count);
            const medal = MEDALS[mastery];
            if (!world.alwaysAvailable && !isAnimalUnlocked({ collection }, c.name)) {
              return (
                <div key={c.name} className="album-card album-card-unknown" aria-label={tr("Pas encore trouvé")}>
                  <img src={c.imageSrc} alt="" draggable={false} style={portraitStyle(c.imageSrc)} />
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
                <img src={c.imageSrc} alt="" draggable={false} style={portraitStyle(c.imageSrc)} />
                <span className="album-card-label">{label}</span>
                {count === 0 && <span className="album-available-label">{tr("Disponible")}</span>}
              </button>
            );
          })}
        </div>
        {visible.length === 0 && <p className="album-empty">{tr("Aucun portrait ne correspond à ces filtres.")}</p>}
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
            aria-labelledby="album-character-name"
            aria-describedby={picked.character.profile ? "album-character-description" : undefined}
          >
            <motion.div
              ref={dialogRef}
              tabIndex={-1}
              className={`album-big album-card-${masteryOf(picked.count)}`}
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.6 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
            >
              <button type="button" className="album-close" aria-label={tr("Fermer")} onClick={() => setPicked(null)}>×</button>
              {MEDALS[masteryOf(picked.count)] && (
                <span className="album-card-medal">{MEDALS[masteryOf(picked.count)]}</span>
              )}
              <img src={picked.character.imageSrc} alt="" draggable={false} style={portraitStyle(picked.character.imageSrc)} />
              <strong id="album-character-name">{albumCharacterLabel(picked.character, locale)}</strong>
              {picked.character.profile && <div className="album-biography" lang="fr" dir="ltr">
                {picked.character.profile.period && <span className="album-biography-period">{picked.character.profile.period}</span>}
                <p id="album-character-description">{picked.character.profile.description}</p>
                <a href={picked.character.profile.source.url} target="_blank" rel="noopener noreferrer">
                  {tr("En savoir plus")} · {picked.character.profile.source.label}<span aria-hidden="true"> ↗</span>
                </a>
              </div>}
              {picked.character.breed && <span>{tr(picked.character.breed)}</span>}
              {world.allowColorFilter && <div className="album-colors" aria-label={tr("Couleurs dominantes")}>
                {normalizedAnimalMetadata(picked.character).dominantColors.map((color) => <span key={color} title={tr(ANIMAL_COLORS[color].label)} style={{ background: ANIMAL_COLORS[color].hex }} aria-label={tr(ANIMAL_COLORS[color].label)} />)}
              </div>}
              <span className="album-big-count">
                {picked.count > 0 ? tr("Trouvé {{count}} fois", { count: picked.count }) : tr("Disponible en Infini")}
              </span>
              {(() => {
                const next = nextMedal(picked.count);
                return next ? (
                  <span className="album-big-next">
                    {tr("Encore {{count}}", { count: next.left })} → {next.medal}
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
