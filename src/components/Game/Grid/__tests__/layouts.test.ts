import { describe, expect, it } from "vitest";
import { charactersDetails } from "../../../../helpers/characters";
import { boardFor } from "../../../../helpers/board";
import { pickCharacterAt } from "../../../../helpers/hitTest";
import { BOARD, generateLevel, targetCount } from "../../../../engine";
import type { Layout, LevelSpec } from "../../../../engine";
import { GRID_GAP, layoutGrid, layoutScroll, placePile, placeSwarm } from "../layouts";
import { validateSpec } from "../../../../engine/validate";
import { createScrollMovement, scrollCrossAt, scrollOffsetAt } from "../movements";

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
      expect(b.height).toBeLessThanOrEqual(h - 268 + 1e-9);
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

describe("grille compacte à taille d'origine", () => {
  it("têtes de 45, pas ≤ 45 + quelques px, grille centrée et dans le plateau", () => {
    for (const tier of ["easy", "normal", "expert"] as const) {
      const ctx = { seed: 7, tier, pool: charactersDetails };
      for (let n = 1; n <= 80; n++) {
        const spec = generateLevel(n, ctx);
        if (spec.layout !== "grid") continue;
        const { cells, size } = layoutGrid(spec);
        expect(size).toBe(45);
        const xs = [...new Set(cells.map((c) => c.cx))].sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) {
          const gap = xs[i] - xs[i - 1];
          // colonnes voisines (ou séparées par une colonne vide)
          expect(gap % (size + GRID_GAP)).toBeCloseTo(0, 5);
        }
        const minX = Math.min(...cells.map((c) => c.cx)) - size / 2;
        const maxX = Math.max(...cells.map((c) => c.cx)) + size / 2;
        expect(minX).toBeGreaterThanOrEqual(0);
        expect(maxX).toBeLessThanOrEqual(BOARD.w);
      }
    }
  });

  it("3×3 : bloc de 3 têtes centré, pas étalé sur toute la largeur", () => {
    const base = sampleSpecs().find((s) => s.layout === "grid")!;
    const spec: LevelSpec = { ...base, rule: "classic", params: { gridSize: 3 } };
    const step = 45 + GRID_GAP;
    const total = 2 * step + 45;
    const x0 = (BOARD.w - total) / 2;
    const xs = new Set(layoutGrid(spec).cells.map((c) => c.cx));
    for (const x of xs) expect([0, 1, 2].map((i) => x0 + i * step + 22.5)).toContain(x);
  });
});

describe("occupation des couloirs", () => {
  const context = { seed: 42, tier: "normal" as const, pool: charactersDetails };
  const base = generateLevel(4, context);

  it("conserve les tirages et le placement historiques sans scrollFill", () => {
    const original = layoutScroll(base);
    expect(original.slots).toHaveLength(88);
    expect(original.speeds).toEqual([
      0.3190330231608823, 0.3764605345614255, 0.4621710599064827, -0.4763448340864852,
      0.39445520094409586, -0.38578145996481183, -0.4132431412693113, -0.36564242184441537,
    ]);
    expect(original.slots.filter((slot) => slot.isWanted).map(({ id, line, main, cross }) => ({ id, line, main, cross })))
      .toEqual([{ id: 30, line: 2, main: 401.8181818181818, cross: 121.875 }]);
    expect(layoutScroll({ ...base, params: { ...base.params, scrollFill: 1 } })).toEqual(original);
  });

  it("retire seulement les leurres, avec un nombre exact et toutes les cibles préservées", () => {
    for (const seed of [1, 42, 777]) {
      for (const scrollDirection of ["horizontal", "vertical"] as const) {
        for (const findCount of [1, 3, 80]) {
          const spec: LevelSpec = { ...base, seed, rule: findCount === 1 ? "classic" : "findAll", findCount, params: { ...base.params, scrollDirection } };
          const full = layoutScroll(spec);
          for (const scrollFill of [0.15, 0.247, 0.42, 1]) {
            const reducedSpec = { ...spec, params: { ...spec.params, scrollFill } };
            const reduced = layoutScroll(reducedSpec);
            expect(layoutScroll(reducedSpec)).toEqual(reduced);
            expect(reduced.slots).toHaveLength(Math.max(findCount, Math.round(scrollFill * full.slots.length)));
            expect(reduced.slots.filter((slot) => slot.isWanted)).toEqual(full.slots.filter((slot) => slot.isWanted));
            expect(reduced.speeds).toEqual(full.speeds);
            expect(reduced.size).toBe(45);
            for (const slot of reduced.slots) expect(slot).toEqual(full.slots.find((candidate) => candidate.id === slot.id));
          }
        }
      }
    }
    const withFill = (seed: number) => layoutScroll({ ...base, seed, params: { ...base.params, scrollFill: .3 } }).slots.map((slot) => slot.id);
    expect(withFill(1)).not.toEqual(withFill(2));
  });

  it("garde le toucher sur la cible de 45 px pendant les nouveaux déplacements", () => {
    for (const scrollDirection of ["horizontal", "vertical"] as const) {
      for (const movement of ["linear", "wave", "stopGo"] as const) {
        const spec = { ...base, params: { ...base.params, scrollDirection, movement, scrollFill: .247 } };
        const layout = layoutScroll(spec);
        const plan = createScrollMovement(spec, layout);
        for (const time of [0, 2.4, 19, 120]) {
          const candidates = layout.slots.map((slot, z) => {
            const main = ((slot.main + scrollOffsetAt(plan, slot.line, layout.speeds[slot.line], time)) % layout.period + layout.period) % layout.period;
            const cross = scrollCrossAt(plan, slot, main, layout.period, layout.size);
            return { id: slot.id, cx: layout.horizontal ? main : cross, cy: layout.horizontal ? cross : main, size: layout.size, z, isWanted: slot.isWanted };
          });
          const wanted = candidates.find((candidate) => candidate.isWanted)!;
          expect(wanted.cx).toBeGreaterThanOrEqual(0);
          expect(wanted.cx).toBeLessThanOrEqual(BOARD.w);
          expect(wanted.cy).toBeGreaterThanOrEqual(0);
          expect(wanted.cy).toBeLessThanOrEqual(BOARD.h);
          expect(pickCharacterAt(wanted.cx, wanted.cy, candidates)?.id).toBe(wanted.id);
        }
      }
    }
  });

  it("valide l'option seulement lorsqu'elle est présente et refuse les valeurs hors bornes", () => {
    expect(validateSpec(base, context).ok).toBe(true);
    for (const scrollFill of [.15, .5, 1]) {
      expect(validateSpec({ ...base, params: { ...base.params, scrollFill } }, context).ok).toBe(true);
    }
    for (const scrollFill of [0, .149, 1.001, Infinity, NaN]) {
      const validation = validateSpec({ ...base, params: { ...base.params, scrollFill } }, context);
      expect(validation.errors.some((error) => error.includes("scrollFill"))).toBe(true);
    }
  });
});
