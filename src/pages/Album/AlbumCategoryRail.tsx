import { useMemo, type CSSProperties } from "react";
import { animalCategoryLabel, normalizedAnimalMetadata } from "../../content/animalTaxonomy";
import type { CharacterDetails } from "../../helpers/characters";
import { portraitStyle } from "../../helpers/portraitScale";
import { useTranslation } from "../../i18n";
import "./AlbumCollectionRail.css";
import "./AlbumCategoryRail.css";

import { isAlbumCharacterUnlocked } from "./albumLogic";
import type { Save } from "../../save/schema";

type Props = { save: Save; characters: CharacterDetails[]; category: string; onSelect: (tag: string) => void };
const PREVIEWS: Readonly<Record<string, readonly string[]>> = {
  "": ["ara-bleu", "lion", "chat"],
  ferme: ["vache-highland", "cochon", "mouton"], felins: ["tigre", "lion", "chat"],
  canides: ["chien-husky", "renard", "loup"], oiseaux: ["ara-bleu", "toucan", "flamant-rose"],
  reptiles: ["cameleon", "crocodile", "serpent"], sauvages: ["lion", "elephant", "panda"],
  domestiques: ["chat", "chien", "lapin"], foret: ["renard", "cerf", "herisson"],
  savane: ["giraffe", "lion", "elephant"], ocean: ["poulpe", "dauphin", "tortue-marine"],
  jungle: ["toucan", "gorille", "paresseux"], polaires: ["ours-polaire", "manchot-empereur", "renard-polaire"],
  rongeurs: ["hamster", "capybara", "ecureuil"], amphibiens: ["axolotl", "grenouille"],
  primates: ["gorille", "orang-outan", "mandrill"],
};
const PALETTES = [
  ["#fff4db", "#efd08a"], ["#e8f0df", "#bfd390"], ["#ede6fa", "#cab9ec"],
  ["#f9e6de", "#e6b6a7"], ["#dcf5f4", "#9bd8e2"],
];

function previews(characters: CharacterDetails[], tag: string) {
  const preferred = (PREVIEWS[tag] ?? []).flatMap(id => characters.find(character => character.name === id) ?? []);
  const selected = [...preferred];
  // Prefer different silhouettes, while keeping the illustrations inside their category.
  for (const character of characters) {
    if (selected.length >= 3) break;
    if (!selected.some(item => item.name === character.name || (item.species && item.species === character.species))) selected.push(character);
  }
  for (const character of characters) {
    if (selected.length >= 3) break;
    if (!selected.includes(character)) selected.push(character);
  }
  return selected.slice(0, 3);
}

export function AlbumCategoryRail({ save, characters, category, onSelect }: Props) {
  const { languageTag, t: tr } = useTranslation();
  const options = useMemo(() => {
    const byTag = new Map<string, CharacterDetails[]>();
    for (const character of characters) {
      for (const tag of normalizedAnimalMetadata(character).tags) {
        if (/^[a-z]{2}$/.test(tag)) continue;
        const group = byTag.get(tag) ?? [];
        group.push(character);
        byTag.set(tag, group);
      }
    }
    const collator = new Intl.Collator(languageTag, { sensitivity: "base" });
    return [{ tag: "", label: tr("Toutes"), portraits: characters }, ...[...byTag]
      .filter(([, portraits]) => portraits.length < characters.length)
      .map(([tag, portraits]) => ({ tag, label: tr(animalCategoryLabel(tag)), portraits }))
      .sort((left, right) => collator.compare(left.label, right.label))];
  }, [characters, languageTag, tr]);
  if (options.length < 2) return null;

  return <div className="album-collection-rail album-category-rail" role="group" aria-label={tr("Catégorie")}>
    {options.map(({ tag, label, portraits }, index) => {
      const selected = category === tag;
      const [paper, glow] = PALETTES[index % PALETTES.length];
      const illustrations = previews(portraits, tag);
      return <button
        type="button" key={tag} className={`album-collection-card album-category-card${selected ? " is-selected" : ""}`}
        style={{ "--collection-paper": paper, "--collection-glow": glow } as CSSProperties}
        aria-pressed={selected} aria-label={`${label} · ${tr("{{count}} portraits", { count: portraits.length })}`}
        onClick={event => { onSelect(tag); event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); }}
      >
        <span className="album-collection-card__art" aria-hidden="true">
          <span className="album-collection-card__halo" />
          {illustrations.map((character, position) => <span key={character.name} className={`album-collection-card__portrait album-collection-card__portrait--${illustrations.length === 1 ? 1 : illustrations.length === 2 ? position * 2 : position}`}>
            <img className={isAlbumCharacterUnlocked(save, character) ? "" : "is-mystery"} src={character.imageSrc} alt="" loading="lazy" decoding="async" draggable={false} style={portraitStyle(character.imageSrc)} />
          </span>)}
          <span className="album-collection-card__spark">✦</span>
        </span>
        <span className="album-collection-card__check" aria-hidden="true">{selected ? "✓" : ""}</span>
        <span className="album-collection-card__name">{label}</span>
        <span className="album-category-card__count">{tr("{{count}} portraits", { count: portraits.length })}</span>
      </button>;
    })}
  </div>;
}

export default AlbumCategoryRail;
