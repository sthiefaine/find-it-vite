import { CharacterDetails } from "../helpers/characters";

export type GridCell = {
  id: number;
  imageSrc: string;
  name: string;
} | null;

export type LevelConfig = {
  size: number;
  characters: CharacterDetails[];
};