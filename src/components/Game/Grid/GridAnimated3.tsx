import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Container, Graphics } from "@pixi/react";
import { FederatedPointerEvent } from "@pixi/events";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import "./Grid.css";
import { Rectangle } from "pixi.js";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";
import { HIT_RADIUS_RATIO, HitCandidate } from "../../../helpers/hitTest";
import { getBoard } from "../../../helpers/board";
import { createRng, Rng } from "../../../engine/rng";
import type { LayoutParams, LevelSpec } from "../../../engine/types";
import type { CharacterDetails } from "../../../helpers/characters";
import {
  Look,
  PLAIN_LOOK,
  crowdPool,
  crowdSize,
  pickTap,
  placeTargets,
  planTargets,
  targetName,
  useFoundIds,
} from "./crowd";
import { CrowdSprite, FoundMarker } from "./CrowdSprite";

// Disposition "swarm" : persos en mouvement.
// Positions et vitesses en px logiques (plateau 390 de large), × scale à l'affichage.

const DEFAULT_COUNT = 50;
const DEFAULT_SPEED = 0.4; // px logiques par frame à 60 fps
const DEFAULT_EDGE: NonNullable<LayoutParams["edgeBehavior"]> = "bounce";
const DEFAULT_JITTER = 2;
const DECOY_Z: [number, number] = [10, 90];
const WANTED_Z: [number, number] = [40, 90];
const WANTED_BELOW_Z: [number, number] = [10, 30];
// En dessous : couche basse (utilisé quand les couches vont dans deux directions)
const LOWER_LAYER_MAX_Z = 40;
const MAX_FRAME_DT = 0.1; // s : évite un saut après un onglet en arrière-plan
const DECOY_ID_BASE = 1000;
const BACKGROUND_ID_BASE = 100000;

type Velocity = { velocityX: number; velocityY: number };

type SwarmCharacter = Velocity & {
  id: number;
  x: number; // centre, px logiques
  y: number;
  imageSrc: string;
  isWanted: boolean;
  zIndex: number;
  isBackground?: boolean;
  look: Look;
  gold: boolean;
};

type Area = { w: number; h: number; size: number };

const randomPosition = (rng: Rng, { w, h, size }: Area) => {
  const margin = size / 2;
  return { x: rng.int(margin, w - margin), y: rng.int(margin, h - margin) };
};

const directionAt = (rng: Rng, speed: number): Velocity => {
  const angle = rng.next() * Math.PI * 2;
  return { velocityX: Math.cos(angle) * speed, velocityY: Math.sin(angle) * speed };
};

const placeSwarm = (spec: LevelSpec, area: Area): SwarmCharacter[] => {
  const rng = createRng(spec.seed).fork("place");
  const { params } = spec;
  const count = params.count ?? DEFAULT_COUNT;
  const speed = params.speed ?? DEFAULT_SPEED;
  // Les cibles dorées ne se cachent pas dessous
  const wantedBelow = (params.wantedBelow ?? false) && spec.rule !== "goldRush";
  const pool = crowdPool(spec);

  // Recherché caché dessous : les deux couches filent dans deux directions
  const layers = wantedBelow
    ? { lower: directionAt(rng, speed), upper: directionAt(rng, speed) }
    : null;

  // Loi de mouvement commune à toute la foule, recherché compris (aucun indice)
  const pickVelocity = (zIndex: number): Velocity => {
    if (layers) return { ...(zIndex < LOWER_LAYER_MAX_Z ? layers.lower : layers.upper) };
    return directionAt(rng, speed);
  };

  const all: SwarmCharacter[] = [];

  // Cibles : ids 0..N-1, sans chevauchement au départ
  const targets = planTargets(spec);
  const spots = placeTargets(rng, targets.length, area);
  targets.forEach((t, i) => {
    const zIndex = rng.int(...(wantedBelow ? WANTED_BELOW_Z : WANTED_Z));
    all.push({
      id: i,
      ...spots[i],
      imageSrc: t.character.imageSrc,
      isWanted: true,
      zIndex,
      look: t.look,
      gold: t.gold,
      ...pickVelocity(zIndex),
    });
  });
  const wantedCount = all.length;

  if (params.backgroundGrid) {
    all.push(...createBackgroundGrid(rng, pool, params.jitter ?? DEFAULT_JITTER, area, pickVelocity));
  }

  if (pool.length) {
    const n = crowdSize(spec, count - wantedCount);
    for (let i = 0; i < n; i++) {
      const zIndex = rng.int(...DECOY_Z);
      all.push({
        id: DECOY_ID_BASE + i,
        ...randomPosition(rng, area),
        imageSrc: rng.pick(pool).imageSrc,
        isWanted: false,
        zIndex,
        look: PLAIN_LOOK,
        gold: false,
        ...pickVelocity(zIndex),
      });
    }
  }

  return all.sort((a, b) => a.zIndex - b.zIndex);
};

const createBackgroundGrid = (
  rng: Rng,
  decoys: CharacterDetails[],
  jitter: number,
  { w, h, size }: Area,
  pickVelocity: (zIndex: number) => Velocity
): SwarmCharacter[] => {
  const result: SwarmCharacter[] = [];
  if (!decoys.length) return result;
  const cols = Math.floor(w / size);
  const rows = Math.floor(h / size);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      result.push({
        id: BACKGROUND_ID_BASE + row * cols + col,
        x: col * size + size / 2 + rng.int(-jitter, jitter),
        y: row * size + size / 2 + rng.int(-jitter, jitter),
        imageSrc: rng.pick(decoys).imageSrc,
        isWanted: false,
        zIndex: 0,
        isBackground: true,
        look: PLAIN_LOOK,
        gold: false,
        ...pickVelocity(0),
      });
    }
  }
  return result;
};

const stepCharacter = (
  c: SwarmCharacter,
  dt: number,
  edge: NonNullable<LayoutParams["edgeBehavior"]>,
  { w, h, size }: Area
): SwarmCharacter => {
  let x = c.x + c.velocityX * dt * 60;
  let y = c.y + c.velocityY * dt * 60;
  let { velocityX, velocityY } = c;
  const half = size / 2;

  if (edge === "bounce") {
    if (x < half || x > w - half) {
      velocityX = -velocityX;
      x = x < half ? half : w - half;
    }
    if (y < half || y > h - half) {
      velocityY = -velocityY;
      y = y < half ? half : h - half;
    }
  } else {
    if (x < -half) x = w + half;
    if (x > w + half) x = -half;
    if (y < -half) y = h + half;
    if (y > h + half) y = -half;
  }

  return { ...c, x, y, velocityX, velocityY };
};

const GridAnimated3 = ({ spec }: { spec: LevelSpec }) => {
  const stageRef = useRef<Stage>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const {
    canvasRef,
    disableClick,
    setDisableClick,
    selectedCharacterId,
    blinkState,
    isCorrectSelection,
    handleCharacterClick,
  } = useCharacterInteraction();

  // La boucle d'animation lit ces valeurs via des refs (sinon closure figée)
  const isCorrectSelectionRef = useRef(isCorrectSelection);
  isCorrectSelectionRef.current = isCorrectSelection;

  // Monté avec key={spec.seed} : plateau et placement calculés une fois par niveau
  const [board] = useState(getBoard);
  const { scale } = board;
  const area: Area = useMemo(
    () => ({
      w: board.width / scale,
      h: board.height / scale,
      size: spec.spriteSize,
    }),
    [board, spec.spriteSize]
  );
  const edge = spec.params.edgeBehavior ?? DEFAULT_EDGE;

  const [placedCharacters, setPlacedCharacters] = useState<SwarmCharacter[]>(
    () => placeSwarm(spec, area)
  );

  const foundIds = useFoundIds();

  const { gameState, animationLevelLoading, debug } = useGameStore(
    useShallow((state) => ({
      gameState: state.gameState,
      animationLevelLoading: state.animationLevelLoading,
      debug: state.debug,
    }))
  );

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const animateCharacters = (timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = Math.min(MAX_FRAME_DT, (timestamp - lastTimeRef.current) / 1000);
    lastTimeRef.current = timestamp;

    if (gameStateRef.current === GameStateEnum.END) return;

    // Bonne réponse : on fige la foule le temps de l'effet
    if (!isCorrectSelectionRef.current) {
      setPlacedCharacters((prev) =>
        prev.map((c) => stepCharacter(c, dt, edge, area))
      );
    }

    animationFrameRef.current = requestAnimationFrame(animateCharacters);
  };

  useEffect(() => {
    if (animationLevelLoading) return;
    setDisableClick(false);
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(animateCharacters);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [animationLevelLoading]);

  if (animationLevelLoading) {
    return <div className="gridContainer"></div>;
  }

  const size = spec.spriteSize * scale;

  const showOnlyWantedCharacter =
    isCorrectSelection ||
    gameState === GameStateEnum.END ||
    gameState === GameStateEnum.FINISH;

  // Persos touchables aux positions courantes, remplis pendant le rendu (z = ordre de dessin)
  const candidates: HitCandidate[] = [];
  const foundSpots: HitCandidate[] = [];
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
    <div ref={canvasRef} className="gridContainer">
      <Stage
        ref={stageRef}
        width={board.width}
        height={board.height}
        className="canvasGameBoard"
        options={{
          powerPreference: "high-performance",
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container>
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

            const cx = character.x * scale;
            const cy = character.y * scale;
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
                alpha={character.isBackground ? 0.9 : 1}
                phase={character.id}
              />
            );
          })}

          {/* Cibles trouvées : marqueur au-dessus de la foule */}
          {placedCharacters
            .filter((c) => c.isWanted && !c.gold && foundIds.has(c.id))
            .map((c) => (
              <FoundMarker
                key={`found-${c.id}`}
                cx={c.x * scale}
                cy={c.y * scale}
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
                  x={c.x * scale}
                  y={c.y * scale}
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

export default GridAnimated3;
