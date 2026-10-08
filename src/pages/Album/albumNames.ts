import { animalSpeciesLabel } from "../../content/animalTaxonomy";
import type { CharacterDetails } from "../../helpers/characters";
import { translateFor } from "../../i18n";
import { localeTag, type Locale } from "../../i18n/locales";

// Some portraits use just the breed as their label. Complete those names in
// the album without changing the catalogue IDs or the shorter in-game labels.
export function albumLabelKey(character: CharacterDetails): string {
  const label = character.label.trim();
  const breed = character.breed?.trim().toLocaleLowerCase("fr");
  const species = character.species && animalSpeciesLabel(character.species);
  if (!breed || !species || label.toLocaleLowerCase("fr") !== breed) return label;
  const prefix = species.toLocaleLowerCase("fr");
  if (breed === prefix || breed.startsWith(`${prefix} `) || breed.startsWith(`${prefix}-`)) return label;
  return `${species} ${label}`;
}

export function albumCharacterLabel(character: CharacterDetails, locale: Locale): string {
  return translateFor(locale, albumLabelKey(character));
}

export function sortedAlbumEntries(characters: readonly CharacterDetails[], locale: Locale) {
  const collator = new Intl.Collator(localeTag(locale), { sensitivity: "base", numeric: true });
  return characters.map(character => ({ character, label: albumCharacterLabel(character, locale) }))
    .sort((left, right) => collator.compare(left.label, right.label)
      || collator.compare(left.character.name, right.character.name));
}
