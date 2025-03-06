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
  size: number;                 // Grid size (e.g., 2 means 2x2)
  characters: CharacterDetails[]; // Characters to use
  gridType: GridType;          // Type of grid to use
  difficulty: number;          // Base difficulty 1-5
  speed?: number;              // Animation speed multiplier
  characterCount?: number;     // Number of characters to display
  additionalParams?: Record<string, any>; // Additional grid-specific parameters
};

export enum GridType {
  BASIC = "basic",
  ANIMATED_SCROLL = "animated_scroll",
  ANIMATED_COMPLEX = "animated_complex",
  ANIMATED_MOVING = "animated_moving"
}

export function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Improved level configurations
export const levelConfigs: {
  [key: number]: LevelConfig;
} = {
  // Basic grid levels (1-3)
  1: { 
    size: 2, 
    characters: charactersDetails.slice(0, 3),
    gridType: GridType.BASIC,
    difficulty: 1
  },
  2: { 
    size: 4, 
    characters: charactersDetails.slice(0, 5),
    gridType: GridType.BASIC,
    difficulty: 1
  },
  3: { 
    size: 6, 
    characters: charactersDetails,
    gridType: GridType.BASIC,
    difficulty: 1,
  },
  
  // Animated scroll levels (4-6)
  4: { 
    size: 6, 
    characters: charactersDetails,
    gridType: GridType.ANIMATED_SCROLL,
    difficulty: 2,
    speed: 0.6,
    additionalParams: {
      scrollDirection: "horizontal"
    }
  },
  5: { 
    size: 8, 
    characters: charactersDetails,
    gridType: GridType.ANIMATED_SCROLL,
    difficulty: 2,
    speed: 0.9,
    additionalParams: {
      scrollDirection: "vertical",
      alternateDirection: true
    }
  },
  6: { 
    size: 10, 
    characters: charactersDetails,
    gridType: GridType.ANIMATED_SCROLL,
    difficulty: 2,
    speed: 1.2,
    additionalParams: {
      scrollDirection: "horizontal",
      alternateDirection: true,
      sameDirection: false
    }
  },
  
  // Complex grid levels (7-9)
  7: { 
    size: 8, 
    characters: charactersDetails,
    gridType: GridType.ANIMATED_COMPLEX,
    difficulty: 3,
    characterCount: 80,
    additionalParams: {
      useBackgroundGrid: false,
      backgroundGridJitter: 2
    }
  },
  8: { 
    size: 10, 
    characters: charactersDetails,
    gridType: GridType.ANIMATED_COMPLEX,
    difficulty: 3,
    characterCount: 120,
    additionalParams: {
      useBackgroundGrid: true,
      backgroundGridJitter: 3
    }
  },
  9: { 
    size: 12, 
    characters: charactersDetails,
    gridType: GridType.ANIMATED_COMPLEX,
    difficulty: 3,
    characterCount: 160,
    additionalParams: {
      useBackgroundGrid: true,
      backgroundGridJitter: 4
    }
  },
  
  // Moving grid levels (10-12)
  10: { 
    size: 10, 
    characters: charactersDetails,
    gridType: GridType.ANIMATED_MOVING,
    difficulty: 3,
    characterCount: 40,
    speed: 0.35,
    additionalParams: {
      wantedCharacterSpeed: 0.25,
      otherCharactersSpeed: 0.3,
      edgeBehavior: "bounce",
      wantedZIndexBelow: false,
      ensureWantedCharacter: true,
      forceRestartOnMissingWanted: true
    }
  },
  11: { 
    size: 12, 
    characters: charactersDetails,
    gridType: GridType.ANIMATED_MOVING,
    difficulty: 4,
    characterCount: 50,
    speed: 0.4,
    additionalParams: {
      wantedCharacterSpeed: 0.3,
      otherCharactersSpeed: 0.35,
      edgeBehavior: "wrap",
      wantedZIndexBelow: false,
      ensureWantedCharacter: true,
      forceRestartOnMissingWanted: true
    }
  },
  12: { 
    size: 12, 
    characters: charactersDetails,
    gridType: GridType.ANIMATED_MOVING,
    difficulty: 5,
    characterCount: 60,
    speed: 0.45,
    additionalParams: {
      wantedCharacterSpeed: 0.35,
      otherCharactersSpeed: 0.4,
      differentLayersDirection: true,
      edgeBehavior: "bounce",
      wantedZIndexBelow: true, // Personnage recherché parfois en dessous à partir du niveau 12
      ensureWantedCharacter: true,
      forceRestartOnMissingWanted: true
    }
  }
};

// For levels beyond what's explicitly defined, calculate parameters
export function getLevelConfig(level: number, maxSize?: number): LevelConfig {
  // If the level is explicitly defined, use that config
  if (levelConfigs[level]) {
    const config = { ...levelConfigs[level] };
    if (maxSize !== undefined) {
      config.size = Math.min(config.size, maxSize);
    }
    return config;
  }
  
  // For levels beyond explicitly defined configs, generate one
  // Use modulo to cycle through grid types (providing variety at higher levels)
  // Make GridAnimated3 less frequent at higher levels (every 5th level instead of every 4th)
  const gridTypeCycle = level % 5;
  let gridType: GridType;
  let baseConfig: LevelConfig;
  
  switch (gridTypeCycle) {
    case 0:
      gridType = GridType.BASIC;
      baseConfig = { ...levelConfigs[3] }; // Base on level 3
      break;
    case 1:
    case 2:
      gridType = GridType.ANIMATED_SCROLL;
      baseConfig = { ...levelConfigs[6] }; // Base on level 6
      break;
    case 3:
      gridType = GridType.ANIMATED_COMPLEX;
      baseConfig = { ...levelConfigs[9] }; // Base on level 9
      break;
    case 4:
    default:
      gridType = GridType.ANIMATED_MOVING;
      baseConfig = { ...levelConfigs[12] }; // Base on level 12
      break;
  }
  
  // Calculate scaled parameters based on level with more gradual progression
  const levelFactor = (level - 12) / 8; // Slower scaling factor for levels above 12
  const scaledDifficulty = Math.min(5, baseConfig.difficulty + Math.floor(levelFactor));
  
  // Slower speed increases
  const scaledSpeed = baseConfig.speed ? baseConfig.speed * (1 + levelFactor * 0.2) : undefined;
  
  // Much more controlled character count scaling for moving grid - fewer characters for bounce
  const scaledCharacterCount = baseConfig.characterCount 
    ? gridType === GridType.ANIMATED_MOVING
      ? Math.min(
          100, 
          baseConfig.characterCount + Math.floor(levelFactor * 5),
          // Use fewer characters for bounce mode to prevent overwhelming screen
          baseConfig.additionalParams?.edgeBehavior === "bounce" ? 70 : 100
        ) 
      : Math.floor(baseConfig.characterCount * (1 + levelFactor * 0.15))
    : undefined;
  
  // Create the new level config with scaled values
  const newConfig: LevelConfig = {
    size: Math.min(maxSize || 15, baseConfig.size + Math.floor(levelFactor)),
    characters: baseConfig.characters,
    gridType: gridType,
    difficulty: scaledDifficulty,
    speed: scaledSpeed,
    characterCount: scaledCharacterCount,
    additionalParams: { ...baseConfig.additionalParams }
  };
  
  // Modify additional parameters based on level
  if (newConfig.additionalParams) {
    if (gridType === GridType.ANIMATED_MOVING) {
      // More gradual speed increases for moving characters
      newConfig.additionalParams.wantedCharacterSpeed = 
        Math.min(0.7, (baseConfig.additionalParams?.wantedCharacterSpeed || 0.4) * (1 + levelFactor * 0.15));
      newConfig.additionalParams.otherCharactersSpeed =
        Math.min(0.75, (baseConfig.additionalParams?.otherCharactersSpeed || 0.45) * (1 + levelFactor * 0.15));
      
      // Ensure wanted character is always visible (never below other characters)
      newConfig.additionalParams.wantedZIndexBelow = false;
    } else if (gridType === GridType.ANIMATED_COMPLEX) {
      newConfig.additionalParams.backgroundGridJitter = 
        Math.min(8, (baseConfig.additionalParams?.backgroundGridJitter || 2) + Math.floor(levelFactor * 1.5));
    }
  }
  
  return newConfig;
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

  const config = getLevelConfig(level, maxCellsPerRow);
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