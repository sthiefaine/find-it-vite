import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";
import type { CharacterDetails } from "../../helpers/characters";
import { portraitStyle } from "../../helpers/portraitScale";
import { useTranslation } from "../../i18n";
import { albumCharacterLabel } from "../../pages/Album/albumNames";
import { GameIcon } from "../Icons/GameIcon";
import "./PortraitReveal.css";

type Props = { character: CharacterDetails; onContinue: () => void };
const TILES = Array.from({ length: 64 }, (_, index) => index);

// CSS animates the mosaic; no per-frame React updates or extra image generation.
export function PortraitReveal({ character, onContinue }: Props) {
  const { locale, t: tr } = useTranslation();
  const reduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const button = dialog?.querySelector<HTMLButtonElement>("button:not([disabled])");
      (button ?? dialog)?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) setReady(true);
    // Failed/offline decoding must not trap the player in a paused game.
    const fallback = setTimeout(() => { setReady(true); }, 5000);
    return () => clearTimeout(fallback);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setRevealed(true), reduced ? 100 : 1950);
    return () => clearTimeout(timer);
  }, [ready, reduced]);

  return createPortal(<div className={`portrait-reveal${ready ? " is-running" : ""}${revealed ? " is-revealed" : ""}${reduced ? " is-reduced" : ""}`} role="dialog" aria-modal="true" aria-labelledby="portrait-reveal-title">
    <div className="portrait-reveal-card" ref={dialogRef} tabIndex={-1}>
      <span className="portrait-reveal-kicker"><GameIcon name="album" />{tr("Nouvelle découverte !")}</span>
      <div className="portrait-reveal-stage" aria-hidden="true">
        <div className="portrait-reveal-rays" />
        <GameIcon name="star" className="portrait-reveal-star star-left" />
        <GameIcon name="star" className="portrait-reveal-star star-right" />
        <div className="portrait-reveal-frame">
          <div className="portrait-reveal-art" style={portraitStyle(character.imageSrc)}>
            {!failed && <img ref={imageRef} src={character.imageSrc} alt="" draggable={false} onLoad={() => setReady(true)} onError={() => { setFailed(true); setReady(true); }} />}
            {failed && <GameIcon name="paw" />}
            <div className="portrait-reveal-mosaic">{TILES.map(index => <span key={index} style={{ "--tile-delay": `${350 + (index * 37 % 64) * 20}ms` } as CSSProperties} />)}</div>
            {!failed && <img className="portrait-reveal-shadow" src={character.imageSrc} alt="" draggable={false} />}
          </div>
          <span className="portrait-reveal-seal"><GameIcon name="check" /></span>
        </div>
      </div>
      <h2 id="portrait-reveal-title" aria-live="polite">{revealed ? albumCharacterLabel(character, locale) : "???"}</h2>
      <p>{tr(revealed ? "Un nouveau portrait dans ton album !" : "La surprise arrive…")}</p>
      <button type="button" disabled={!revealed} onClick={onContinue}><GameIcon name="play" />{tr("Continuer")}</button>
    </div>
  </div>, document.body);
}
