import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Container } from "@pixi/react";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";
import { HitCandidate } from "../../../helpers/hitTest";
import { FederatedPointerEvent } from "@pixi/events";
import { Rectangle } from "pixi.js";
import { getBoard } from "../../../helpers/board";
import type { LevelSpec } from "../../../engine/types";
import { pickTap, targetName } from "./crowd";
import { layoutScroll } from "./layouts";
import { useFoundIds } from "./useFoundIds";
import { CrowdSprite, FoundMarker } from "./CrowdSprite";
import { useReleaseStage } from "./useReleaseStage";
import { isPageVisible, subscribeAppActive } from "../../../platform/appLifecycle";
import { advanceMovementClock, createMovementClock, createScrollMovement, scrollCrossAt, scrollOffsetAt, suspendMovementClock } from "./movements";

import "./Grid.css";

// Disposition "scroll" : des lignes (ou colonnes) qui défilent en boucle.
// Placement et défilement en px logiques (layoutScroll), rendu × board.scale.
const GridAnimated = ({ spec }: { spec: LevelSpec }) => {
  const board = useMemo(() => getBoard(), []);
  const releaseStage = useReleaseStage();
  const animationFrameRef = useRef<number | null>(null);
  const appActiveRef = useRef(isPageVisible());
  const movementClock = useRef(createMovementClock());

  const { gameState, animationLevelLoading } = useGameStore(
    useShallow((state) => ({
      gameState: state.gameState,
      animationLevelLoading: state.animationLevelLoading,
    }))
  );

  const {
    canvasRef,
    selectedCharacterId,
    isCorrectSelection,
    disableClick,
    setDisableClick,
    handleCharacterClick,
    blinkState,
  } = useCharacterInteraction();

  const foundIds = useFoundIds();

  // Placement, géométrie et vitesses en px logiques : figés pour la durée du niveau
  // (monté avec key={spec.seed}), indépendants de l'écran
  const layout = useMemo(() => layoutScroll(spec), [spec]);
  const movement = useMemo(() => createScrollMovement(spec, layout), [spec, layout]);
  const [elapsed, setElapsed] = useState(0);
  const offsets = layout.speeds.map((speed, line) => scrollOffsetAt(movement, line, speed, elapsed));
  const hitArea = useMemo(() => new Rectangle(0, 0, board.width, board.height), [board]);

  // Lus par la boucle d'animation sans la relancer
  const frozenRef = useRef(false);
  frozenRef.current =
    isCorrectSelection ||
    gameState !== GameStateEnum.PLAYING;

  useEffect(() => subscribeAppActive((active) => {
    appActiveRef.current = active;
    suspendMovementClock(movementClock.current);
  }), []);

  useEffect(() => {
    setDisableClick(false);
    if (animationLevelLoading) return;

    suspendMovementClock(movementClock.current);
    const tick = (now: number) => {
      const dt = advanceMovementClock(movementClock.current, now, !frozenRef.current && appActiveRef.current);
      if (dt > 0) setElapsed(movementClock.current.elapsed);
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [animationLevelLoading, setDisableClick]);

  const containerStyle = {
    width: board.width,
    height: board.height,
    maxHeight: "none",
  };

  if (animationLevelLoading) {
    return <div className="gridContainer" style={containerStyle} />;
  }

  const { horizontal, size, period, slots } = layout;
  const showOnlyWantedCharacter =
    isCorrectSelection ||
    gameState === GameStateEnum.END ||
    gameState === GameStateEnum.FINISH;

  // Persos touchables (copies comprises), remplis pendant le rendu ci-dessous
  const candidates: HitCandidate[] = [];
  const foundSpots: HitCandidate[] = [];
  const markers: { key: string; cx: number; cy: number }[] = [];

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
          backgroundAlpha: 0,
          powerPreference: "high-performance",
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container scale={board.scale}>
          {slots.map((slot) => {
            if (showOnlyWantedCharacter && !slot.isWanted) return null;
            const found = slot.isWanted && foundIds.has(slot.id);
            // Clignotement du perso touché par erreur
            if (selectedCharacterId === slot.id && !blinkState && !found) return null;

            // Position le long du défilement, ramenée dans [0, période)
            let main = (slot.main + (offsets[slot.line] ?? 0)) % period;
            if (main < 0) main += period;
            const cross = scrollCrossAt(movement, slot, main, period, size);

            // Copie de l'autre côté quand la tête déborde d'un bord
            const mains = [main];
            if (main < size) mains.push(main + period);
            else if (main > period - size) mains.push(main - period);

            return mains.map((m, k) => {
              const cx = horizontal ? m : cross;
              const cy = horizontal ? cross : m;
              // Une copie compte comme le perso d'origine (même id, même isWanted)
              const hit = {
                id: slot.id,
                cx,
                cy,
                size: size * slot.look.scale,
                z: candidates.length + foundSpots.length,
                isWanted: slot.isWanted,
              };
              if (found) {
                foundSpots.push(hit);
                if (!slot.gold) markers.push({ key: `${slot.id}-${k}`, cx, cy });
              } else if (!showOnlyWantedCharacter) candidates.push(hit);
              return (
                <CrowdSprite
                  key={`${slot.id}-${k}`}
                  name={slot.isWanted ? targetName(slot.id) : undefined}
                  cx={cx}
                  cy={cy}
                  size={size}
                  image={slot.character.imageSrc}
                  look={slot.look}
                  gold={slot.gold}
                  found={slot.gold && found}
                  phase={slot.id}
                />
              );
            });
          })}
          {markers.map((m) => (
            <FoundMarker key={`found-${m.key}`} cx={m.cx} cy={m.cy} size={size} />
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

export default GridAnimated;
