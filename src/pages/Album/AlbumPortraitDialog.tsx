import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Check, Gamepad2, Star, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useSaveStore } from "../../save/saveStore";
import { masteryOf, MEDAL_THRESHOLDS } from "../../content/progress";
import { PORTRAIT_PRICE } from "../../content/portraitUnlocks";
import { ANIMAL_COLORS, normalizedAnimalMetadata } from "../../content/animalTaxonomy";
import type { CharacterDetails } from "../../helpers/characters";
import { portraitStyle } from "../../helpers/portraitScale";
import { albumCharacterLabel } from "./albumNames";
import { isAlbumCharacterUnlocked, MEDALS, nextMedal } from "./albumLogic";
import { PortraitReveal } from "../../components/PortraitReveal/PortraitReveal";
import { GameIcon } from "../../components/Icons/GameIcon";

type Props = { character: CharacterDetails; allowColors: boolean; onClose: () => void };

export function AlbumPortraitDialog({ character, allowColors, onClose }: Props) {
  const { locale, t: tr } = useTranslation();
  const save = useSaveStore(state => state.save);
  const loaded = useSaveStore(state => state.loaded);
  const readOnly = useSaveStore(state => state.readOnly);
  const purchasePortrait = useSaveStore(state => state.purchasePortrait);
  const [revealing, setRevealing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const count = save.collection[character.name] ?? 0;
  const locked = !isAlbumCharacterUnlocked(save, character);
  const missingStars = Math.max(0, PORTRAIT_PRICE - save.wallet.stars);
  const mastery = masteryOf(count);
  const next = nextMedal(count);

  useLayoutEffect(() => {
    if (revealing) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const screen = document.querySelector<HTMLElement>(".album-screen");
    const previousOverflow = screen?.style.overflow ?? "";
    if (screen) screen.style.overflow = "hidden";
    const dialog = dialogRef.current;
    dialog?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], summary");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (screen) screen.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [onClose, revealing]);

  if (revealing) return <PortraitReveal character={character} onContinue={() => setRevealing(false)} />;

  return createPortal(
    <div className="album-overlay" role="dialog" aria-modal="true" aria-labelledby="album-character-name"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} className={`album-big album-card-${locked ? "locked" : mastery}`}>
        <button type="button" className="album-close" aria-label={tr("Fermer")} onClick={onClose}><X size={20} /></button>
        {!locked && MEDALS[mastery] && <span className="album-card-medal" aria-hidden="true">{MEDALS[mastery]}</span>}
        <span className="album-detail-kicker"><GameIcon name={locked ? "daily" : "album"} />{tr(locked ? "À découvrir" : "Ta collection")}</span>
        <div className={`album-big-portrait${locked ? " is-mystery" : ""}`}><img src={character.imageSrc} alt="" draggable={false} style={portraitStyle(character.imageSrc)} /></div>
        <strong id="album-character-name">{locked ? "???" : albumCharacterLabel(character, locale)}</strong>

        {locked && <div className="album-purchase">
          <span>{tr("Une surprise se cache ici.")}</span>
          <div className="album-purchase-wallet"><span>{tr("Ton solde")}</span><b><Star size={17} fill="currentColor" aria-hidden="true" />{save.wallet.stars}</b></div>
          <button type="button" disabled={!loaded || readOnly || missingStars > 0} onClick={() => {
            if (purchasePortrait(character.name) === "purchased") setRevealing(true);
          }}>
            <Star size={16} fill="currentColor" aria-hidden="true" />
            {!loaded ? tr("Chargement…") : tr("Débloquer pour {{price}} étoiles", { price: PORTRAIT_PRICE })}
          </button>
          {missingStars > 0 && <span>{tr("Encore {{count}} étoiles à gagner", { count: missingStars })}</span>}
          <span className="album-earn-hint">{tr("1 portrait trouvé = 1 étoile.")}</span>
          {missingStars > 0 && <Link to="/play" className="album-earn-link"><Gamepad2 size={16} aria-hidden="true" />{tr("Jouer pour gagner des étoiles")}</Link>}
        </div>}
        {!locked && <span className="album-available-label" role="status"><Check size={13} aria-hidden="true" />{tr("Débloqué")}</span>}
        {!locked && character.breed && <span>{tr(character.breed)}</span>}
        {!locked && allowColors && <div className="album-colors" aria-label={tr("Couleurs dominantes")}>
          {normalizedAnimalMetadata(character).dominantColors.map(color => <span key={color} title={tr(ANIMAL_COLORS[color].label)} style={{ background: ANIMAL_COLORS[color].hex }} aria-label={tr(ANIMAL_COLORS[color].label)} />)}
        </div>}
        {!locked && <>
          <span className="album-big-count">{count > 0 ? tr("Trouvé {{count}} fois", { count }) : tr("Disponible en Infini")}</span>
          <div className="album-medal-track" role="group" aria-label={tr("Médailles")}>
            {MEDAL_THRESHOLDS.map(tier => <span key={tier.mastery} className={count >= tier.count ? "is-earned" : ""}>
              <span aria-hidden="true">{MEDALS[tier.mastery]}</span><b>{tier.count}</b>
              {count >= tier.count && <Check size={11} aria-hidden="true" />}
            </span>)}
          </div>
          {next && <span className="album-big-next">{tr("Encore {{count}}", { count: next.left })} → {next.medal}</span>}
        </>}
        {!locked && character.profile && <details className="album-lore">
          <summary><GameIcon name="album" />{tr("Son histoire")}<span aria-hidden="true">+</span></summary>
          <div className="album-biography" lang="fr" dir="ltr">
            {character.profile.period && <span className="album-biography-period">{character.profile.period}</span>}
            <p id="album-character-description">{character.profile.description}</p>
            <a href={character.profile.source.url} target="_blank" rel="noopener noreferrer">{tr("En savoir plus")} · {character.profile.source.label}<span aria-hidden="true"> ↗</span></a>
          </div>
        </details>}
      </div>
    </div>, document.body,
  );
}
