import publishedAnimals from "../content/publishedAnimals.json";
import { normalizedAnimalMetadata } from "../content/animalTaxonomy";
import type { AnimalMetadata } from "../content/animalTaxonomy";

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

export type CharacterDetails = AnimalMetadata & {
  imageSrc: string;
  name: string; // identifiant stable (sans accent)
  label: string; // nom affiché
  serie: string;
  color: CharacterColor;
  family: string; // persos qui se ressemblent (utilisé pour les leurres)
  emoji?: string; // persos dessinés à partir d'un emoji
};

// Catalogue exporté par l’atelier local : seuls les animaux validés y figurent.
export const animalsPack: CharacterDetails[] = publishedAnimals.map((animal) => ({
  ...animal,
  ...normalizedAnimalMetadata(animal as typeof animal & { color: CharacterColor; dominantColors?: CharacterColor[] }),
  color: animal.color as CharacterColor,
}));

export const charactersDetails: CharacterDetails[] = [...animalsPack];
