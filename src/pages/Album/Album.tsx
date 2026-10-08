import { useTranslation } from "../../i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen, ChevronDown, HelpCircle, Sparkles, Star } from "lucide-react";
import { useSaveStore } from "../../save/saveStore";
import { masteryOf, MEDAL_THRESHOLDS } from "../../content/progress";
import type { CharacterDetails } from "../../helpers/characters";
import { portraitStyle } from "../../helpers/portraitScale";
import { ALBUM_COLLECTIONS, caughtCount, isAlbumCharacterUnlocked, MEDALS, nextMedal } from "./albumLogic";
import { albumCharacterLabel, sortedAlbumEntries } from "./albumNames";
import { ANIMAL_COLORS, animalCategoryLabel, normalizedAnimalMetadata } from "../../content/animalTaxonomy";
import { isPerson, PERSON_PRICE } from "../../content/personUnlocks";
import { AlbumCollectionRail } from "./AlbumCollectionRail";
import { AlbumCategoryRail } from "./AlbumCategoryRail";
import { AlbumPortraitCard } from "./AlbumPortraitCard";
import "../../components/Buttons/ui.css";
import "./Album.css";

type Picked = { character: CharacterDetails };

const Album = () => {
  const { locale, t: tr } = useTranslation();
  const reduceMotion = useReducedMotion();
  const save = useSaveStore((s) => s.save);
  const loaded = useSaveStore((s) => s.loaded);
  const readOnly = useSaveStore((s) => s.readOnly);
  const purchasePerson = useSaveStore((s) => s.purchasePerson);
  const collection = save.collection;
  const [worldId, setWorldId] = useState(ALBUM_COLLECTIONS[0].id);
  const [picked, setPicked] = useState<Picked | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState("");
  const world = ALBUM_COLLECTIONS.find((w) => w.id === worldId) ?? ALBUM_COLLECTIONS[0];
  const peopleCollection = world.id === "politique" || world.id === "histoire";
  const unlockedCount = world.characters.filter(character => isAlbumCharacterUnlocked(save, character)).length;
  const pickedLocked = !!picked && isPerson(picked.character.name) && !isAlbumCharacterUnlocked(save, picked.character);
  const pickedCount = picked ? collection[picked.character.name] ?? 0 : 0;
  const missingStars = Math.max(0, PERSON_PRICE - save.wallet.stars);
  const all = caughtCount({ collection });
  const entries = useMemo(() => sortedAlbumEntries(world.characters, locale).map((entry, index) => ({ ...entry, index })), [world.characters, locale]);
  const visible = category ? entries.filter(({ character }) => character.tags?.includes(category)) : entries;
  const worldCount = caughtCount({ collection }, world.characters);
  const visibleCount = caughtCount({ collection }, visible.map(({ character }) => character));
  const completion = all.total ? Math.round(all.caught / all.total * 100) : 0;
  const worldCompletion = worldCount.total ? worldCount.caught / worldCount.total * 100 : 0;
  const collectionComplete = worldCount.caught === worldCount.total;
  const selectWorld = (id: string) => { setWorldId(id); setCategory(""); };

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
    <div className="fi-screen album-screen">
      <div className="fi-inner album-inner">
        <section className="album-intro" aria-label={tr("Ta collection")}>
          <div className="album-intro-copy">
            <span className="album-eyebrow"><BookOpen size={14} aria-hidden="true" /> {tr("Ta collection")}</span>
            <h2>{tr("Chaque découverte compte.")}</h2>
            <span className="album-intro-total">{tr("{{caught}} sur {{total}} portraits trouvés", { caught: all.caught, total: all.total })}</span>
          </div>
          <div className="album-completion" aria-label={`${tr("Ta collection")} : ${completion}%`}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle className="album-completion-track" cx="32" cy="32" r="27" />
              <circle className="album-completion-fill" cx="32" cy="32" r="27" pathLength="100" strokeDasharray={`${completion} 100`} />
            </svg>
            <Sparkles size={17} aria-hidden="true" />
            <strong>{completion}<small>%</small></strong>
          </div>
        </section>

        <div className="album-collections-heading">
          <h2>{tr("Collections")}</h2>
          <span className="album-wallet" aria-label={tr("{{count}} étoiles", { count: save.wallet.stars })}>
            <Star size={16} fill="currentColor" aria-hidden="true" /> {save.wallet.stars}
          </span>
        </div>
        <AlbumCollectionRail collections={ALBUM_COLLECTIONS} selectedId={worldId} collection={collection} onSelect={selectWorld} />

        <section className="album-sheet" id="album-collection-panel" role="tabpanel" aria-labelledby={`album-collection-${world.id}`}>
          <div className="album-sheet-heading">
            <div>
              <span className="album-sheet-eyebrow">{collectionComplete ? tr("Collection complète !") : tr("À toi de les retrouver")}</span>
              <h2 id="album-world-title">{tr(world.name)}</h2>
            </div>
            <span className="album-sheet-count"><BookOpen size={17} aria-hidden="true" /><b>{worldCount.caught}</b><span>/{worldCount.total}</span></span>
          </div>
          <div className="album-world-progress" role="progressbar" aria-label={tr("{{caught}} sur {{total}} portraits trouvés", { caught: worldCount.caught, total: worldCount.total })} aria-valuenow={worldCount.caught} aria-valuemin={0} aria-valuemax={worldCount.total}>
            <span style={{ width: `${worldCompletion}%` }} />
          </div>

          <AlbumCategoryRail key={world.id} characters={world.characters} category={category} onSelect={setCategory} />
          <div className="album-page-heading" aria-live="polite">
            <h3>{category ? tr(animalCategoryLabel(category)) : tr("Tous les portraits")}</h3>
            <span>{visibleCount.caught}/{visibleCount.total} <span className="album-found-label">{tr("trouvés", { count: visibleCount.caught })}</span></span>
          </div>
          <div className="album-grid" key={`${world.id}:${category}`}>
            {visible.map(({ character, label, index }) => (
              <AlbumPortraitCard
                key={character.name}
                character={character}
                label={label}
                count={collection[character.name] ?? 0}
                locked={!isAlbumCharacterUnlocked(save, character)}
                purchasable={peopleCollection}
                index={index}
                onOpen={() => setPicked({ character })}
              />
            ))}
          </div>
          {visible.length === 0 && <p className="album-empty">{tr("Aucun portrait ne correspond à ces filtres.")}</p>}
          <div className="album-page-end" aria-hidden="true"><span /><Sparkles size={16} /><span /></div>
        </section>

        <details className="album-guide" key={world.id}>
          <summary><HelpCircle size={18} aria-hidden="true" /><span>{tr("Comment compléter l’album ?")}</span><ChevronDown size={18} aria-hidden="true" /></summary>
          <div className="album-guide-content">
            {world.id === "animaux" && <p>{tr("Cinq animaux sont disponibles dès le départ. Retrouve les autres dans l’Aventure ou le défi du jour pour les débloquer en Infini.")}</p>}
            {peopleCollection ? <>
              <p>{tr("12 personnages de départ. Débloque les autres avec tes étoiles dans l’album.")}</p>
              <p>{tr("1 portrait trouvé = 1 étoile. Un personnage coûte {{price}} étoiles.", { price: PERSON_PRICE })}</p>
              <p className="album-owned-count">{tr("{{available}}/{{total}} débloqués", { available: unlockedCount, total: world.characters.length })}</p>
              <p>{tr("Touche un portrait pour découvrir son histoire.")}</p>
            </> : <p>{tr("Retrouve les portraits en jouant pour remplir ton album.")}</p>}
            <div className="album-medal-guide" aria-label={tr("Médailles")}>
              {MEDAL_THRESHOLDS.map(tier => <span key={tier.mastery}><span aria-hidden="true">{MEDALS[tier.mastery]}</span><b>{tier.count}</b></span>)}
            </div>
            <p>{tr("Retrouve le même portrait pour gagner des médailles.")}</p>
          </div>
        </details>
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
              className={`album-big album-card-${masteryOf(pickedCount)}`}
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: reduceMotion ? 1 : 0.9, y: reduceMotion ? 0 : 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: reduceMotion ? 1 : 0.96, y: 0 }}
              transition={reduceMotion ? { duration: 0.1 } : { type: "spring", stiffness: 380, damping: 28 }}
            >
              <button type="button" className="album-close" aria-label={tr("Fermer")} onClick={() => setPicked(null)}>×</button>
              {!pickedLocked && MEDALS[masteryOf(pickedCount)] && (
                <span className="album-card-medal">{MEDALS[masteryOf(pickedCount)]}</span>
              )}
              <div className="album-big-portrait"><img src={picked.character.imageSrc} alt="" draggable={false} style={portraitStyle(picked.character.imageSrc)} /></div>
              <strong id="album-character-name">{albumCharacterLabel(picked.character, locale)}</strong>
              {picked.character.profile && <div className="album-biography" lang="fr" dir="ltr">
                {picked.character.profile.period && <span className="album-biography-period">{picked.character.profile.period}</span>}
                <p id="album-character-description">{picked.character.profile.description}</p>
                <a href={picked.character.profile.source.url} target="_blank" rel="noopener noreferrer">
                  {tr("En savoir plus")} · {picked.character.profile.source.label}<span aria-hidden="true"> ↗</span>
                </a>
              </div>}
              {pickedLocked && <div className="album-purchase">
                <span>{tr("Ton solde : {{count}} étoiles", { count: save.wallet.stars })}</span>
                <progress max={PERSON_PRICE} value={Math.min(save.wallet.stars, PERSON_PRICE)} aria-label={tr("Progression vers le prochain personnage")} />
                <button type="button" disabled={!loaded || readOnly || missingStars > 0} onClick={() => purchasePerson(picked.character.name)}>
                  {tr("Débloquer pour {{price}} étoiles", { price: PERSON_PRICE })}
                </button>
                {missingStars > 0 && <span>{tr("Encore {{count}} étoiles à gagner", { count: missingStars })}</span>}
              </div>}
              {peopleCollection && !pickedLocked && <span className="album-available-label" role="status">{tr("Débloqué")}</span>}
              {picked.character.breed && <span>{tr(picked.character.breed)}</span>}
              {world.allowColorFilter && <div className="album-colors" aria-label={tr("Couleurs dominantes")}>
                {normalizedAnimalMetadata(picked.character).dominantColors.map((color) => <span key={color} title={tr(ANIMAL_COLORS[color].label)} style={{ background: ANIMAL_COLORS[color].hex }} aria-label={tr(ANIMAL_COLORS[color].label)} />)}
              </div>}
              {!pickedLocked && <span className="album-big-count">
                {pickedCount > 0 ? tr("Trouvé {{count}} fois", { count: pickedCount }) : tr("Disponible en Infini")}
              </span>}
              {(() => {
                if (pickedLocked) return null;
                const next = nextMedal(pickedCount);
                return next ? (
                  <div className="album-big-next">
                    <span>{tr("Encore {{count}}", { count: next.left })} → {next.medal}</span>
                    <progress value={pickedCount} max={pickedCount + next.left} aria-label={tr("Prochaine médaille")} />
                  </div>
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
