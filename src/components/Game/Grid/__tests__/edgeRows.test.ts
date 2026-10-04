import { describe, expect, it } from "vitest";
import { generateLevel } from "../../../../engine/generateLevel";
import { BOARD, type LevelSpec } from "../../../../engine/types";
import { charactersDetails } from "../../../../helpers/characters";
import { pickCharacterAt } from "../../../../helpers/hitTest";
import { layoutScroll } from "../layouts";
import { createScrollMovement, scrollCrossAt, scrollOffsetAt } from "../movements";

const base = generateLevel(4, { seed: 42, tier: "normal", pool: charactersDetails });
const scrollSpec = (seed: number, direction: "horizontal" | "vertical", extraLines = 2): LevelSpec => ({
  ...base, seed, layout: "scroll", rule: "classic", findCount: 1,
  params: { speed: 1.1, scrollDirection: direction, extraLines, edgeRows: true, scrollFill: 1 },
});

describe("demi-rangées sur les bords du défilement", () => {
  it("montre une demi-rangée sur chaque bord transverse, au lieu de ramener toutes les têtes à l'intérieur", () => {
    for (const direction of ["horizontal", "vertical"] as const) {
      const crossLength = direction === "horizontal" ? BOARD.h : BOARD.w;
      for (const extra of [0, 1, 2, 3]) {
        const spec = scrollSpec(42, direction, extra);
        const layout = layoutScroll(spec);
        const perLine = Math.floor(layout.period / 45);
        const lineCount = Math.floor(crossLength / 45) + extra;
        const first = layout.slots.filter((slot) => slot.line === 0);
        const last = layout.slots.filter((slot) => slot.line === lineCount - 1);
        expect(layout.speeds).toHaveLength(lineCount);
        expect(layout.slots).toHaveLength(perLine * lineCount);
        expect(first).toHaveLength(perLine);
        expect(last).toHaveLength(perLine);
        expect(first.every((slot) => slot.cross === 0 && !slot.isWanted)).toBe(true);
        expect(last.every((slot) => Math.abs(slot.cross - crossLength) < 1e-8 && !slot.isWanted)).toBe(true);
        expect(new Set(layout.slots.map((slot) => slot.id)).size).toBe(layout.slots.length);
        expect(layout.slots.every((slot) => slot.isWanted || slot.character.name !== spec.wanted.name)).toBe(true);
        expect(layout.size).toBe(45);
      }
    }
  });

  it("garde la cible entière entre les demi-rangées, même quand son tirage initial tombait sur un bord", () => {
    for (const direction of ["horizontal", "vertical"] as const) {
      let relocated = 0;
      for (let seed = 1; seed <= 80; seed++) {
        const spec = { ...scrollSpec(seed, direction), accessories: { target: "moustache" as const, decoyChance: .4 } };
        const layout = layoutScroll(spec);
        const original = layoutScroll({ ...spec, params: { ...spec.params, edgeRows: false } });
        const wanted = layout.slots.filter((slot) => slot.isWanted);
        expect(wanted).toHaveLength(1);
        const target = wanted[0];
        if (target.id !== original.slots.find((slot) => slot.isWanted)?.id) relocated++;
        expect(target.line).toBeGreaterThan(0);
        expect(target.line).toBeLessThan(layout.speeds.length - 1);
        expect(target.cross).toBeGreaterThanOrEqual(22.5);
        expect(target.cross).toBeLessThanOrEqual((layout.horizontal ? BOARD.h : BOARD.w) - 22.5);
        expect(target.look.accessoryId).toBe("moustache");
        expect(layout.speeds).toEqual(original.speeds);
        expect(layoutScroll(spec)).toEqual(layout);
        const sparse = layoutScroll({ ...spec, params: { ...spec.params, scrollFill: .3 } });
        expect(sparse.slots.filter((slot) => slot.isWanted)).toEqual(wanted);
      }
      expect(relocated).toBeGreaterThan(5);
    }
  });

  it("conserve le toucher et les copies de boucle sur l'axe principal", () => {
    for (const direction of ["horizontal", "vertical"] as const) {
      for (const movement of ["linear", "stopGo", "wave"] as const) {
        const spec = { ...scrollSpec(7, direction), params: { ...scrollSpec(7, direction).params, movement } };
        const layout = layoutScroll(spec);
        const plan = createScrollMovement(spec, layout);
        for (const time of [0, 1, 5, 10, 100]) {
          const candidates = layout.slots.map((slot, z) => {
            const main = ((slot.main + scrollOffsetAt(plan, slot.line, layout.speeds[slot.line], time)) % layout.period + layout.period) % layout.period;
            const cross = scrollCrossAt(plan, slot, main, layout.period, 45);
            return { id: slot.id, cx: layout.horizontal ? main : cross, cy: layout.horizontal ? cross : main, size: 45, z, isWanted: slot.isWanted };
          });
          const edgeSlots = layout.slots.filter(slot => slot.line === 0 || slot.line === layout.speeds.length - 1);
          for (const slot of edgeSlots) expect(scrollCrossAt(plan, slot, time * 10, layout.period, 45)).toBe(slot.cross);
          const target = candidates.find((candidate) => candidate.isWanted)!;
          expect(pickCharacterAt(target.cx, target.cy, candidates)?.id).toBe(target.id);
        }
      }
    }
  });

  it("ne change aucun placement historique lorsque l'option est absente", () => {
    const original = layoutScroll(base);
    expect(layoutScroll({ ...base, params: { ...base.params, edgeRows: false } })).toEqual(original);
  });
});
