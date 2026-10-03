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

export type CharacterDetails = {
  imageSrc: string;
  name: string; // identifiant stable (sans accent)
  label: string; // nom affiché
  serie: string;
  color: CharacterColor;
  family: string; // persos qui se ressemblent (utilisé pour les leurres)
  emoji?: string; // persos dessinés à partir d'un emoji
};

export const animalsPack: CharacterDetails[] = [
  { imageSrc: "./assets/images/characters/animals/chat.png", name: "chat", label: "Chat", serie: "animal", color: "brown", family: "brun" },
  { imageSrc: "./assets/images/characters/animals/chien.png", name: "chien", label: "Chien", serie: "animal", color: "brown", family: "brun" },
  { imageSrc: "./assets/images/characters/animals/capybara.png", name: "capybara", label: "Capybara", serie: "animal", color: "brown", family: "brun" },
  { imageSrc: "./assets/images/characters/animals/coq.png", name: "coq", label: "Coq", serie: "animal", color: "brown", family: "brun" },
  { imageSrc: "./assets/images/characters/animals/elephant.png", name: "elephant", label: "Éléphant", serie: "animal", color: "grey", family: "gris" },
  { imageSrc: "./assets/images/characters/animals/hippopotame.png", name: "hippopotame", label: "Hippopotame", serie: "animal", color: "grey", family: "gris" },
  { imageSrc: "./assets/images/characters/animals/pigeon.png", name: "pigeon", label: "Pigeon", serie: "animal", color: "grey", family: "gris" },
  { imageSrc: "./assets/images/characters/animals/giraffe.png", name: "giraffe", label: "Girafe", serie: "animal", color: "yellow", family: "tachete" },
  { imageSrc: "./assets/images/characters/animals/leopard.png", name: "leopard", label: "Léopard", serie: "animal", color: "yellow", family: "tachete" },
  { imageSrc: "./assets/images/characters/animals/guepard.png", name: "guepard", label: "Guépard", serie: "animal", color: "yellow", family: "tachete" },
  { imageSrc: "./assets/images/characters/animals/zebre.png", name: "zebre", label: "Zèbre", serie: "animal", color: "white", family: "raye" },
  { imageSrc: "./assets/images/characters/animals/serpent.png", name: "serpent", label: "Serpent", serie: "animal", color: "green", family: "vert" },
];

export const charactersDetails: CharacterDetails[] = [...animalsPack];
