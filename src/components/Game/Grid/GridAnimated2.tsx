import { useEffect, useMemo, useState } from "react";
import { Stage, Container, Graphics } from "@pixi/react";
import { FederatedPointerEvent } from "@pixi/events";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import "./Grid.css";
import "@pixi/events";
import { Rectangle } from "pixi.js";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";
import { HIT_RADIUS_RATIO, HitCandidate } from "../../../helpers/hitTest";
import { getBoard } from "../../../helpers/board";
import type { LevelSpec } from "../../../engine/types";
import { pickTap, targetName } from "./crowd";
import { placePile } from "./layouts";
import { useFoundIds } from "./useFoundIds";
import { CrowdSprite, FoundMarker } from "./CrowdSprite";
import { useReleaseStage } from "./useReleaseStage";

// Disposition "pile" : un tas de persos qui se chevauchent.
// Placement en px logiques sur le plateau fixe 390×520 (placePile), rendu × board.scale.

const GridAnimated2 = ({ spec }: { spec: LevelSpec }) => {

  const {
    canvasRef,
    disableClick,
    setDisableClick,
    selectedCharacterId,
    blinkState,
    isCorrectSelection,
    handleCharacterClick,
  } = useCharacterInteraction();

  // Monté avec key={spec.seed} : plateau et placement calculés une fois par niveau
  const [board] = useState(getBoard);
  const releaseStage = useReleaseStage();
  const placedCharacters = useMemo(() => placePile(spec), [spec]);

  const foundIds = useFoundIds();

  const { gameState, animationLevelLoading, debug } = useGameStore(
    useShallow((state) => ({
      gameState: state.gameState,
      animationLevelLoading: state.animationLevelLoading,
      debug: state.debug,
    }))
  );

  useEffect(() => {
    if (!animationLevelLoading) setDisableClick(false);
  }, [animationLevelLoading]);

  const containerStyle = { width: board.width, height: board.height, maxHeight: "none" };

  if (animationLevelLoading) {
    return <div className="gridContainer" style={containerStyle}></div>;
  }

  const size = spec.spriteSize;

  const showOnlyWantedCharacter =
    isCorrectSelection ||
    gameState === GameStateEnum.END ||
    gameState === GameStateEnum.FINISH;

  // Persos touchables, remplis pendant le rendu ci-dessous (z = ordre de dessin)
  const candidates: HitCandidate[] = [];
  const foundSpots: HitCandidate[] = [];
  const hitArea = new Rectangle(0, 0, board.width, board.height);

  const handlePointerDown = (e: FederatedPointerEvent) => {
    if (disableClick || showOnlyWantedCharacter) return;
    // Toucher en px de l'écran → px logiques
    const hit = pickTap(e.global.x / board.scale, e.global.y / board.scale, candidates, foundSpots);
    if (!hit) return;
    handleCharacterClick(
      { x: e.global.x, y: e.global.y },
      { id: hit.id, isWanted: hit.isWanted }
    );
  };

  return (
    <div ref={canvasRef} className="gridContainer" style={containerStyle}>
      <Stage
        onMount={releaseStage}
        width={board.width}
        height={board.height}
        className="canvasGameBoard"
        style={containerStyle}
        options={{
          powerPreference: "high-performance",
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container scale={board.scale}>
          {placedCharacters.map((character, index) => {
            const found = character.isWanted && foundIds.has(character.id);
            if (
              selectedCharacterId === character.id &&
              !isCorrectSelection &&
              !blinkState &&
              !found
            ) {
              return null;
            }

            if (showOnlyWantedCharacter && !character.isWanted) {
              return null;
            }

            const cx = character.x;
            const cy = character.y;
            const hit = {
              id: character.id,
              cx,
              cy,
              size: size * character.look.scale,
              z: index,
              isWanted: character.isWanted,
            };
            if (found) foundSpots.push(hit);
            else candidates.push(hit);

            return (
              <CrowdSprite
                key={`character-${character.id}`}
                name={character.isWanted ? targetName(character.id) : undefined}
                cx={cx}
                cy={cy}
                size={size}
                image={character.imageSrc}
                look={character.look}
                gold={character.gold}
                found={character.gold && found}
                phase={character.id}
              />
            );
          })}

          {/* Cibles trouvées : marqueur au-dessus du tas */}
          {placedCharacters
            .filter((c) => c.isWanted && !c.gold && foundIds.has(c.id))
            .map((c) => (
              <FoundMarker
                key={`found-${c.id}`}
                cx={c.x}
                cy={c.y}
                size={size}
              />
            ))}

          {/* Debug : disque de tête du recherché (zone de toucher) */}
          {debug &&
            placedCharacters
              .filter((c) => c.isWanted)
              .map((c) => (
                <Graphics
                  key={`debug-${c.id}`}
                  x={c.x}
                  y={c.y}
                  draw={(g) => {
                    g.clear();
                    g.lineStyle(2, 0xff0000, 0.6);
                    g.drawCircle(0, 0, size * HIT_RADIUS_RATIO);
                  }}
                />
              ))}
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

export default GridAnimated2;
