import { useEffect, useMemo } from "react";
import { Stage, Container } from "@pixi/react";
import "./Grid.css";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { useShallow } from "zustand/shallow";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";
import { FederatedPointerEvent } from "@pixi/events";
import { Rectangle } from "pixi.js";
import { HitCandidate } from "../../../helpers/hitTest";
import { getBoard } from "../../../helpers/board";
import type { LevelSpec } from "../../../engine/types";
import { pickTap, targetName } from "./crowd";
import { layoutGrid } from "./layouts";
import { useFoundIds } from "./useFoundIds";
import { CrowdSprite, FoundMarker } from "./CrowdSprite";
import { useReleaseStage } from "./useReleaseStage";

// Disposition "grid". Placement en px logiques (layoutGrid), rendu × board.scale.
const GameGrid = ({ spec }: { spec: LevelSpec }) => {
  const board = useMemo(() => getBoard(), []);
  const releaseStage = useReleaseStage();

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

  // Placement : figé pour la durée du niveau (monté avec key={spec.seed}), indépendant de l'écran
  const { cells, size } = useMemo(() => layoutGrid(spec), [spec]);

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
    // Toucher en px de l'écran → px logiques
    const hit = pickTap(e.global.x / board.scale, e.global.y / board.scale, candidates, foundSpots);
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
        onMount={releaseStage}
        width={board.width}
        height={board.height}
        className="canvasGameBoard"
        style={{ width: board.width, height: board.height, maxHeight: "none" }}
        options={{
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container scale={board.scale}>
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
