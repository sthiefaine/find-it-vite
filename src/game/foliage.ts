import { createRng, hash32 } from "../engine/rng";
import { BOARD } from "../engine/types";
import type { Tier } from "../engine/types";

export type FoliageDensity = "light" | "dense";
export type FoliagePoint = { x: number; y: number };
export type FoliagePatch = FoliagePoint & { id: number; size: number; rotation: number };
export type FoliageDrag = {
  pointerId: number;
  patchId: number;
  start: FoliagePoint;
  offset: FoliagePoint;
};

export const FOLIAGE_DRAG_THRESHOLD = 28;

// La graine ne touche pas au placement des animaux. Les bouquets occupent des
// secteurs différents et chacun peut être complètement sorti du plateau.
export function makeFoliage(seed: number, density: FoliageDensity, tier: Tier): FoliagePatch[] {
  const rng = createRng(hash32(seed, "foliage-v1"));
  const count = density === "light" ? 2 : tier === "easy" ? 2 : tier === "expert" ? 4 : 3;
  const anchors = rng.shuffle([
    { x: 0.26, y: 0.29 }, { x: 0.74, y: 0.33 },
    { x: 0.27, y: 0.70 }, { x: 0.73, y: 0.73 },
  ]);
  return anchors.slice(0, count).map((point, id) => ({
    id,
    x: Math.round(point.x * BOARD.w + rng.int(-13, 13)),
    y: Math.round(point.y * BOARD.h + rng.int(-15, 15)),
    size: (tier === "easy" ? 130 : density === "dense" ? 156 : 144) + rng.int(-8, 8),
    rotation: rng.int(-24, 24),
  }));
}

export function moveFoliageDrag(drag: FoliageDrag, pointerId: number, point: FoliagePoint): FoliageDrag {
  if (pointerId !== drag.pointerId) return drag;
  return { ...drag, offset: { x: point.x - drag.start.x, y: point.y - drag.start.y } };
}

// Un simple toucher ne trouve jamais l'animal dessous. Un geste annulé revient
// au point de départ, même si le doigt avait déjà dépassé le seuil.
export function foliageDragClears(drag: FoliageDrag, cancelled = false): boolean {
  return !cancelled && Math.hypot(drag.offset.x, drag.offset.y) >= FOLIAGE_DRAG_THRESHOLD;
}

export function foliageExit(patch: FoliagePatch, offset: FoliagePoint): FoliagePoint {
  const radius = patch.size * Math.SQRT1_2 + 12;
  let dx = offset.x;
  let dy = offset.y;
  if (Math.hypot(dx, dy) < 1) {
    const edges = [
      { distance: patch.x, x: -1, y: 0 },
      { distance: BOARD.w - patch.x, x: 1, y: 0 },
      { distance: patch.y, x: 0, y: -1 },
      { distance: BOARD.h - patch.y, x: 0, y: 1 },
    ];
    const edge = edges.reduce((best, next) => next.distance < best.distance ? next : best);
    dx = edge.x;
    dy = edge.y;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: (dx < 0 ? -radius : BOARD.w + radius) - patch.x, y: offset.y };
  }
  return { x: offset.x, y: (dy < 0 ? -radius : BOARD.h + radius) - patch.y };
}

// Coordonnées dans le carré source, avec rotation inverse pour tester l'alpha
// du PNG. Ses espaces transparents restent accessibles au joueur.
export function foliageLocalPoint(patch: FoliagePatch, offset: FoliagePoint, point: FoliagePoint): FoliagePoint {
  const radians = -patch.rotation * Math.PI / 180;
  const x = point.x - patch.x - offset.x;
  const y = point.y - patch.y - offset.y;
  return {
    x: (x * Math.cos(radians) - y * Math.sin(radians)) / patch.size + 0.5,
    y: (x * Math.sin(radians) + y * Math.cos(radians)) / patch.size + 0.5,
  };
}

export function foliageHit(
  patch: FoliagePatch,
  offset: FoliagePoint,
  point: FoliagePoint,
  alpha: Uint8ClampedArray,
  maskSize: number,
): boolean {
  const local = foliageLocalPoint(patch, offset, point);
  if (local.x < 0 || local.x >= 1 || local.y < 0 || local.y >= 1) return false;
  const pixel = Math.floor(local.y * maskSize) * maskSize + Math.floor(local.x * maskSize);
  return alpha[pixel * 4 + 3] > 48;
}
