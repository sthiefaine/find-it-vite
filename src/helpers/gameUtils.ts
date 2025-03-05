import { CharacterDetails, charactersDetails } from "./characters";

export const CELL_SIZE = 45;

export const pointColorsArray = [
  "#ffbe0b",
  "#fb5607",
  "#ff006e",
  "#8338ec",
  "#06d6a0",
];

export const preloadImages = (imageUrls: string[]) => {
  imageUrls.forEach((url) => {
    const img = new Image();
    img.src = url;
  });
};

export const shuffleArray = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export function randomIntFromInterval(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export type GridCell = {
  id: number;
  imageSrc: string;
  name: string;
} | null;

export type LevelConfig = {
  size: number;
  characters: CharacterDetails[];
};

export function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const levelConfigs: {
  [key: number]: LevelConfig;
} = {
  1: { size: 12, characters: charactersDetails.slice(0, 4) },
  2: { size: 4, characters: charactersDetails },
  3: { size: 5, characters: charactersDetails },
  4: { size: 6, characters: charactersDetails },
  5: { size: 8, characters: charactersDetails },
  6: { size: 10, characters: charactersDetails },
  7: { size: 8, characters: charactersDetails },
  8: { size: 12, characters: charactersDetails },
};

export function getLevelConfig(level: number, maxSize?: number): LevelConfig {
  const maxLevel = Object.keys(levelConfigs).length;

  const config = {
    ...(level < 1
      ? levelConfigs[1]
      : level > maxLevel
      ? levelConfigs[maxLevel]
      : levelConfigs[level]),
  };

  if (maxSize !== undefined) {
    config.size = Math.min(config.size, maxSize);
  }

  return config;
}

export function generateGrid(
  _cellSize: number,
  _gridSize: number,
  level: number,
  maxCellsPerRow: number,
  wanted: CharacterDetails
): GridCell[] {
  // Référence: 13 cellules sur 375px
  // Calcul proportionnel pour d'autres tailles d'écran

  const config = getLevelConfig(level);
  if (!config) throw new Error(`Niveau ${level} non valide`);

  // eslint-disable-next-line prefer-const
  let { size, characters } = config;
  size = Math.min(size, maxCellsPerRow);

  const totalCells = size * size;

  const otherCharacters = characters.filter(
    (char) => char.name !== wanted.name
  );

  const availableCharacters = [wanted, ...otherCharacters];
  const canHaveUniqueCharacters = availableCharacters.length >= totalCells;

  let selectedCharacters: CharacterDetails[];

  if (canHaveUniqueCharacters) {
    selectedCharacters = [wanted];
    const shuffledOthers = [...otherCharacters].sort(() => Math.random() - 0.5);
    selectedCharacters.push(...shuffledOthers.slice(0, totalCells - 1));
  } else {
    selectedCharacters = [wanted];
    for (let i = 1; i < totalCells; i++) {
      const randomIndex = getRandomNumber(0, otherCharacters.length - 1);
      selectedCharacters.push(otherCharacters[randomIndex]);
    }
  }

  const grid: GridCell[] = selectedCharacters.map((char, index) => ({
    id: index,
    imageSrc: char.imageSrc,
    name: char.name,
  }));

  return shuffleArray([...grid]);
}
