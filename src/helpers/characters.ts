import publishedAnimals from "../content/publishedAnimals.json";
import publishedPeople from "../content/publishedPeople.json";
import publishedHistory from "../content/publishedHistory.json";
import publishedCelebrities from "../content/publishedCelebrities.json";
import personProfiles from "../content/personProfiles.json";
import publishedFlags from "../content/publishedFlags.json";
import { normalizedAnimalMetadata } from "../content/animalTaxonomy";
import type { AnimalMetadata } from "../content/animalTaxonomy";
import { portraitGameSource } from "./portraitAssets";

export type CharacterColor =
  | "brown"
  | "grey"
  | "yellow"
  | "white"
  | "green"
  | "blue"
  | "red"
  | "orange"
  | "pink"
  | "purple"
  | "black";

export type PersonProfile = {
  description: string;
  period?: string;
  source: { label: string; url: string };
};

/** A sourced connection to a country; relation describes the connection, not necessarily nationality. */
export type CountryLink = {
  code: string; // uppercase ISO 3166-1 alpha-2
  relation: string; // non-empty description, up to 240 characters
  sourceUrl: string; // HTTPS primary source
};

export type CharacterDetails = AnimalMetadata & {
  imageSrc: string;
  detailImageSrc?: string;
  name: string; // identifiant stable (sans accent)
  label: string; // nom affiché
  serie: string;
  color: CharacterColor;
  family: string; // persos qui se ressemblent (utilisé pour les leurres)
  emoji?: string; // persos dessinés à partir d'un emoji
  profile?: PersonProfile;
  countryLinks?: CountryLink[];
};

// Catalogue exporté par l’atelier local : seuls les animaux validés y figurent.
export const animalsPack: CharacterDetails[] = publishedAnimals.map((animal) => ({
  ...animal,
  detailImageSrc: animal.imageSrc,
  imageSrc: portraitGameSource(animal.imageSrc),
  ...normalizedAnimalMetadata(animal as typeof animal & { color: CharacterColor; dominantColors?: CharacterColor[] }),
  color: animal.color as CharacterColor,
}));

export const charactersDetails: CharacterDetails[] = [...animalsPack];

// Les personnalités restent dans leur propre thème, disponible dès le départ.
const profiles: Record<string, PersonProfile> = personProfiles;
const gamePortrait = (person: CharacterDetails): CharacterDetails => ({ ...person, detailImageSrc: person.imageSrc, imageSrc: portraitGameSource(person.imageSrc) });
export const peoplePack: CharacterDetails[] = (publishedPeople as CharacterDetails[]).map((person) => ({ ...gamePortrait(person), profile: profiles[person.name] }));
export const historyPack: CharacterDetails[] = (publishedHistory as CharacterDetails[]).map((person) => ({ ...gamePortrait(person), profile: profiles[person.name] }));
export const celebritiesPack: CharacterDetails[] = (publishedCelebrities as CharacterDetails[]).map(gamePortrait);

export type FlagDetails = CharacterDetails & { countryCode: string; duplicateOf?: string };
export const flagsPack: FlagDetails[] = (publishedFlags as FlagDetails[]).map((flag) => ({ ...flag }));

// Les territoires qui partagent un dessin gardent leur asset, mais une partie
// propose un seul nom par drapeau. L’Antarctique n’a pas de drapeau officiel.
export const playableFlagsPack: CharacterDetails[] = flagsPack.filter((flag) => !flag.duplicateOf && flag.name !== "flag-aq");
