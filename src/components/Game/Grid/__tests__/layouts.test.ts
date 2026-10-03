import { describe, expect, it } from "vitest";
import { charactersDetails } from "../../../../helpers/characters";
import { boardFor } from "../../../../helpers/board";
import { pickCharacterAt } from "../../../../helpers/hitTest";
import { BOARD, generateLevel, targetCount } from "../../../../engine";
import type { Layout, LevelSpec } from "../../../../engine";
import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../layouts";

const VIEWPORTS: [number, number][] = [
  [390, 844],
  [360, 740],
  [320, 568],
  [414, 896],
  [768, 1024],
  [1280, 720],
];

// Centres logiques des cibles, quelle que soit la disposition
function targetsOf(spec: LevelSpec): { id: number; x: number; y: number }[] {
  switch (spec.layout) {
    case "grid":
      return layoutGrid(spec).cells.filter((c) => c.isWanted).map((c) => ({ id: c.id, x: c.cx, y: c.cy }));
    case "scroll": {
      const l = layoutScroll(spec);
      return l.slots
        .filter((s) => s.isWanted)
        .map((s) => (l.horizontal ? { id: s.id, x: s.main, y: s.cross } : { id: s.id, x: s.cross, y: s.main }));
    }
    case "pile":
      return placePile(spec).filter((c) => c.isWanted).map(({ id, x, y }) => ({ id, x, y }));
    case "swarm":
      return placeSwarm(spec).filter((c) => c.isWanted).map(({ id, x, y }) => ({ id, x, y }));
  }
}

// Premier niveau de chaque disposition (graine 123), plus un goldRush
function sampleSpecs(): LevelSpec[] {
  const out = new Map<string, LevelSpec>();
  for (const tier of ["easy", "normal", "expert"] as const) {
    const ctx = { seed: 123, tier, pool: charactersDetails };
    for (let n = 1; n <= 60; n++) {
      const spec = generateLevel(n, ctx);
      const key = `${tier}:${spec.layout}:${spec.rule === "goldRush"}`;
      if (!out.has(key)) out.set(key, spec);
    }
  }
  return [...out.values()];
}

describe("plateau logique fixe", () => {
  it("boardFor : rendu uniforme de BOARD (390×520), quel que soit l'écran", () => {
    for (const [w, h] of VIEWPORTS) {
      const b = boardFor(w, h);
      expect(b.width / b.scale).toBeCloseTo(BOARD.w, 9);
      expect(b.height / b.scale).toBeCloseTo(BOARD.h, 9);
      expect(b.width).toBeLessThanOrEqual(Math.min(w, 450) + 1e-9);
      expect(b.height).toBeLessThanOrEqual(h - 256 + 1e-9);
    }
    expect(boardFor(390, 844)).toEqual({ width: 390, height: 520, scale: 1 });
  });

  it("même spec ⇒ mêmes positions logiques, toutes dans le plateau", () => {
    const specs = sampleSpecs();
    expect(new Set(specs.map((s) => s.layout))).toEqual(new Set<Layout>(["grid", "scroll", "pile", "swarm"]));
    for (const spec of specs) {
      const ref = targetsOf(spec);
      expect(ref).toHaveLength(targetCount(spec));
      for (const t of ref) {
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThanOrEqual(BOARD.w);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeLessThanOrEqual(BOARD.h);
      }
      // Le placement ne lit pas l'écran : recalculé « sur chaque appareil », il est identique
      for (const [w, h] of VIEWPORTS) {
        void boardFor(w, h);
        expect(targetsOf(spec)).toEqual(ref);
      }
    }
  });

  it("toucher : écran → logique (÷ scale) retombe sur la cible, sur tout écran", () => {
    for (const spec of sampleSpecs()) {
      const size = spec.layout === "grid" ? layoutGrid(spec).size : spec.spriteSize;
      const targets = targetsOf(spec);
      const candidates = targets.map((t, z) => ({ id: t.id, cx: t.x, cy: t.y, size, z, isWanted: true }));
      for (const [w, h] of VIEWPORTS) {
        const { scale } = boardFor(w, h);
        for (const t of targets) {
          const screen = { x: t.x * scale, y: t.y * scale }; // ce que dessine le Container × scale
          const hit = pickCharacterAt(screen.x / scale, screen.y / scale, candidates);
          expect(hit?.id).toBe(t.id);
        }
      }
    }
  });
});

describe("ruée vers l'or en grille", () => {
  it("toutes les cibles sont placées, avec un peu de foule, même si gridSize vaut 3", () => {
    const base = sampleSpecs().find((s) => s.layout === "grid")!;
    const spec: LevelSpec = { ...base, rule: "goldRush", params: { gridSize: 3 } };
    const { cells } = layoutGrid(spec);
    expect(cells.filter((c) => c.isWanted)).toHaveLength(targetCount(spec));
    expect(cells.filter((c) => !c.isWanted).length).toBeGreaterThan(0);
  });
});
