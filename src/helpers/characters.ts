export type CharacterDetails = {
  imageSrc: string;
  name: string;
  serie: string;
  color?: string;
  groupWith?: string;
};

export const charactersDetails: CharacterDetails[] = [
  { imageSrc: "./src/assets/images/characters/mario.png", name: "Mario", serie: "Mario", color: "red" },
  { imageSrc: "./src//assets/images/characters/wario.png", name: "Wario", serie: "Mario", color: "yellow" },
  { imageSrc: "./src//assets/images/characters/luigi.png", name: "Luigi", serie: "Mario", color: "green" },
  { imageSrc: "./src//assets/images/characters/yoshi.png", name: "Yoshi", serie: "Mario", color: "green" },
];