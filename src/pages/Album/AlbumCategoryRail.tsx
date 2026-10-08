import { useMemo } from "react";
import { animalCategoryLabel, normalizedAnimalMetadata } from "../../content/animalTaxonomy";
import type { CharacterDetails } from "../../helpers/characters";
import { portraitStyle } from "../../helpers/portraitScale";
import { useTranslation } from "../../i18n";
import "./AlbumCategoryRail.css";

type AlbumCategoryRailProps = {
  characters: CharacterDetails[];
  category: string;
  onSelect: (tag: string) => void;
};

const CATEGORY_PORTRAITS: Readonly<Record<string, string>> = {
  ferme: "vache-highland", felins: "tigre", canides: "chien-husky", oiseaux: "ara-bleu",
  reptiles: "cameleon", sauvages: "lion", domestiques: "chat", foret: "renard",
  savane: "giraffe", ocean: "dauphin", jungle: "toucan", polaires: "ours-polaire",
  rongeurs: "hamster", amphibiens: "axolotl", primates: "gorille",
};

export function AlbumCategoryRail({ characters, category, onSelect }: AlbumCategoryRailProps) {
  const { languageTag, t: tr } = useTranslation();
  const categories = useMemo(() => {
    const byTag = new Map<string, { tag: string; label: string; count: number; character: CharacterDetails }>();
    for (const character of characters) {
      for (const tag of normalizedAnimalMetadata(character).tags) {
        // Country identifiers are searchable names, rather than album categories.
        if (/^[a-z]{2}$/.test(tag)) continue;
        const existing = byTag.get(tag);
        if (existing) {
          existing.count += 1;
          if (character.name === CATEGORY_PORTRAITS[tag]) existing.character = character;
        }
        else byTag.set(tag, { tag, label: tr(animalCategoryLabel(tag)), count: 1, character });
      }
    }
    const collator = new Intl.Collator(languageTag, { sensitivity: "base" });
    return [...byTag.values()]
      .filter(({ count }) => count < characters.length)
      .sort((left, right) => collator.compare(left.label, right.label));
  }, [characters, languageTag, tr]);

  if (categories.length === 0) return null;

  return (
    <div className="album-category-rail" role="group" aria-label={tr("Catégorie")}>
      <button
        type="button"
        className="album-category-option album-category-option-all"
        aria-pressed={category === ""}
        aria-label={`${tr("Toutes")} · ${tr("{{count}} portraits", { count: characters.length })}`}
        onClick={event => {
          onSelect("");
          event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
        }}
      >
        <span className="album-category-illustration" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" focusable="false">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
          </svg>
        </span>
        <span className="album-category-copy">
          <span className="album-category-name">{tr("Toutes")}</span>
          <span className="album-category-count" aria-hidden="true">{characters.length}</span>
        </span>
      </button>
      {categories.map(({ tag, label, count, character }) => (
        <button
          key={tag}
          type="button"
          className="album-category-option"
          aria-pressed={category === tag}
          aria-label={`${label} · ${tr("{{count}} portraits", { count })}`}
          onClick={event => {
            onSelect(tag);
            event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
          }}
        >
          <span className="album-category-illustration" aria-hidden="true">
            <img src={character.imageSrc} alt="" loading="lazy" decoding="async" draggable={false} style={portraitStyle(character.imageSrc)} />
          </span>
          <span className="album-category-copy">
            <span className="album-category-name">{label}</span>
            <span className="album-category-count" aria-hidden="true">{count}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default AlbumCategoryRail;
