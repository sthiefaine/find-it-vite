import { useTranslation } from "../../i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, HelpCircle, Sparkles, Star } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useSaveStore } from "../../save/saveStore";
import { MEDAL_THRESHOLDS } from "../../content/progress";
import type { CharacterDetails } from "../../helpers/characters";
import { ALBUM_COLLECTIONS, unlockedAlbumCount, isAlbumCharacterUnlocked, MEDALS } from "./albumLogic";
import { sortedAlbumEntries } from "./albumNames";
import { animalCategoryLabel } from "../../content/animalTaxonomy";
import { isPerson, PERSON_PRICE } from "../../content/personUnlocks";
import { AlbumCollectionRail } from "./AlbumCollectionRail";
import { AlbumCategoryRail } from "./AlbumCategoryRail";
import { AlbumPortraitCard } from "./AlbumPortraitCard";
import { AlbumPortraitDialog } from "./AlbumPortraitDialog";
import "../../components/Buttons/ui.css";
import "./Album.css";
import { GameIcon } from "../../components/Icons/GameIcon";
import { charactersInRegion } from "../../content/characterRegions";

type Picked = { character: CharacterDetails };

const Album = () => {
  const { locale, t: tr } = useTranslation();
  const location = useLocation();
  const save = useSaveStore((s) => s.save);
  const collection = save.collection;
  const [worldId, setWorldId] = useState(ALBUM_COLLECTIONS[0].id);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [category, setCategory] = useState("");
  const world = ALBUM_COLLECTIONS.find((w) => w.id === worldId) ?? ALBUM_COLLECTIONS[0];
  const peopleCollection = world.id === "politique" || world.id === "histoire";
  const unlockedCount = world.characters.filter(character => isAlbumCharacterUnlocked(save, character)).length;
  const all = unlockedAlbumCount(save);
  const entries = useMemo(() => sortedAlbumEntries(world.characters, locale).map((entry, index) => ({ ...entry, index })), [world.characters, locale]);
  const regionIds = world.id === "histoire" && (category === "fr" || category === "us")
    ? new Set(charactersInRegion(world.characters, category).map(character => character.name)) : null;
  const visible = regionIds ? entries.filter(({ character }) => regionIds.has(character.name))
    : category ? entries.filter(({ character }) => character.tags?.includes(category)) : entries;
  const worldCount = unlockedAlbumCount(save, world.characters);
  const visibleCount = unlockedAlbumCount(save, visible.map(({ character }) => character));
  const completion = all.total ? Math.round(all.caught / all.total * 100) : 0;
  const collectionComplete = worldCount.caught === worldCount.total;
  const selectWorld = (id: string) => { setWorldId(id); setCategory(""); };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get("person");
    const targetWorld = ALBUM_COLLECTIONS.find(world => world.characters.some(character => isPerson(character.name) && character.name === requested))
      ?? ALBUM_COLLECTIONS.find(world => world.id === (params.get("collection") === "ocean" ? "animaux" : params.get("collection")));
    if (!targetWorld) return;
    setWorldId(targetWorld.id);
    const requestedCategory = params.get("category") ?? (params.get("collection") === "ocean" ? "ocean" : "");
    const validCategory = (targetWorld.id === "histoire" && ["fr", "us"].includes(requestedCategory))
      || targetWorld.characters.some(character => character.tags?.includes(requestedCategory));
    setCategory(validCategory ? requestedCategory : "");
    const character = targetWorld.characters.find(character => character.name === requested);
    setPicked(character ? { character } : null);
  }, [location.key, location.search]);

  const closePortrait = useCallback(() => setPicked(null), []);

  return (
    <div className="fi-screen album-screen">
      <div className="fi-inner album-inner">
        <section className="album-intro" aria-label={tr("Ta collection")}>
          <div className="album-intro-copy">
            <span className="album-eyebrow"><BookOpen size={14} aria-hidden="true" /> {tr("Ta collection")}</span>
            <h2>{tr("Album")}</h2>
            <span className="album-intro-total">{tr("{{available}}/{{total}} débloqués", { available: all.caught, total: all.total })}</span>
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
        <div className="album-families" role="group" aria-label={tr("Collections")}>
          <button type="button" aria-pressed={!peopleCollection} onClick={() => selectWorld("animaux")}><GameIcon name="paw" />{tr("Animaux")}</button>
          <button type="button" aria-pressed={peopleCollection} onClick={() => selectWorld("politique")}><GameIcon name="people" />{tr("Personnages")}</button>
        </div>
        {peopleCollection && <AlbumCollectionRail collections={ALBUM_COLLECTIONS.filter(collection => collection.id !== "animaux")} selectedId={worldId} save={save} onSelect={selectWorld} />}

        <section className="album-sheet" id="album-collection-panel" aria-labelledby="album-world-title">
          <div className="album-sheet-heading">
            <div>
              <span className="album-sheet-eyebrow">{collectionComplete ? tr("Collection complète !") : tr("À toi de les retrouver")}</span>
              <h2 id="album-world-title">{tr(world.name)}</h2>
            </div>
            <span className="album-sheet-count"><BookOpen size={17} aria-hidden="true" /><b>{worldCount.caught}</b><span>/{worldCount.total}</span></span>
          </div>


          {peopleCollection ? <div className="album-regions" role="group" aria-label={tr("Collections")}>
            {world.id === "histoire" && <button type="button" aria-pressed={!category} onClick={() => setCategory("")}>🌍 {tr("Monde")}</button>}
            <button type="button" aria-pressed={world.id === "politique" || category === "fr"} onClick={() => setCategory(world.id === "politique" ? "" : "fr")}>🇫🇷 {tr("France")}</button>
            <button type="button" disabled>🇧🇷 {tr("Brésil")}<small>{tr("Bientôt")}</small></button>
            <button type="button" disabled={world.id === "politique"} aria-pressed={category === "us"} onClick={() => setCategory("us")}>🇺🇸 {tr("États-Unis")}{world.id === "politique" && <small>{tr("Bientôt")}</small>}</button>
          </div> : <AlbumCategoryRail key={world.id} save={save} characters={world.characters} category={category} onSelect={setCategory} />}
          <div className="album-page-heading" aria-live="polite">
            <h3>{category ? tr(category === "fr" ? "France" : category === "us" ? "États-Unis" : animalCategoryLabel(category)) : tr("Tous les portraits")}</h3>
            <span>{visibleCount.caught}/{visibleCount.total} <span className="album-found-label">{tr("Débloqué")}</span></span>
          </div>
          <div className="album-grid" key={`${world.id}:${category}`}>
            {visible.map(({ character, label, index }) => (
              <AlbumPortraitCard
                key={character.name}
                character={character}
                label={label}
                count={collection[character.name] ?? 0}
                locked={!isAlbumCharacterUnlocked(save, character)}
                purchasable={true}
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
            {world.id === "animaux" && <p>{tr("Cinq animaux sont disponibles dès le départ. Débloque les autres dans l’Aventure ou avec tes étoiles dans l’album.")}</p>}
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

      {picked && <AlbumPortraitDialog character={picked.character} allowColors={world.allowColorFilter} onClose={closePortrait} />}

    </div>
  );
};

export default Album;
