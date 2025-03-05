import { useEffect, useRef, useState } from "react";
import { Stage, Container, Sprite } from "@pixi/react";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import {
  CELL_SIZE,
  GridCell,
  randomIntFromInterval,
} from "../../../helpers/gameUtils";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";

import "./Grid.css";

type ScrollDirection = "horizontal" | "vertical";

type CellPosition = {
  rowIndex: number;
  colIndex: number;
  offsetX: number;
  offsetY: number;
};

type PlacedCharacter = {
  id: number;
  name: string;
  imageSrc: string;
  position: CellPosition;
  isWanted: boolean;
  zIndex: number;
};

type RowConfig = {
  speed: number;
  offset: number;
};

type ColConfig = {
  speed: number;
  offset: number;
};

interface GridAnimatedProps {
  difficulty?: number;
  scrollDirection?: ScrollDirection;
  minSpeed?: number;
  maxSpeed?: number;
  sameDirection?: boolean;
  alternateDirection?: boolean;
  addLine?: number;
}

const GridAnimated = ({
  difficulty = 2,
  scrollDirection = "horizontal",
  minSpeed = 0.3,
  maxSpeed = 1.8,
  sameDirection = false,
  alternateDirection = false,
  addLine = 0,
}: GridAnimatedProps) => {
  const stageRef = useRef<Stage>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [blinkState, setBlinkState] = useState<boolean>(true);
  const [placedCharacters, setPlacedCharacters] = useState<PlacedCharacter[]>(
    []
  );
  const [rowConfigs, setRowConfigs] = useState<RowConfig[]>([]);
  const [colConfigs, setColConfigs] = useState<ColConfig[]>([]);
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const gridSize = Math.min(window.innerWidth, 450);
  const GRID_SIZE_WIDTH = gridSize;
  const GRID_SIZE_HEIGHT = gridSize;

  const rowCount =
    Math.floor(GRID_SIZE_HEIGHT / CELL_SIZE) +
    (scrollDirection === "horizontal" ? addLine : 0);
  const colCount =
    Math.floor(GRID_SIZE_WIDTH / CELL_SIZE) +
    (scrollDirection === "vertical" ? addLine : 0);

  const { grid, wantedCharacter, gameState, animationLevelLoading } =
    useGameStore(
      useShallow((state) => ({
        grid: state.grid,
        wantedCharacter: state.wantedCharacter,
        gameState: state.gameState,
        animationLevelLoading: state.animationLevelLoading,
        setScore: state.setScore,
        setTimeLeft: state.setTimeLeft,
        setPauseTimer: state.setPauseTimer,
        setLevel: state.setLevel,
      }))
    );

  const {
    canvasRef,
    selectedCharacterId,
    isCorrectSelection,
    setDisableClick,
    handleCharacterClick,
  } = useCharacterInteraction();

  const generateRowColConfigs = () => {
    const baseDirection = Math.random() > 0.5 ? 1 : -1;

    const newRowConfigs: RowConfig[] = [];
    for (let i = 0; i < rowCount; i++) {
      let direction: number;

      if (sameDirection) {
        direction = baseDirection;
      } else if (alternateDirection) {
        direction = i % 2 === 0 ? 1 : -1;
      } else {
        direction = Math.random() > 0.5 ? 1 : -1;
      }

      const speed =
        (minSpeed + Math.random() * (maxSpeed - minSpeed)) * direction;
      newRowConfigs.push({ speed, offset: 0 });
    }

    const newColConfigs: ColConfig[] = [];
    for (let i = 0; i < colCount; i++) {
      let direction: number;

      if (sameDirection) {
        direction = baseDirection;
      } else if (alternateDirection) {
        direction = i % 2 === 0 ? 1 : -1;
      } else {
        direction = Math.random() > 0.5 ? 1 : -1;
      }

      const speed =
        (minSpeed + Math.random() * (maxSpeed - minSpeed)) * direction;
      newColConfigs.push({ speed, offset: 0 });
    }

    setRowConfigs(newRowConfigs);
    setColConfigs(newColConfigs);

    return { newRowConfigs, newColConfigs };
  };

  const placeCharacters = () => {
    if (!grid || !wantedCharacter) return;

    const availableCharacters = grid.filter(
      (cell): cell is GridCell => cell !== null && cell !== undefined
    );

    if (availableCharacters.length === 0) return;

    const wantedCell = availableCharacters.find(
      (cell) => cell?.name === wantedCharacter.name
    );

    if (!wantedCell) return;

    generateRowColConfigs();

    const charactersGrid: PlacedCharacter[] = [];

    let wantedRowIndex: number, wantedColIndex: number;

    if (difficulty <= 1) {
      wantedRowIndex = Math.floor(rowCount / 2) + randomIntFromInterval(-1, 1);
      wantedColIndex = Math.floor(colCount / 2) + randomIntFromInterval(-1, 1);
    } else {
      wantedRowIndex = randomIntFromInterval(0, rowCount - 1);
      wantedColIndex = randomIntFromInterval(0, colCount - 1);
    }

    wantedRowIndex = Math.max(0, Math.min(rowCount - 1, wantedRowIndex));
    wantedColIndex = Math.max(0, Math.min(colCount - 1, wantedColIndex));

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      for (let colIndex = 0; colIndex < colCount; colIndex++) {
        const isWantedPosition =
          rowIndex === wantedRowIndex && colIndex === wantedColIndex;

        let character: GridCell;

        if (isWantedPosition) {
          character = wantedCell;
        } else {
          const otherCharacters = availableCharacters.filter(
            (cell) => cell?.name !== wantedCharacter.name
          );
          const randomIndex = randomIntFromInterval(
            0,
            otherCharacters.length - 1
          );
          character = otherCharacters[randomIndex];
        }

        if (!character) continue;

        charactersGrid.push({
          id: character.id + rowIndex * 1000 + Math.random() * 10,
          name: character.name,
          imageSrc: character.imageSrc,
          position: {
            rowIndex,
            colIndex,
            offsetX: 0,
            offsetY: 0,
          },
          isWanted: isWantedPosition,
          zIndex: isWantedPosition ? 50 : randomIntFromInterval(10, 90),
        });
      }
    }

    setPlacedCharacters(charactersGrid);
  };

  const animateGrid = (timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;

    const deltaTime = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    if (gameState === GameStateEnum.END) {
      return;
    }

    if (isCorrectSelection) {
      animationFrameRef.current = requestAnimationFrame(animateGrid);
      return;
    }

    if (scrollDirection === "horizontal") {
      setRowConfigs((prev) =>
        prev.map((config) => {
          let newOffset = config.offset + config.speed * deltaTime * 60;

          if (newOffset > GRID_SIZE_WIDTH) {
            newOffset -= GRID_SIZE_WIDTH;
          } else if (newOffset < -GRID_SIZE_WIDTH) {
            newOffset += GRID_SIZE_WIDTH;
          }

          return { ...config, offset: newOffset };
        })
      );
    } else {
      setColConfigs((prev) =>
        prev.map((config) => {
          let newOffset = config.offset + config.speed * deltaTime * 60;

          if (newOffset > GRID_SIZE_HEIGHT) {
            newOffset -= GRID_SIZE_HEIGHT;
          } else if (newOffset < -GRID_SIZE_HEIGHT) {
            newOffset += GRID_SIZE_HEIGHT;
          }

          return { ...config, offset: newOffset };
        })
      );
    }

    animationFrameRef.current = requestAnimationFrame(animateGrid);
  };

  useEffect(() => {
    if (grid && wantedCharacter && !animationLevelLoading) {
      setDisableClick(true);
      setIsInitializing(true);

      placeCharacters();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      const initTimer = setTimeout(() => {
        setIsInitializing(false);
        setDisableClick(false);

        if (!animationLevelLoading) {
          lastTimeRef.current = performance.now();
          animationFrameRef.current = requestAnimationFrame(animateGrid);
        }
      }, 100);

      return () => {
        clearTimeout(initTimer);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [
    grid,
    wantedCharacter,
    difficulty,
    scrollDirection,
    minSpeed,
    maxSpeed,
    sameDirection,
    alternateDirection,
    animationLevelLoading,
  ]);

  useEffect(() => {
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }

    if (selectedCharacterId !== null && !isCorrectSelection) {
      let count = 0;
      blinkIntervalRef.current = setInterval(() => {
        setBlinkState((prev) => !prev);
        count++;

        if (count >= 4) {
          if (blinkIntervalRef.current) {
            clearInterval(blinkIntervalRef.current);
            blinkIntervalRef.current = null;
          }
          setBlinkState(true);
        }
      }, 125);
    }

    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
    };
  }, [selectedCharacterId, isCorrectSelection]);

  const calculateSpacing = () => {
    const elementsPerRow = Math.min(placedCharacters.length, colCount);
    const elementsPerCol = Math.min(placedCharacters.length, rowCount);

    const availableSpaceWidth = GRID_SIZE_WIDTH - elementsPerRow * CELL_SIZE;
    const availableSpaceHeight = GRID_SIZE_HEIGHT - elementsPerCol * CELL_SIZE;

    const horizontalSpacing =
      elementsPerRow > 1 ? availableSpaceWidth / (elementsPerRow - 1) : 0;
    const verticalSpacing =
      elementsPerCol > 1 ? availableSpaceHeight / (elementsPerCol - 1) : 0;

    const offsetX =
      elementsPerRow < colCount
        ? (GRID_SIZE_WIDTH - elementsPerRow * CELL_SIZE) / 2
        : 0;
    const offsetY =
      elementsPerCol < rowCount
        ? (GRID_SIZE_HEIGHT - elementsPerCol * CELL_SIZE) / 2
        : 0;

    return { horizontalSpacing, verticalSpacing, offsetX, offsetY };
  };

  const getCharacterPosition = (character: PlacedCharacter) => {
    const { rowIndex, colIndex } = character.position;
    const { horizontalSpacing, verticalSpacing } = calculateSpacing();

    const { offsetX, offsetY } = calculateSpacing();
    let x =
      offsetX + colIndex * (CELL_SIZE + horizontalSpacing) + CELL_SIZE / 2;
    let y = offsetY + rowIndex * (CELL_SIZE + verticalSpacing) + CELL_SIZE / 2;

    if (scrollDirection === "horizontal" && rowConfigs[rowIndex]) {
      x += rowConfigs[rowIndex].offset;

      while (x < -CELL_SIZE / 2) x += GRID_SIZE_WIDTH;
      while (x > GRID_SIZE_WIDTH + CELL_SIZE / 2) x -= GRID_SIZE_WIDTH;
    } else if (scrollDirection === "vertical" && colConfigs[colIndex]) {
      y += colConfigs[colIndex].offset;

      while (y < -CELL_SIZE / 2) y += GRID_SIZE_HEIGHT;
      while (y > GRID_SIZE_HEIGHT + CELL_SIZE / 2) y -= GRID_SIZE_HEIGHT;
    }

    return { x, y };
  };
  const needsClone = (character: PlacedCharacter) => {
    const { x, y } = getCharacterPosition(character);

    if (scrollDirection === "horizontal") {
      return x < CELL_SIZE || x > GRID_SIZE_WIDTH - CELL_SIZE;
    } else {
      return y < CELL_SIZE || y > GRID_SIZE_HEIGHT - CELL_SIZE;
    }
  };

  const getClonePosition = (character: PlacedCharacter) => {
    const { x, y } = getCharacterPosition(character);

    if (scrollDirection === "horizontal") {
      if (x < CELL_SIZE) {
        return { x: x + GRID_SIZE_WIDTH, y };
      } else {
        return { x: x - GRID_SIZE_WIDTH, y };
      }
    } else {
      if (y < CELL_SIZE) {
        return { x, y: y + GRID_SIZE_HEIGHT };
      } else {
        return { x, y: y - GRID_SIZE_HEIGHT };
      }
    }
  };

  if (!grid || animationLevelLoading) {
    return <div className="gridContainer"></div>;
  }

  const showOnlyWantedCharacter =
    isCorrectSelection ||
    gameState === GameStateEnum.END ||
    gameState === GameStateEnum.FINISH;

  return (
    <div ref={canvasRef} className="gridContainer">
      <Stage
        ref={stageRef}
        width={GRID_SIZE_WIDTH}
        height={GRID_SIZE_HEIGHT}
        className="canvasGameBoard"
        options={{
          powerPreference: "high-performance",
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container>
          {!isInitializing &&
            placedCharacters.map((character) => {
              const isBlinking =
                selectedCharacterId === character.id &&
                !isCorrectSelection &&
                !blinkState;

              if (isBlinking) {
                return null;
              }

              if (showOnlyWantedCharacter && !character.isWanted) {
                return null;
              }

              const { x, y } = getCharacterPosition(character);

              const renderItems = [
                { key: `character-${character.id}`, x, y, isClone: false },
              ];

              if (needsClone(character)) {
                const { x: cloneX, y: cloneY } = getClonePosition(character);
                renderItems.push({
                  key: `character-clone-${character.id}`,
                  x: cloneX,
                  y: cloneY,
                  isClone: true,
                });
              }

              return renderItems.map((item) => (
                <Sprite
                  key={item.key}
                  image={character.imageSrc}
                  x={item.x - CELL_SIZE / 2}
                  y={item.y - CELL_SIZE / 2}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  eventMode={item.isClone ? "none" : "static"}
                  pointerdown={
                    item.isClone
                      ? undefined
                      : (e) => handleCharacterClick(e, character)
                  }
                  alpha={item.isClone ? 1 : 1}
                />
              ));
            })}
        </Container>
      </Stage>
    </div>
  );
};

export default GridAnimated;
