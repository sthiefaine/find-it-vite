import { charactersDetails } from "../../../helpers/characters";
import { LevelConfig } from "../../../helpers/gameUtils";


export const level1Layout = [
  "-", "-", "-", "-", "-", "-", "-", "-",
  "-", "-", "-", "-", "-", "-", "-", "-",
  "-", "-", "-", "-", "-", "-", "-", "-",
  "-", "-", "-", "x", "x", "-", "-", "-",
  "-", "-", "-", "x", "x", "-", "-", "-",
  "-", "-", "-", "-", "-", "-", "-", "-",
  "-", "-", "-", "-", "-", "-", "-", "-",
  "-", "-", "-", "-", "-", "-", "-", "-",
];

export const level1Config: LevelConfig = {
  layout: level1Layout,
  characters: charactersDetails,
};