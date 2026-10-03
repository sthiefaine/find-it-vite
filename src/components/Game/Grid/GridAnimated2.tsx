import { useEffect, useMemo, useRef, useState } from "react";
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
import { createRng, Rng } from "../../../engine/rng";
import type { LevelSpec } from "../../../engine/types";
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

// Disposition "pile" : un tas de persos qui se chevauchent.
// Tout le placement se fait en px logiques (plateau 390 de large), puis × scale à l'affichage.

// Part minimale de la tête du recherché qui doit rester visible
const MIN_VISIBLE_HEAD_RATIO = 0.55;
const DEFAULT_COUNT = 100;
const DEFAULT_JITTER = 2;
// Ordre d'affichage : fond = 0, leurres dans [10, 100], recherché au-dessus sauf wantedBelow
const DECOY_Z: [number, number] = [10, 100];
const WANTED_BELOW_Z: [number, number] = [2, 80];
const WANTED_TOP_Z = 101;
// Ids : recherchés 0..N-1, leurres et fond au-delà
const DECOY_ID_BASE = 1000;
const BACKGROUND_ID_BASE = 100000;

type PileCharacter = {
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

const createBackgroundGrid = (
  rng: Rng,
  decoys: CharacterDetails[],
  jitter: number,
  { w, h, size }: Area
): PileCharacter[] => {
  const result: PileCharacter[] = [];
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
      });
    }
  }
  return result;
};

// Place le perso à au moins minDistance de (fromX, fromY), en restant sur le plateau
const moveAwayFrom = (
  rng: Rng,
  character: PileCharacter,
  fromX: number,
  fromY: number,
  minDistance: number,
  { w, h, size }: Area
): PileCharacter => {
  const dx = character.x - fromX;
  const dy = character.y - fromY;
  const distance = Math.hypot(dx, dy);
  if (distance >= minDistance) return character;

  const clampX = (v: number) => Math.max(size / 2, Math.min(w - size / 2, v));
  const clampY = (v: number) => Math.max(size / 2, Math.min(h - size / 2, v));

  // Si le bord le ramène trop près, on essaie une autre direction
  let angle = distance > 0 ? Math.atan2(dy, dx) : rng.next() * Math.PI * 2;
  let x = character.x;
  let y = character.y;
  for (let attempt = 0; attempt < 8; attempt++) {
    const target = minDistance + rng.next() * size * 0.2;
    x = clampX(fromX + Math.cos(angle) * target);
    y = clampY(fromY + Math.sin(angle) * target);
    if (Math.hypot(x - fromX, y - fromY) >= minDistance) break;
    angle = rng.next() * Math.PI * 2;
  }
  return { ...character, x, y };
};

// Dessinés au-dessus : zIndex >= (tri stable, les recherchés sont insérés en premier)
const isAboveWanted = (char: PileCharacter, wanted: PileCharacter) =>
  !char.isWanted && char.zIndex >= wanted.zIndex;

// Écarte les persos posés au-dessus du recherché jusqu'à ce que minVisible de sa tête soit visible.
// La tête est un disque de rayon HIT_RADIUS_RATIO × size (comme le toucher).
const ensureHeadVisible = (
  rng: Rng,
  characters: PileCharacter[],
  wanted: PileCharacter,
  minVisible: number,
  area: Area
): PileCharacter[] => {
  const result = [...characters];
  const r = area.size * HIT_RADIUS_RATIO;

  const samples: { dx: number; dy: number }[] = [];
  const step = r / 4;
  for (let dx = -r; dx <= r; dx += step) {
    for (let dy = -r; dy <= r; dy += step) {
      if (dx * dx + dy * dy <= r * r) samples.push({ dx, dy });
    }
  }

  // Passe large : rien au-dessus dont le centre est sur le cœur de la tête
  for (let i = 0; i < result.length; i++) {
    const c = result[i];
    if (
      isAboveWanted(c, wanted) &&
      Math.hypot(c.x - wanted.x, c.y - wanted.y) < area.size * 0.8
    ) {
      result[i] = moveAwayFrom(rng, c, wanted.x, wanted.y, 2 * r, area);
    }
  }

  for (let iteration = 0; iteration < 30; iteration++) {
    const blockers = result.filter(
      (c) =>
        isAboveWanted(c, wanted) &&
        Math.hypot(c.x - wanted.x, c.y - wanted.y) < 2 * r
    );
    const coverCount = new Map<number, number>();
    let visible = 0;

    for (const { dx, dy } of samples) {
      const px = wanted.x + dx;
      const py = wanted.y + dy;
      let covered = false;
      for (const b of blockers) {
        if ((px - b.x) ** 2 + (py - b.y) ** 2 <= r * r) {
          covered = true;
          coverCount.set(b.id, (coverCount.get(b.id) ?? 0) + 1);
        }
      }
      if (!covered) visible++;
    }

    if (visible / samples.length >= minVisible) break;

    // On écarte le perso qui cache le plus de surface
    let worstId = -1;
    let worstCount = 0;
    coverCount.forEach((count, id) => {
      if (count > worstCount) {
        worstCount = count;
        worstId = id;
      }
    });
    const index = result.findIndex((c) => c.id === worstId);
    if (index === -1) break;
    result[index] = moveAwayFrom(
      rng,
      result[index],
      wanted.x,
      wanted.y,
      2 * r,
      area
    );
  }

  return result;
};

const placePile = (spec: LevelSpec, area: Area): PileCharacter[] => {
  const rng = createRng(spec.seed).fork("place");
  const { params } = spec;
  const count = params.count ?? DEFAULT_COUNT;
  // Les cibles dorées restent au-dessus
  const wantedBelow = (params.wantedBelow ?? false) && spec.rule !== "goldRush";
  const pool = crowdPool(spec);

  // Cibles : ids 0..N-1, sans chevauchement entre elles
  const targets = planTargets(spec);
  const spots = placeTargets(rng, targets.length, area);
  const wanted: PileCharacter[] = targets.map((t, i) => ({
    id: i,
    ...spots[i],
    imageSrc: t.character.imageSrc,
    isWanted: true,
    zIndex: wantedBelow ? rng.int(...WANTED_BELOW_Z) : WANTED_TOP_Z,
    look: t.look,
    gold: t.gold,
  }));

  let all: PileCharacter[] = [...wanted];

  if (params.backgroundGrid) {
    all.push(
      ...createBackgroundGrid(rng, pool, params.jitter ?? DEFAULT_JITTER, area)
    );
  }

  if (pool.length) {
    const n = crowdSize(spec, count - wanted.length);
    for (let i = 0; i < n; i++) {
      all.push({
        id: DECOY_ID_BASE + i,
        ...randomPosition(rng, area),
        imageSrc: rng.pick(pool).imageSrc,
        isWanted: false,
        zIndex: rng.int(...DECOY_Z),
        look: PLAIN_LOOK,
        gold: false,
      });
    }
  }

  // Deux passes : écarter un leurre d'une cible peut le pousser sur une autre
  for (let pass = 0; pass < 2; pass++) {
    for (const w of wanted) {
      all = ensureHeadVisible(rng, all, w, MIN_VISIBLE_HEAD_RATIO, area);
    }
  }

  // Tri stable : à zIndex égal, les recherchés (en tête) restent dessous
  return all.sort((a, b) => a.zIndex - b.zIndex);
};

const GridAnimated2 = ({ spec }: { spec: LevelSpec }) => {
  const stageRef = useRef<Stage>(null);

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
  const { scale } = board;
  const area: Area = useMemo(
    () => ({
      w: board.width / scale,
      h: board.height / scale,
      size: spec.spriteSize,
    }),
    [board, spec.spriteSize]
  );
  const placedCharacters = useMemo(() => placePile(spec, area), [spec, area]);

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

  if (animationLevelLoading) {
    return <div className="gridContainer"></div>;
  }

  const size = spec.spriteSize * scale;

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

export default GridAnimated2;
