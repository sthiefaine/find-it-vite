import { useMemo, type KeyboardEvent } from "react";
import { useTranslation } from "../../i18n";
import { portraitStyle } from "../../helpers/portraitScale";
import { caughtCount, type ALBUM_COLLECTIONS } from "./albumLogic";
import "./AlbumCollectionRail.css";

type Props = {
  collections: typeof ALBUM_COLLECTIONS;
  selectedId: string;
  collection: Record<string, number>;
  onSelect: (id: string) => void;
};

const PREVIEWS: Readonly<Record<string, readonly string[]>> = {
  animaux: ["animals/ara-bleu", "animals/lion", "animals/chat"],
  ocean: ["animals/poulpe", "animals/dauphin", "animals/tortue-marine"],
  politique: ["people/simone-veil", "people/emmanuel-macron", "people/jean-luc-melenchon"],
  histoire: ["history/cleopatre", "history/napoleon-bonaparte", "history/marie-curie"],
};

export function AlbumCollectionRail({ collections, selectedId, collection, onSelect }: Props) {
  const { t: tr, languageTag } = useTranslation();
  const numbers = useMemo(() => new Intl.NumberFormat(languageTag), [languageTag]);
  const activeId = collections.some(item => item.id === selectedId) ? selectedId : collections[0]?.id;

  function selectTab(button: HTMLButtonElement, id: string) {
    onSelect(id);
    button.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey || collections.length < 2) return;
    const rail = event.currentTarget.parentElement;
    if (!rail) return;
    const direction = getComputedStyle(rail).direction === "rtl" ? -1 : 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + direction + collections.length) % collections.length; break;
      case "ArrowLeft": next = (index - direction + collections.length) % collections.length; break;
      case "Home": next = 0; break;
      case "End": next = collections.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const button = rail.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
    if (!button) return;
    button.focus({ preventScroll: true });
    selectTab(button, collections[next].id);
  }

  return (
    <div className="album-collection-rail" role="tablist" aria-label={tr("Album")} aria-orientation="horizontal">
      {collections.map((item, index) => {
        const selected = item.id === activeId;
        const { caught, total } = caughtCount({ collection }, item.characters);
        const progress = total > 0 ? Math.min(100, (caught / total) * 100) : 0;
        const previews = PREVIEWS[item.id]?.map(path => `/assets/images/characters/${path}.png`)
          ?? item.characters.slice(0, 3).map(character => character.imageSrc);
        return (
          <button
            type="button"
            key={item.id}
            id={`album-collection-${item.id}`}
            role="tab"
            aria-selected={selected}
            aria-controls="album-collection-panel"
            aria-label={`${tr(item.name)}, ${numbers.format(caught)} / ${numbers.format(total)}`}
            tabIndex={selected ? 0 : -1}
            className={`album-collection-card album-collection-card--${item.id}${selected ? " is-selected" : ""}`}
            onClick={event => selectTab(event.currentTarget, item.id)}
            onKeyDown={event => navigate(event, index)}
          >
            <span className="album-collection-card__art" aria-hidden="true">
              <span className="album-collection-card__halo" />
              {previews.map((imageSrc, portraitIndex) => (
                <span className={`album-collection-card__portrait album-collection-card__portrait--${portraitIndex}`} key={imageSrc}>
                  <img src={imageSrc} alt="" draggable={false} decoding="async" width={100} height={100} style={portraitStyle(imageSrc)} />
                </span>
              ))}
              <span className="album-collection-card__spark">✦</span>
            </span>
            <span className="album-collection-card__check" aria-hidden="true">{selected ? "✓" : ""}</span>
            <span className="album-collection-card__name">{tr(item.name)}</span>
            <span className="album-collection-card__count" aria-hidden="true" dir="ltr">
              <strong>{numbers.format(caught)}</strong><span>/ {numbers.format(total)}</span>
            </span>
            <span className="album-collection-card__progress" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
