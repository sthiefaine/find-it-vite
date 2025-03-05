export type CharacterDetails = {
  imageSrc: string;
  name: string;
  serie: string;
  color?: string;
  groupWith?: string;
};

export const animalsPack: CharacterDetails[]=[
  { imageSrc: "./src/assets/images/characters/animals/chat.png", name: "chat", serie: "animal", color: "brown" },
  { imageSrc: "./src/assets/images/characters/animals/chien.png", name: "chien", serie: "animal", color: "brown" },
  { imageSrc: "./src/assets/images/characters/animals/capybara.png", name: "capybara", serie: "animal", color: "brown" },
  { imageSrc: "./src/assets/images/characters/animals/elephant.png", name: "elephant", serie: "animal", color: "grey" },
  { imageSrc: "./src/assets/images/characters/animals/hippopotame.png", name: "hippopotame", serie: "animal", color: "grey" },
  { imageSrc: "./src/assets/images/characters/animals/giraffe.png", name: "giraffe", serie: "animal", color: "yellow" },
  { imageSrc: "./src/assets/images/characters/animals/leopard.png", name: "leopard", serie: "animal", color: "yellow" },
  { imageSrc: "./src/assets/images/characters/animals/guepard.png", name: "guepard", serie: "animal", color: "yellow" },
  { imageSrc: "./src/assets/images/characters/animals/zebre.png", name: "zebre", serie: "animal", color: "blanc" },
  { imageSrc: "./src/assets/images/characters/animals/coq.png", name: "coq", serie: "animal", color: "brown" },
  { imageSrc: "./src/assets/images/characters/animals/serpent.png", name: "serpent", serie: "animal", color: "green" },
  { imageSrc: "./src/assets/images/characters/animals/pigeon.png", name: "pigeon", serie: "animal", color: "gray" },

]

export const marioPack: CharacterDetails[] = [
  { imageSrc: "./src/assets/images/characters/mario.png", name: "mario", serie: "mario", color: "red" },
  { imageSrc: "./src/assets/images/characters/wario.png", name: "wario", serie: "mario", color: "yellow" },
  { imageSrc: "./src/assets/images/characters/luigi.png", name: "luigi", serie: "mario", color: "green" },
  { imageSrc: "./src/assets/images/characters/yoshi.png", name: "yoshi", serie: "mario", color: "green" },
]

export const charactersDetails: CharacterDetails[] = [
  ...animalsPack
];

