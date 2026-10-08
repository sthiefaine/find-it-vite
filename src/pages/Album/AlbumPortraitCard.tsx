import { Check, LockKeyhole, Star } from "lucide-react";
import { masteryOf } from "../../content/progress";
import { PERSON_PRICE } from "../../content/personUnlocks";
import type { CharacterDetails } from "../../helpers/characters";
import { portraitStyle } from "../../helpers/portraitScale";
import { useTranslation } from "../../i18n";
import { MEDALS } from "./albumLogic";
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

export function AlbumPortraitCard({ character, label, count, locked, purchasable, index, onOpen }: AlbumPortraitCardProps) {
  const { t: tr, languageTag } = useTranslation();
  const unknown = locked && !purchasable;
  const medal = locked ? undefined : MEDALS[masteryOf(count)];
  const status = locked
    ? purchasable ? tr("Débloquer pour {{price}} étoiles", { price: PERSON_PRICE }) : tr("Pas encore trouvé")
    : count === 0 ? tr("Disponible") : tr("Trouvé {{count}} fois", { count });
  const className = `album-portrait-card album-portrait-${locked ? "locked" : masteryOf(count)}${unknown ? " album-portrait-unknown" : ""}`;
  const content = <>
    <span className="album-portrait-art">
      <span className="album-portrait-number" aria-hidden="true">{String(index + 1).padStart(3, "0")}</span>
      {medal && <span className="album-portrait-medal" aria-hidden="true">{medal}</span>}
      <img src={character.imageSrc} alt="" draggable={false} loading="lazy" decoding="async" style={portraitStyle(character.imageSrc)} />
      {locked && <span className="album-portrait-lock" aria-hidden="true"><LockKeyhole size={12} strokeWidth={2.3} /></span>}
    </span>
    <span className="album-portrait-name">{unknown ? tr("À découvrir") : label}</span>
    <span className="album-portrait-status">
      {locked ? purchasable
        ? <><Star size={11} fill="currentColor" aria-hidden="true" /> {PERSON_PRICE.toLocaleString(languageTag)}</>
        : <span aria-hidden="true">···</span>
        : count === 0
          ? <><Check size={11} strokeWidth={3} aria-hidden="true" /> {tr("Disponible")}</>
          : <span>{tr("Trouvé {{count}} fois", { count })}</span>}
    </span>
  </>;

  return <button type="button" className={className} aria-label={`${label}. ${status}`} onClick={onOpen}>{content}</button>;
}

export default AlbumPortraitCard;
