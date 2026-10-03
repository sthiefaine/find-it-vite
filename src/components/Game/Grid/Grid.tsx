import { useEffect, useMemo } from "react";
import { Stage, Container, Sprite } from "@pixi/react";
import "./Grid.css";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { useShallow } from "zustand/shallow";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";
import { FederatedPointerEvent } from "@pixi/events";
import { Rectangle } from "pixi.js";
import { HitCandidate } from "../../../helpers/hitTest";
import { getBoard } from "../../../helpers/board";
import { createRng, Rng } from "../../../engine/rng";
import type { LevelSpec } from "../../../engine/types";
import type { CharacterDetails } from "../../../helpers/characters";
import {
  Look,
  PLAIN_LOOK,
  crowdPool,
  crowdSize,
  pickTap,
  planTargets,
  targetName,
  useFoundIds,
} from "./crowd";
import { CrowdSprite, FoundMarker } from "./CrowdSprite";

export type CrowdSlot = {
  id: number; // index de la case, unique dans le niveau
  character: CharacterDetails;
  isWanted: boolean;
  look: Look;
  gold: boolean;
};

// Remplit `cellCount` cases : les cibles sur des cases tirées au sort, la foule ailleurs
// (en ruée vers l'or, quelques cases restent vides).
export function placeCrowd(
  spec: LevelSpec,
  cellCount: number,
  rng: Rng
): CrowdSlot[] {
  const targets = planTargets(spec).slice(0, cellCount);
  const order = rng.shuffle(Array.from({ length: cellCount }, (_, i) => i));
  const targetAt = new Map(order.slice(0, targets.length).map((cell, i) => [cell, targets[i]]));
  const filled = new Set(
    order.slice(targets.length, targets.length + crowdSize(spec, cellCount - targets.length))
  );
  const pool = crowdPool(spec);
  const slots: CrowdSlot[] = [];
  for (let i = 0; i < cellCount; i++) {
    const target = targetAt.get(i);
    if (target) {
      slots.push({ id: i, ...target, isWanted: true });
    } else if (filled.has(i) && pool.length) {
      slots.push({ id: i, character: rng.pick(pool), isWanted: false, look: PLAIN_LOOK, gold: false });
    }
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

    // Positions au centre des cases (rotation autour du centre)
    const slots = placeCrowd(spec, n * n, rng);
    const placed = slots.map((slot) => ({
      ...slot,
      cx: x0 + (slot.id % n) * step + size / 2,
      cy: y0 + Math.floor(slot.id / n) * step + size / 2,
    }));

    // Les cibles sont dessinées en dernier : jamais recouvertes
    const others = rng.shuffle(placed.filter((c) => !c.isWanted));
    return { cells: [...others, ...placed.filter((c) => c.isWanted)], size };
  }, [spec, board]);

  const foundIds = useFoundIds();

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

  // Persos touchables, remplis pendant le rendu ci-dessous ; cibles trouvées à part
  const candidates: HitCandidate[] = [];
  const foundSpots: HitCandidate[] = [];
  const hitArea = new Rectangle(0, 0, board.width, board.height);

  const handlePointerDown = (e: FederatedPointerEvent) => {
    if (disableClick || showOnlyWanted) return;
    const hit = pickTap(e.global.x, e.global.y, candidates, foundSpots);
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
            const found = cell.isWanted && foundIds.has(cell.id);
            // Clignotement du perso touché par erreur
            if (selectedCharacterId === cell.id && !blinkState && !found) return null;

            const hit = {
              id: cell.id,
              cx: cell.cx,
              cy: cell.cy,
              size: size * cell.look.scale,
              z: index,
              isWanted: cell.isWanted,
            };
            if (found) foundSpots.push(hit);
            else if (!showOnlyWanted) candidates.push(hit);

            return (
              <CrowdSprite
                key={cell.id}
                name={cell.isWanted ? targetName(cell.id) : undefined}
                cx={cell.cx}
                cy={cell.cy}
                size={size}
                image={cell.character.imageSrc}
                look={cell.look}
                gold={cell.gold}
                found={cell.gold && found}
                phase={cell.id}
              />
            );
          })}
          {cells.map(
            (cell) =>
              !cell.gold &&
              foundIds.has(cell.id) &&
              cell.isWanted && (
                <FoundMarker key={`found-${cell.id}`} cx={cell.cx} cy={cell.cy} size={size} />
              )
          )}
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
