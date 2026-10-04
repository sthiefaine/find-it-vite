import { describe, expect, it } from "vitest";
import { BOARD, generateLevel, targetCount } from "../../../../engine";
import type { LevelSpec } from "../../../../engine";
import { charactersDetails } from "../../../../helpers/characters";
import { pickCharacterAt } from "../../../../helpers/hitTest";
import { layoutGrid } from "../layouts";

const base = generateLevel(1, { seed: 42, tier: "normal", pool: charactersDetails, allowedRules: ["classic"] });
const fullSpec = (seed: number, staggered = false): LevelSpec => ({
  ...base, seed, layout: "grid", rule: "classic", findCount: 1,
  params: { gridSize: 3, fullGrid: true, staggered },
});

describe("grilles pleines", () => {
  it("remplit le rectangle en 8 × 11 têtes de 45 px, avec seulement des demi-leurres sur les rangées décalées", () => {
    for (const staggered of [false, true]) {
      const { cells, size } = layoutGrid(fullSpec(42, staggered));
      expect(size).toBe(45);
      expect(cells).toHaveLength(staggered ? 93 : 88);
      expect(new Set(cells.map((cell) => cell.id)).size).toBe(cells.length);
      const rows = [...new Set(cells.map((cell) => cell.cy))].sort((a, b) => a - b);
      expect(rows).toHaveLength(11);
      expect(rows[0] - size / 2).toBeLessThan(2);
      expect(BOARD.h - rows[rows.length - 1] - size / 2).toBeLessThan(2);
      rows.forEach((cy, row) => {
        const xs = cells.filter((cell) => cell.cy === cy).map((cell) => cell.cx).sort((a, b) => a - b);
        const shifted = staggered && row % 2 === 1;
        expect(xs).toHaveLength(shifted ? 9 : 8);
        expect(xs[0]).toBeCloseTo(shifted ? 0 : BOARD.w / 16);
        expect(xs[xs.length - 1]).toBeCloseTo(shifted ? BOARD.w : BOARD.w - BOARD.w / 16);
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(BOARD.w / 8);
      });
      const cropped = cells.filter((cell) => cell.cx - size / 2 < 0 || cell.cx + size / 2 > BOARD.w);
      expect(cropped).toHaveLength(staggered ? 10 : 0);
      expect(cropped.every((cell) => !cell.isWanted && cell.character.name !== base.wanted.name)).toBe(true);
    }
  });

  it("garde une cible entière, touchable et dessinée en dernier avec ou sans accessoires", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const staggered of [false, true]) {
        const spec = { ...fullSpec(seed, staggered), accessories: { target: "moustache" as const, decoyChance: .6 } };
        const layout = layoutGrid(spec);
        expect(layoutGrid(spec)).toEqual(layout);
        const targets = layout.cells.filter((cell) => cell.isWanted);
        expect(targets).toHaveLength(1);
        const wanted = targets[0];
        expect(layout.cells[layout.cells.length - 1]).toBe(wanted);
        expect(wanted.look.accessoryId).toBe("moustache");
        expect(wanted.cx).toBeGreaterThanOrEqual(layout.size / 2);
        expect(wanted.cx).toBeLessThanOrEqual(BOARD.w - layout.size / 2);
        expect(wanted.cy).toBeGreaterThanOrEqual(layout.size / 2);
        expect(wanted.cy).toBeLessThanOrEqual(BOARD.h - layout.size / 2);
        const candidates = layout.cells.map((cell, z) => ({ ...cell, size: layout.size, z }));
        expect(pickCharacterAt(wanted.cx, wanted.cy, candidates)?.id).toBe(wanted.id);
        for (const edge of candidates.filter((cell) => cell.cx === 0 || cell.cx === BOARD.w)) {
          const x = edge.cx === 0 ? 1 : BOARD.w - 1;
          expect(pickCharacterAt(x, edge.cy, candidates)?.id).toBe(edge.id);
        }
      }
    }
  });

  it("préserve les règles à plusieurs cibles et les anciennes grilles lorsque l'option est absente", () => {
    for (const rule of ["findAll", "goldRush"] as const) {
      const spec = { ...fullSpec(12, true), rule, findCount: 3 };
      const { cells, size } = layoutGrid(spec);
      const targets = cells.filter((cell) => cell.isWanted);
      expect(targets).toHaveLength(targetCount(spec));
      expect(targets.every((cell) => cell.cx >= size / 2 && cell.cx <= BOARD.w - size / 2)).toBe(true);
    }
    const legacy = layoutGrid(base);
    expect(layoutGrid({ ...base, params: { ...base.params, fullGrid: false, staggered: true } })).toEqual(legacy);
    expect(layoutGrid({ ...base, params: { ...base.params, staggered: true } })).toEqual(legacy);
  });
});
