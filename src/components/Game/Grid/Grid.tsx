import { useEffect, useState } from "react";
import { Stage, Container, Sprite } from "@pixi/react";
import "./Grid.css";
import { CELL_SIZE, GRID_SIZE, GridCell, LEVEL_SIZE } from "../../../helpers/gameUtils";
import { CharacterDetails } from "../../../helpers/characters";
import '@pixi/events'

type GameGridProps = {
  level: number;
  grid: GridCell[];
  wantedCharacter: CharacterDetails | null;
  onSelect: (cell: GridCell) => void;
  gameOver: boolean;
  isLoading: boolean;
};

const GameGrid = ({ level, grid, wantedCharacter, onSelect, gameOver, isLoading }: GameGridProps) => {
  const [disableClick, setDisableClick] = useState(false)

  useEffect(() => {
    setDisableClick(false)
  }, [grid])

  const handlePointerDown = (cell: GridCell) => {
    if (gameOver || isLoading || !cell || !wantedCharacter || disableClick) return;
    if(cell.name === wantedCharacter.name){
      setDisableClick(true)
    }
    onSelect(cell);
  };



  if (isLoading || level !== 1) {
    return <div className="gridContainer"></div>;
  }

  return (
    <div className="gridContainer">
      <Stage
        width={GRID_SIZE}
        height={GRID_SIZE}
        options={{ backgroundColor: 0xffff00 }}
        className="canvasGameBoard"
      >
        <Container>
          {grid.map((cell, index) => {
            const row = Math.floor(index / LEVEL_SIZE);
            const col = index % LEVEL_SIZE;
            const margin = (((GRID_SIZE / CELL_SIZE) - LEVEL_SIZE) * CELL_SIZE) / 2
            const x = col * (CELL_SIZE+1) + margin-1;
            const y = row * (CELL_SIZE+1) + margin-1;
            return cell && (
              <Sprite
                key={index}
                image={cell.imageSrc}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                eventMode="dynamic"
                pointerdown={() => handlePointerDown(cell)}
              />
            )
          })}
        </Container>
      </Stage>
    </div>
  );
};

export default GameGrid;