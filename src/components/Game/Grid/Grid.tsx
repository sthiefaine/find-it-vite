import { useEffect, useRef, useState } from "react";
import { Stage, Container, Sprite } from "@pixi/react";
import "./Grid.css";
import { GridCell, shuffleArray } from "../../../helpers/gameUtils";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { useShallow } from "zustand/shallow";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";
import { FederatedPointerEvent } from "@pixi/events";

const GameGrid = () => {
  const PixiRef = useRef<Stage | null>(null);
  const [cellPositions, setCellPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [sortedGrid, setSortedGrid] = useState<GridCell[]>([]);
  const gridSize = Math.min(window.innerWidth, 450);

  const {
    canvasRef,
    disableClick,
    setDisableClick,
    selectedCharacterId,
    handleCharacterClick,
    blinkState,
    isCorrectSelection,
  } = useCharacterInteraction();

  const { grid, wantedCharacter, gameState, animationLevelLoading, level } =
    useGameStore(
      useShallow((state) => ({
        grid: state.grid,
        wantedCharacter: state.wantedCharacter,
        gameState: state.gameState,
        animationLevelLoading: state.animationLevelLoading,
        level: state.level,
      }))
    );

  const CELL_SIZE = 45;
  const GRID_SIZE_WIDTH = gridSize;
  const GRID_SIZE_HEIGHT = gridSize;

  const prepareSortedGrid = () => {
    if (!grid || !wantedCharacter) return [];

    const gridCopy = [...grid].filter((cell) => cell !== null) as GridCell[];

    if (level >= 5 && wantedCharacter) {
      const wantedCell = gridCopy.find(
        (cell) => cell?.name === wantedCharacter.name
      );
      const otherCells = gridCopy.filter(
        (cell) => cell?.name !== wantedCharacter.name
      );
      return [wantedCell, ...shuffleArray(otherCells)].filter(
        (cell) => cell !== undefined
      ) as GridCell[];
    } else {
      return shuffleArray(gridCopy);
    }
  };

  useEffect(() => {
    const newSortedGrid = prepareSortedGrid();
    setSortedGrid(newSortedGrid);
  }, [grid, wantedCharacter, level]);

  const handleCellClick = (e: FederatedPointerEvent, cell: GridCell) => {
    if (cell) {
      const adaptedCharacter = {
        id: cell?.id,
        name: cell?.name,
        imageSrc: cell?.imageSrc,
        position: {
          rowIndex: 0,
          colIndex: 0,
          offsetX: 0,
          offsetY: 0,
        },
        isWanted: cell?.name === wantedCharacter?.name,
        zIndex: 0,
      };

      return handleCharacterClick(e, adaptedCharacter);
    }
    return;
  };

  useEffect(() => {
    setDisableClick(false);

    const newPositions = new Map();
    const gridLength = grid?.length || 100;
    const gridSize = Math.sqrt(gridLength);

    const spriteSize = CELL_SIZE;

    const maxGridDimension = Math.min(GRID_SIZE_WIDTH, GRID_SIZE_HEIGHT);
    const maxPossibleSpacing = maxGridDimension / gridSize;
    const spacingFactor = Math.max(
      0.5,
      Math.min(1, maxPossibleSpacing / spriteSize)
    );
    const effectiveSpacing = Math.floor(spriteSize * spacingFactor);

    const totalGridWidth = gridSize * effectiveSpacing;
    const totalGridHeight = gridSize * effectiveSpacing;

    const offsetX = Math.floor(
      (GRID_SIZE_WIDTH - totalGridWidth) / 2 - (gridSize > 10 ? gridSize : 0)
    );
    const offsetY = Math.floor(
      (GRID_SIZE_HEIGHT - totalGridHeight) / 2 - (gridSize > 10 ? gridSize : 0)
    );

    const maxEffectiveSpacing = Math.floor(maxGridDimension / gridSize);
    const finalEffectiveSpacing = Math.min(
      effectiveSpacing,
      maxEffectiveSpacing
    );

    grid?.forEach((cell, index) => {
      if (!cell) return;

      const row = Math.floor(index / gridSize);
      const col = index % gridSize;

      const x =
        col * finalEffectiveSpacing +
        offsetX +
        Math.floor((spriteSize - finalEffectiveSpacing) / 2);
      const y =
        row * finalEffectiveSpacing +
        offsetY +
        Math.floor((spriteSize - finalEffectiveSpacing) / 2);

      const maxX = GRID_SIZE_WIDTH - spriteSize;
      const maxY = GRID_SIZE_HEIGHT - spriteSize;
      const finalX = Math.max(0, Math.min(x, maxX));
      const finalY = Math.max(0, Math.min(y, maxY));

      newPositions.set(cell?.id.toString(), { x: finalX, y: finalY });
    });

    setCellPositions(newPositions);
  }, [grid, GRID_SIZE_WIDTH, GRID_SIZE_HEIGHT]);

  if (animationLevelLoading) {
    return <div className="gridContainer"></div>;
  }

  return (
    <div ref={canvasRef} className="gridContainer">
      <Stage
        ref={PixiRef}
        width={GRID_SIZE_WIDTH}
        height={GRID_SIZE_HEIGHT}
        className="canvasGameBoard"
        options={{
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container>
          {sortedGrid.map((cell, index) => {
            if (!cell) return null;

            const pos = cellPositions.get(cell.id.toString());
            if (!pos) return null;

            if (gameState === GameStateEnum.END || gameState === GameStateEnum.FINISH) {
              return (
                <Sprite
                  key={`${cell.id}-${index}`}
                  image={cell.imageSrc}
                  x={pos.x}
                  y={pos.y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  eventMode="none"
                  alpha={cell.name === wantedCharacter?.name ? 1 : 0}
                />
              );
            }

            if (isCorrectSelection) {
              return cell.name === wantedCharacter?.name ? (
                <Sprite
                  key={`${cell.id}-${index}`}
                  image={cell.imageSrc}
                  x={pos.x}
                  y={pos.y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  eventMode="none"
                />
              ) : null;
            }

            if (selectedCharacterId === cell.id && !blinkState) {
              return null; // Ne pas afficher ce personnage pendant la phase de clignotement
            }

            return (
              <Sprite
                key={`${cell.id}-${index}`}
                image={cell.imageSrc}
                x={pos.x}
                y={pos.y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                eventMode={disableClick ? "none" : "static"}
                pointerdown={
                  !disableClick ? (e) => handleCellClick(e, cell) : undefined
                }
              />
            );
          })}
        </Container>
      </Stage>
    </div>
  );
};

export default GameGrid;
