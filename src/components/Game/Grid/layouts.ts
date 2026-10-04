// Placement des 4 dispositions : fonctions pures de la spec, en px LOGIQUES sur le plateau
// fixe BOARD (390×520). Aucune dépendance à la taille de l'écran : le rendu multiplie par
// board.scale (voir helpers/board.ts). Même spec ⇒ mêmes positions, sur tout appareil.
import { createRng, Rng } from "../../../engine/rng";
import { targetCount } from "../../../engine/rules";
import { BOARD } from "../../../engine/types";
import type { LayoutParams, LevelSpec } from "../../../engine/types";
import type { CharacterDetails } from "../../../helpers/characters";
import { HIT_RADIUS_RATIO } from "../../../helpers/hitTest";
import { Look, PLAIN_LOOK, crowdPool, crowdSize, placeTargets, planTargets } from "./crowd";

// ─── Cases (grid, scroll) ───

export type CrowdSlot = {
  id: number; // index de la case, unique dans le niveau
  character: CharacterDetails;
  isWanted: boolean;
  look: Look;
  gold: boolean;
};

// Remplit `cellCount` cases : les cibles sur des cases tirées au sort, la foule ailleurs
// (en ruée vers l'or, quelques cases restent vides). L'appelant fournit au moins
// targetCount(spec) cases : toutes les cibles sont toujours placées.
export function placeCrowd(spec: LevelSpec, cellCount: number, rng: Rng): CrowdSlot[] {
  const targets = planTargets(spec);
  if (cellCount < targets.length)
    throw new Error(`placeCrowd : ${cellCount} cases pour ${targets.length} cibles`);
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

// Côté de la grille : assez de cases pour toutes les cibles (et un peu de foule en ruée vers l'or)
export function gridSideFor(spec: LevelSpec): number {
  let n = Math.max(1, Math.round(spec.params.gridSize ?? 4));
  if (spec.rule === "goldRush") n = Math.max(n, 4);
  while (n * n < targetCount(spec)) n++;
  return n;
}

export type GridCell = CrowdSlot & { cx: number; cy: number };

// Écart entre deux têtes voisines de la grille, en px logiques (têtes côte à côte, comme à l'origine)
export const GRID_GAP = 3;

// Disposition "grid" : grille carrée compacte de têtes à taille fixe (spec.spriteSize),
// centrée sur le plateau logique. Elle n'est pas étalée sur toute la largeur.
export function layoutGrid(spec: LevelSpec): { cells: GridCell[]; size: number } {
  const rng = createRng(spec.seed).fork("place");
  const n = gridSideFor(spec);

  const size = spec.spriteSize;
  // Pas = une tête + un petit écart ; resserré seulement si la grille ne tiendrait pas
  const fit = n > 1 ? (Math.min(BOARD.w, BOARD.h) - size) / (n - 1) : size;
  const step = Math.min(size + GRID_GAP, fit);
  const total = (n - 1) * step + size;
  const x0 = (BOARD.w - total) / 2;
  const y0 = (BOARD.h - total) / 2;

  const placed = placeCrowd(spec, n * n, rng).map((slot) => ({
    ...slot,
    cx: x0 + (slot.id % n) * step + size / 2,
    cy: y0 + Math.floor(slot.id / n) * step + size / 2,
  }));

  // Les cibles sont dessinées en dernier : jamais recouvertes
  const others = rng.shuffle(placed.filter((c) => !c.isWanted));
  return { cells: [...others, ...placed.filter((c) => c.isWanted)], size };
}

export type ScrollSlot = CrowdSlot & { line: number; main: number; cross: number };
export type ScrollLayout = {
  horizontal: boolean;
  size: number;
  period: number; // longueur d'une boucle, le long du défilement
  speeds: number[]; // px logiques par frame à 60 fps, par ligne
  slots: ScrollSlot[];
};

// Disposition "scroll" : des lignes (ou colonnes) qui défilent en boucle
export function layoutScroll(spec: LevelSpec): ScrollLayout {
  const rng = createRng(spec.seed).fork("place");
  const horizontal = (spec.params.scrollDirection ?? "horizontal") === "horizontal";
  const size = spec.spriteSize;
  const extra = Math.max(0, Math.round(spec.params.extraLines ?? 0));

  // Axe du défilement : têtes réparties régulièrement sur une période = côté du plateau
  const period = horizontal ? BOARD.w : BOARD.h;
  const cross = horizontal ? BOARD.h : BOARD.w;
  const perLine = Math.max(1, Math.floor(period / size));
  let lineCount = Math.max(1, Math.floor(cross / size)) + extra;
  while (lineCount * perLine < targetCount(spec)) lineCount++;
  const mainStep = period / perLine;
  const crossStep = cross / lineCount;

  // Vitesse par ligne : spec.params.speed est le maximum, chaque ligne entre 60 % et 100 %
  const baseSpeed = spec.params.speed ?? 1;
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
    main: ((slot.id % perLine) + 0.5) * mainStep, // centre, le long du défilement
    cross: (Math.floor(slot.id / perLine) + 0.5) * crossStep, // centre, en travers
  }));

  return { horizontal, size, period, speeds, slots };
}

// ─── Tas et essaim (pile, swarm) ───

export type Area = { w: number; h: number; size: number };

export const areaOf = (spec: LevelSpec): Area => ({ w: BOARD.w, h: BOARD.h, size: spec.spriteSize });

type Velocity = { velocityX: number; velocityY: number };

export type CrowdCharacter = {
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

export type SwarmCharacter = CrowdCharacter & Velocity;

// Ids : recherchés 0..N-1, leurres et fond au-delà
const DECOY_ID_BASE = 1000;
const BACKGROUND_ID_BASE = 100000;
const DEFAULT_JITTER = 2;

const randomPosition = (rng: Rng, { w, h, size }: Area) => {
  const margin = size / 2;
  return { x: rng.int(margin, w - margin), y: rng.int(margin, h - margin) };
};

// `extra` est appelé juste après chaque case (ordre des tirages identique à l'historique)
function backgroundGrid<T extends CrowdCharacter>(
  rng: Rng,
  decoys: CharacterDetails[],
  jitter: number,
  { w, h, size }: Area,
  extra: (c: CrowdCharacter) => T
): T[] {
  const result: T[] = [];
  if (!decoys.length) return result;
  const cols = Math.floor(w / size);
  const rows = Math.floor(h / size);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      result.push(extra({
        id: BACKGROUND_ID_BASE + row * cols + col,
        x: col * size + size / 2 + rng.int(-jitter, jitter),
        y: row * size + size / 2 + rng.int(-jitter, jitter),
        imageSrc: rng.pick(decoys).imageSrc,
        isWanted: false,
        zIndex: 0,
        isBackground: true,
        look: PLAIN_LOOK,
        gold: false,
      }));
    }
  }
  return result;
}

// Pile
// Part minimale de la tête du recherché qui doit rester visible
const MIN_VISIBLE_HEAD_RATIO = 0.55;
const PILE_DEFAULT_COUNT = 100;
// Ordre d'affichage : fond = 0, leurres dans [10, 100], recherché au-dessus sauf wantedBelow
const PILE_DECOY_Z: [number, number] = [10, 100];
const PILE_WANTED_BELOW_Z: [number, number] = [2, 80];
const PILE_WANTED_TOP_Z = 101;

// Place le perso à au moins minDistance de (fromX, fromY), en restant sur le plateau
const moveAwayFrom = (
  rng: Rng,
  character: CrowdCharacter,
  fromX: number,
  fromY: number,
  minDistance: number,
  { w, h, size }: Area
): CrowdCharacter => {
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
const isAboveWanted = (char: CrowdCharacter, wanted: CrowdCharacter) =>
  !char.isWanted && char.zIndex >= wanted.zIndex;

// Écarte les persos posés au-dessus du recherché jusqu'à ce que minVisible de sa tête soit visible.
// La tête est un disque de rayon HIT_RADIUS_RATIO × size (comme le toucher).
const ensureHeadVisible = (
  rng: Rng,
  characters: CrowdCharacter[],
  wanted: CrowdCharacter,
  minVisible: number,
  area: Area
): CrowdCharacter[] => {
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
    if (isAboveWanted(c, wanted) && Math.hypot(c.x - wanted.x, c.y - wanted.y) < area.size * 0.8) {
      result[i] = moveAwayFrom(rng, c, wanted.x, wanted.y, 2 * r, area);
    }
  }

  for (let iteration = 0; iteration < 30; iteration++) {
    const blockers = result.filter(
      (c) => isAboveWanted(c, wanted) && Math.hypot(c.x - wanted.x, c.y - wanted.y) < 2 * r
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
    result[index] = moveAwayFrom(rng, result[index], wanted.x, wanted.y, 2 * r, area);
  }

  return result;
};

// Disposition "pile" : un tas de persos qui se chevauchent
export function placePile(spec: LevelSpec): CrowdCharacter[] {
  const area = areaOf(spec);
  const rng = createRng(spec.seed).fork("place");
  const { params } = spec;
  const count = params.count ?? PILE_DEFAULT_COUNT;
  // Les cibles dorées restent au-dessus
  const wantedBelow = (params.wantedBelow ?? false) && spec.rule !== "goldRush";
  const pool = crowdPool(spec);

  // Cibles : ids 0..N-1, sans chevauchement entre elles
  const targets = planTargets(spec);
  const spots = placeTargets(rng, targets.length, area);
  const wanted: CrowdCharacter[] = targets.map((t, i) => ({
    id: i,
    ...spots[i],
    imageSrc: t.character.imageSrc,
    isWanted: true,
    zIndex: wantedBelow ? rng.int(...PILE_WANTED_BELOW_Z) : PILE_WANTED_TOP_Z,
    look: t.look,
    gold: t.gold,
  }));

  let all: CrowdCharacter[] = [...wanted];

  if (params.backgroundGrid) {
    all.push(...backgroundGrid(rng, pool, params.jitter ?? DEFAULT_JITTER, area, (c) => c));
  }

  if (pool.length) {
    const n = crowdSize(spec, count - wanted.length);
    for (let i = 0; i < n; i++) {
      all.push({
        id: DECOY_ID_BASE + i,
        ...randomPosition(rng, area),
        imageSrc: rng.pick(pool).imageSrc,
        isWanted: false,
        zIndex: rng.int(...PILE_DECOY_Z),
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
}

// Swarm
const SWARM_DEFAULT_COUNT = 50;
const SWARM_DEFAULT_SPEED = 0.4; // px logiques par frame à 60 fps
const SWARM_DECOY_Z: [number, number] = [10, 90];
const SWARM_WANTED_Z: [number, number] = [40, 90];
const SWARM_WANTED_BELOW_Z: [number, number] = [10, 30];
// En dessous : couche basse (utilisé quand les couches vont dans deux directions)
const LOWER_LAYER_MAX_Z = 40;

const directionAt = (rng: Rng, speed: number): Velocity => {
  const angle = rng.next() * Math.PI * 2;
  return { velocityX: Math.cos(angle) * speed, velocityY: Math.sin(angle) * speed };
};

// Disposition "swarm" : positions de départ et vitesses (px logiques par frame à 60 fps)
export function placeSwarm(spec: LevelSpec): SwarmCharacter[] {
  const area = areaOf(spec);
  const rng = createRng(spec.seed).fork("place");
  const { params } = spec;
  const count = params.count ?? SWARM_DEFAULT_COUNT;
  const speed = params.speed ?? SWARM_DEFAULT_SPEED;
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
    const zIndex = rng.int(...(wantedBelow ? SWARM_WANTED_BELOW_Z : SWARM_WANTED_Z));
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
    all.push(
      ...backgroundGrid(rng, pool, params.jitter ?? DEFAULT_JITTER, area, (c) => ({
        ...c,
        ...pickVelocity(0),
      }))
    );
  }

  if (pool.length) {
    const n = crowdSize(spec, count - wantedCount);
    for (let i = 0; i < n; i++) {
      const zIndex = rng.int(...SWARM_DECOY_Z);
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
}

// Un pas d'animation de l'essaim (dt en secondes), sur le plateau logique
export function stepSwarm(
  c: SwarmCharacter,
  dt: number,
  edge: NonNullable<LayoutParams["edgeBehavior"]>,
  { w, h, size }: Area
): SwarmCharacter {
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
}
