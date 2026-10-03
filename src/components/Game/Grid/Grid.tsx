import { useEffect, useMemo } from "react";
import { Stage, Container, Sprite } from "@pixi/react";
import "./Grid.css";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { useShallow } from "zustand/shallow";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";
import { FederatedPointerEvent } from "@pixi/events";
import { Rectangle } from "pixi.js";
import { HitCandidate, pickCharacterAt } from "../../../helpers/hitTest";
import { getBoard } from "../../../helpers/board";
import { createRng, Rng } from "../../../engine/rng";
import type { LevelSpec } from "../../../engine/types";
import type { CharacterDetails } from "../../../helpers/characters";

export type CrowdSlot = {
  id: number; // index de la case, unique dans le niveau
  character: CharacterDetails;
  isWanted: boolean;
};

// Nombre d'exemplaires du recherché : N seulement en findAll (pas encore géré par le jeu)
export const wantedCountFor = (spec: LevelSpec) =>
  spec.rule === "findAll" ? Math.max(1, spec.findCount) : 1;

// Remplit `cellCount` cases : les recherchés sur des cases tirées au sort, des leurres ailleurs.
export function placeCrowd(
  spec: LevelSpec,
  cellCount: number,
  rng: Rng
): CrowdSlot[] {
  const wantedCount = Math.min(wantedCountFor(spec), cellCount);
  const wantedCells = new Set(
    rng.shuffle(Array.from({ length: cellCount }, (_, i) => i)).slice(0, wantedCount)
  );
  const decoys = spec.decoys.filter((c) => c.name !== spec.wanted.name);
  const slots: CrowdSlot[] = [];
  for (let i = 0; i < cellCount; i++) {
    const isWanted = wantedCells.has(i);
    if (!isWanted && decoys.length === 0) continue;
    slots.push({
      id: i,
      character: isWanted ? spec.wanted : rng.pick(decoys),
      isWanted,
    });
  }
  return slots;
}

const GameGrid = ({ spec }: { spec: LevelSpec }) => {
  const board = useMemo(() => getBoard(), []);

  const {
    canvasRef,
    disableClick,
    setDisableClick,
    selectedCharacterId,
    handleCharacterClick,
    blinkState,
    isCorrectSelection,
  } = useCharacterInteraction();

  const { gameState, animationLevelLoading } = useGameStore(
    useShallow((state) => ({
      gameState: state.gameState,
      animationLevelLoading: state.animationLevelLoading,
    }))
  );

  // Placement et géométrie : figés pour la durée du niveau (monté avec key={spec.seed})
  const { cells, size } = useMemo(() => {
    const rng = createRng(spec.seed).fork("place");
    const n = Math.max(1, Math.round(spec.params.gridSize ?? 4));

    // Pas d'une case : la grille carrée tient dans le plateau
    const pitch = Math.min(board.width, board.height) / n;
    const size = Math.min(spec.spriteSize * board.scale, pitch * 0.92);
    // Petit espacement entre les têtes, sans dépasser le pas disponible
    const step = Math.min(pitch, size * 1.08);
    const total = (n - 1) * step + size;
    const x0 = (board.width - total) / 2;
    const y0 = (board.height - total) / 2;

    const slots = placeCrowd(spec, n * n, rng);
    const placed = slots.map((slot) => ({
      ...slot,
      x: x0 + (slot.id % n) * step,
      y: y0 + Math.floor(slot.id / n) * step,
    }));

    // Les recherchés sont dessinés en dernier : jamais recouverts
    const others = rng.shuffle(placed.filter((c) => !c.isWanted));
    return { cells: [...others, ...placed.filter((c) => c.isWanted)], size };
  }, [spec, board]);

  useEffect(() => {
    setDisableClick(false);
  }, []);

  if (animationLevelLoading) {
    return (
      <div
        className="gridContainer"
        style={{ width: board.width, height: board.height, maxHeight: "none" }}
      />
    );
  }

  const isOver =
    gameState === GameStateEnum.END || gameState === GameStateEnum.FINISH;
  const showOnlyWanted = isOver || isCorrectSelection;

  // Persos touchables, remplis pendant le rendu ci-dessous
  const candidates: HitCandidate[] = [];
  const hitArea = new Rectangle(0, 0, board.width, board.height);

  const handlePointerDown = (e: FederatedPointerEvent) => {
    if (disableClick || showOnlyWanted) return;
    const hit = pickCharacterAt(e.global.x, e.global.y, candidates);
    if (!hit) return;
    handleCharacterClick(
      { x: e.global.x, y: e.global.y },
      { id: hit.id, isWanted: hit.isWanted }
    );
  };

  return (
    <div
      ref={canvasRef}
      className="gridContainer"
      style={{ width: board.width, height: board.height, maxHeight: "none" }}
    >
      <Stage
        width={board.width}
        height={board.height}
        className="canvasGameBoard"
        style={{ width: board.width, height: board.height, maxHeight: "none" }}
        options={{
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container>
          {cells.map((cell, index) => {
            if (showOnlyWanted && !cell.isWanted) return null;
            // Clignotement du perso touché par erreur
            if (selectedCharacterId === cell.id && !blinkState) return null;

            if (!showOnlyWanted) {
              candidates.push({
                id: cell.id,
                cx: cell.x + size / 2,
                cy: cell.y + size / 2,
                size,
                z: index,
                isWanted: cell.isWanted,
              });
            }

            return (
              <Sprite
                key={cell.id}
                image={cell.character.imageSrc}
                x={cell.x}
                y={cell.y}
                width={size}
                height={size}
                eventMode="none"
              />
            );
          })}
        </Container>
        {/* Zone de toucher unique, au-dessus des sprites */}
        <Container
          eventMode="static"
          hitArea={hitArea}
          pointerdown={handlePointerDown}
        />
      </Stage>
    </div>
  );
};

export default GameGrid;
