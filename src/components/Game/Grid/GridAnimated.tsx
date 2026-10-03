import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Container, Sprite } from "@pixi/react";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";
import { HitCandidate } from "../../../helpers/hitTest";
import { FederatedPointerEvent } from "@pixi/events";
import { Rectangle } from "pixi.js";
import { getBoard } from "../../../helpers/board";
import { createRng } from "../../../engine/rng";
import type { LevelSpec } from "../../../engine/types";
import { placeCrowd } from "./Grid";
import { pickTap, targetName, useFoundIds } from "./crowd";
import { CrowdSprite, FoundMarker } from "./CrowdSprite";

import "./Grid.css";

// Disposition "scroll" : des lignes (ou colonnes) qui défilent en boucle.
const GridAnimated = ({ spec }: { spec: LevelSpec }) => {
  const board = useMemo(() => getBoard(), []);
  const animationFrameRef = useRef<number | null>(null);

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

  // Placement, géométrie et vitesses : figés pour la durée du niveau (monté avec key={spec.seed})
  const layout = useMemo(() => {
    const rng = createRng(spec.seed).fork("place");
    const horizontal = (spec.params.scrollDirection ?? "horizontal") === "horizontal";
    const size = spec.spriteSize * board.scale;
    const extra = Math.max(0, Math.round(spec.params.extraLines ?? 0));

    // Axe du défilement : têtes réparties régulièrement sur une période = côté du plateau
    const period = horizontal ? board.width : board.height;
    const cross = horizontal ? board.height : board.width;
    const perLine = Math.max(1, Math.floor(period / size));
    const lineCount = Math.max(1, Math.floor(cross / size)) + extra;
    const mainStep = period / perLine;
    const crossStep = cross / lineCount;

    // Vitesse par ligne : spec.params.speed est le maximum, chaque ligne entre 60 % et 100 %
    const baseSpeed = (spec.params.speed ?? 1) * board.scale;
    const baseDir = rng.chance(0.5) ? 1 : -1;
    const speeds = Array.from({ length: lineCount }, (_, i) => {
      const dir = spec.params.alternateDirection
        ? i % 2 === 0
          ? baseDir
          : -baseDir
        : rng.chance(0.5)
        ? 1
        : -1;
      return baseSpeed * (0.6 + 0.4 * rng.next()) * dir;
    });

    const slots = placeCrowd(spec, lineCount * perLine, rng).map((slot) => ({
      ...slot,
      line: Math.floor(slot.id / perLine),
      main: (slot.id % perLine + 0.5) * mainStep, // centre, le long du défilement
      cross: (Math.floor(slot.id / perLine) + 0.5) * crossStep, // centre, en travers
    }));

    return { horizontal, size, period, speeds, slots };
  }, [spec, board]);

  const [offsets, setOffsets] = useState<number[]>(() =>
    layout.speeds.map(() => 0)
  );

  // Lus par la boucle d'animation sans la relancer
  const frozenRef = useRef(false);
  frozenRef.current =
    isCorrectSelection ||
    gameState === GameStateEnum.END ||
    gameState === GameStateEnum.FINISH ||
    gameState === GameStateEnum.PAUSED;

  useEffect(() => {
    setDisableClick(false);
    if (animationLevelLoading) return;

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!frozenRef.current) {
        setOffsets((prev) =>
          prev.map((o, i) => (o + layout.speeds[i] * dt * 60) % layout.period)
        );
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [layout, animationLevelLoading]);

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
  const hitArea = new Rectangle(0, 0, board.width, board.height);

  const handlePointerDown = (e: FederatedPointerEvent) => {
    if (disableClick || showOnlyWantedCharacter) return;
    const hit = pickTap(e.global.x, e.global.y, candidates, foundSpots);
    if (!hit) return;
    handleCharacterClick(
      { x: e.global.x, y: e.global.y },
      { id: hit.id, isWanted: hit.isWanted }
    );
  };

  return (
    <div ref={canvasRef} className="gridContainer" style={containerStyle}>
      <Stage
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
        <Container>
          {slots.map((slot) => {
            if (showOnlyWantedCharacter && !slot.isWanted) return null;
            const found = slot.isWanted && foundIds.has(slot.id);
            // Clignotement du perso touché par erreur
            if (selectedCharacterId === slot.id && !blinkState && !found) return null;

            // Position le long du défilement, ramenée dans [0, période)
            let main = (slot.main + (offsets[slot.line] ?? 0)) % period;
            if (main < 0) main += period;

            // Copie de l'autre côté quand la tête déborde d'un bord
            const mains = [main];
            if (main < size) mains.push(main + period);
            else if (main > period - size) mains.push(main - period);

            return mains.map((m, k) => {
              const cx = horizontal ? m : slot.cross;
              const cy = horizontal ? slot.cross : m;
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
