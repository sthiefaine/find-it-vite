import { describe, expect, it } from "vitest";
import { BOARD } from "../../engine/types";
import {
  FOLIAGE_DRAG_THRESHOLD, foliageDragClears, foliageExit, foliageHit,
  foliageLocalPoint, makeFoliage, moveFoliageDrag,
} from "../foliage";
import type { FoliageDrag, FoliagePatch } from "../foliage";

const origin = { x: 0, y: 0 };
const patch: FoliagePatch = { id: 0, x: 100, y: 160, size: 120, rotation: 0 };
const gesture: FoliageDrag = { pointerId: 7, patchId: 0, start: { x: 100, y: 160 }, offset: origin };

describe("feuillages à écarter", () => {
  it("rejoue le même placement avec la graine, sans superposer tous les bouquets", () => {
    expect(makeFoliage(42, "dense", "normal")).toEqual(makeFoliage(42, "dense", "normal"));
    expect(makeFoliage(42, "dense", "normal")).not.toEqual(makeFoliage(43, "dense", "normal"));
    for (let seed = 0; seed < 50; seed++) {
      const patches = makeFoliage(seed, "dense", "expert");
      for (const leaf of patches) {
        expect(leaf.x).toBeGreaterThan(leaf.size / 2);
        expect(leaf.x).toBeLessThan(BOARD.w - leaf.size / 2);
        expect(leaf.y).toBeGreaterThan(leaf.size / 2);
        expect(leaf.y).toBeLessThan(BOARD.h - leaf.size / 2);
        for (const other of patches) if (other.id !== leaf.id) {
          expect(Math.hypot(leaf.x - other.x, leaf.y - other.y)).toBeGreaterThan(145);
        }
      }
    }
  });

  it("réduit nombre et taille en mode enfant", () => {
    expect(makeFoliage(42, "dense", "easy")).toHaveLength(2);
    expect(makeFoliage(42, "dense", "normal")).toHaveLength(3);
    expect(makeFoliage(42, "dense", "expert")).toHaveLength(4);
    expect(makeFoliage(42, "light", "expert")).toHaveLength(2);
    expect(Math.max(...makeFoliage(42, "dense", "easy").map(p => p.size))).toBeLessThan(140);
  });

  it("distingue le tap, le tremblement et un vrai glissement", () => {
    expect(foliageDragClears(gesture)).toBe(false);
    expect(foliageDragClears(moveFoliageDrag(gesture, 7, { x: 104, y: 163 }))).toBe(false);
    expect(foliageDragClears(moveFoliageDrag(gesture, 7, { x: 100 + FOLIAGE_DRAG_THRESHOLD, y: 160 }))).toBe(true);
    expect(foliageDragClears(moveFoliageDrag(gesture, 7, { x: 80, y: 140 }))).toBe(true);
  });

  it("ignore un second doigt et restitue le bouquet en cas d'annulation", () => {
    expect(moveFoliageDrag(gesture, 8, { x: 200, y: 300 })).toBe(gesture);
    const moved = moveFoliageDrag(gesture, 7, { x: 170, y: 210 });
    expect(foliageDragClears(moved)).toBe(true);
    expect(foliageDragClears(moved, true)).toBe(false);
    expect(foliageDragClears(moveFoliageDrag(moved, 7, gesture.start))).toBe(false);
  });

  it("permet de dégager complètement tous les bouquets dans chaque direction ou au clavier", () => {
    for (const leaf of makeFoliage(42, "dense", "expert")) {
      for (const offset of [{ x: -50, y: 0 }, { x: 50, y: 0 }, { x: 0, y: -50 }, { x: 0, y: 50 }, origin]) {
        const exit = foliageExit(leaf, offset);
        const x = leaf.x + exit.x;
        const y = leaf.y + exit.y;
        const radius = leaf.size * Math.SQRT1_2;
        expect(x + radius < 0 || x - radius > BOARD.w || y + radius < 0 || y - radius > BOARD.h).toBe(true);
      }
    }
  });

  it("teste la vraie silhouette transparente même après rotation et déplacement", () => {
    const alpha = new Uint8ClampedArray(4 * 4 * 4);
    // Seul le carré haut-gauche est opaque : aucun hit sur les autres zones.
    alpha[3] = 255;
    expect(foliageHit(patch, origin, { x: 55, y: 115 }, alpha, 4)).toBe(true);
    expect(foliageHit(patch, origin, { x: 145, y: 205 }, alpha, 4)).toBe(false);
    expect(foliageHit(patch, origin, { x: 400, y: 500 }, alpha, 4)).toBe(false);
    expect(foliageHit({ ...patch, rotation: 90 }, { x: 20, y: 30 }, { x: 165, y: 145 }, alpha, 4)).toBe(true);
    expect(foliageLocalPoint(patch, { x: 20, y: 30 }, { x: 120, y: 190 })).toEqual({ x: 0.5, y: 0.5 });
  });
});
