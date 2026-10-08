import type { CSSProperties } from "react";
import { masteryOf } from "../../content/progress";
import { PERSON_PRICE } from "../../content/personUnlocks";
import type { CharacterDetails } from "../../helpers/characters";
import { portraitStyle } from "../../helpers/portraitScale";
import { useTranslation } from "../../i18n";
import { MEDALS, nextMedal } from "./albumLogic";
import "./AlbumPortraitCard.css";

export type AlbumPortraitCardProps = {
  character: CharacterDetails;
  label: string;
  count: number;
  locked: boolean;
  purchasable: boolean;
  index: number;
  onOpen: () => void;
};

export default function AlbumPortraitCard({
  character, label, count, locked, purchasable, index, onOpen,
}: AlbumPortraitCardProps) {
  const { t: tr, languageTag } = useTranslation();
  const total = Math.max(0, count);
  const unknown = locked && !purchasable;
  const mastery = masteryOf(total);
  const medal = locked ? undefined : MEDALS[mastery];
  const next = locked ? null : nextMedal(total);
  const foundLabel = tr("Trouvé {{count}} fois", { count: total });
  const statusLabel = unknown ? tr("Pas encore trouvé")
    : locked ? tr("Débloquer pour {{price}} étoiles", { price: PERSON_PRICE })
      : total === 0 ? tr("Disponible") : foundLabel;
  const className = [
    "album-portrait-card",
    `album-portrait-${locked ? "none" : mastery}`,
    unknown ? "album-portrait-unknown" : locked ? "album-portrait-purchasable" : "album-portrait-owned",
    !locked && total === 0 ? "album-portrait-available" : "",
    index < 30 ? "album-portrait-enter" : "",
  ].filter(Boolean).join(" ");
  const style = {
    "--album-portrait-delay": `${Math.min(index, 12) * 18}ms`,
    "--album-portrait-tilt": `${(index % 3 - 1) * .45}deg`,
  } as CSSProperties;

  const content = <>
    <span className="album-portrait-number" aria-hidden="true">{String(index + 1).padStart(3, "0")}</span>
    <span className="album-portrait-seal" aria-hidden="true">
      {locked ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5.5" y="10" width="13" height="10" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" strokeLinecap="round" />
      </svg> : medal ?? "✦"}
    </span>
    <span className="album-portrait-frame">
      <img
        className="album-portrait-image"
        src={character.imageSrc}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        style={portraitStyle(character.imageSrc)}
      />
      {unknown ? <span className="album-portrait-question" aria-hidden="true">?</span> : null}
    </span>
    <span className="album-portrait-name">{unknown ? "? ? ?" : label}</span>
    <span className="album-portrait-status" title={statusLabel}>
      {unknown ? <span className="album-portrait-hidden-label">{statusLabel}</span>
        : locked ? <span className="album-portrait-price"><span aria-hidden="true">★</span> {PERSON_PRICE.toLocaleString(languageTag)}</span>
          : total === 0 ? <span className="album-portrait-available-label">{tr("Disponible")}</span>
            : <><span className="album-portrait-count" aria-label={foundLabel}>×{total.toLocaleString(languageTag)}</span><span className="album-portrait-next" aria-hidden="true">{next?.medal ?? "✦"}</span></>}
    </span>
    <span className="album-portrait-progress-slot">
      {!locked && total > 0 ? <progress
        className="album-portrait-progress"
        max={next ? total + next.left : Math.max(total, 1)}
        value={total}
        aria-label={next ? `${tr("Encore {{count}}", { count: next.left })} → ${next.medal}` : foundLabel}
      /> : <span className="album-portrait-progress-empty" aria-hidden="true" />}
    </span>
  </>;

  return unknown ? (
    <div className={className} style={style} aria-label={statusLabel}>{content}</div>
  ) : (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={`${label}. ${statusLabel}`}
      onClick={onOpen}
    >{content}</button>
  );
}

export { AlbumPortraitCard };
