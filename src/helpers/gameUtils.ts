import { CharacterDetails } from "./characters";

export const LEVEL_SIZE = 8
export const CELL_SIZE = 40;
export const GRID_SIZE = 360;
export const GRID_DIVIDER = GRID_SIZE / CELL_SIZE
export const CANVA_CENTER = ((GRID_DIVIDER - LEVEL_SIZE) * CELL_SIZE) / 2

export const pointColorsArray = [
  "#ffbe0b",
  "#fb5607",
  "#ff006e",
  "#8338ec",
  "#06d6a0",
];

export type GridCell = {
  imageSrc: string;
  name: string;
} | null;

export type LevelConfig = {
  layout: string[];
  characters: CharacterDetails[];
};

export function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const generateLevelGrid = (
  levelLayout: string[],
  availableCharacters: CharacterDetails[],
  wanted: CharacterDetails,
  level: number
): GridCell[] => {
  const grid: GridCell[] = levelLayout.map((cell) => (cell === "-" ? null : null));

  const xCount = levelLayout.reduce((count, cell) => count + (cell === "x" ? 1 : 0), 0);

  if (xCount === availableCharacters.length) {
    const xIndices = levelLayout.reduce((indices, cell, index) => {
      if (cell === "x") indices.push(index);
      return indices;
    }, [] as number[]);

    const allCharacters = [...availableCharacters];
    const shuffledCharacters = allCharacters.sort(() => Math.random() - 0.5);
    const charactersForGrid = [wanted, ...shuffledCharacters.filter((c) => c.name !== wanted.name)];

    xIndices.forEach((index, i) => {
      grid[index] = charactersForGrid[i % charactersForGrid.length];
    });
  } else {
    const xIndices = levelLayout.reduce((indices, cell, index) => {
      if (cell === "x") indices.push(index);
      return indices;
    }, [] as number[]);

    const wantedIndex = xIndices[Math.floor(Math.random() * xIndices.length)];
    grid[wantedIndex] = wanted;

    const otherCharacters = availableCharacters.filter((char) => char.name !== wanted.name);
    xIndices.forEach((index) => {
      if (index !== wantedIndex) {
        const randomChar = otherCharacters[Math.floor(Math.random() * otherCharacters.length)];
        grid[index] = randomChar;
      }
    });
  }

  return grid;
};