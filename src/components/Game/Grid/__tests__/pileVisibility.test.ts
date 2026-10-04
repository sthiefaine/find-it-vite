import { describe, expect, it } from "vitest";
import { generateLevel } from "../../../../engine/generateLevel";
import { createRng } from "../../../../engine/rng";
import type { LevelSpec } from "../../../../engine/types";
import { charactersDetails } from "../../../../helpers/characters";
import { HIT_RADIUS_RATIO, pickCharacterAt } from "../../../../helpers/hitTest";
import { placePile } from "../layouts";
import { pileClearTouchPoint, pileDebugZones, pileHeadVisibility, placeHiddenPileTarget, PILE_TOUCH_RADIUS } from "../pileVisibility";

const base = generateLevel(55, { seed: 42, tier: "normal", pool: charactersDetails, allowedRules: ["classic"] });
const hiddenPile = (seed: number, visibility = { min: .18, max: .65 }): LevelSpec => ({
  ...base, seed, layout: "pile", rule: "classic", findCount: 1,
  params: { count: 300, jitter: 5, wantedBelow: true, backgroundGrid: true, pileVisibility: visibility },
});

describe("cible cachée dans le grand tas", () => {
  it("varie le masquage sans vider le centre et laisse toujours un morceau visible réellement touchable", () => {
    for (const range of [{ min: .18, max: .65 }, { min: .15, max: .5 }]) {
      const ratios: number[] = [];
      let coveredCenters = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const spec = hiddenPile(seed, range);
        const crowd = placePile(spec);
        expect(crowd).toHaveLength(388);
        expect(new Set(crowd.map((character) => character.id)).size).toBe(crowd.length);
        const targets = crowd.filter((character) => character.isWanted);
        expect(targets).toHaveLength(1);
        const wanted = targets[0];
        const visible = pileHeadVisibility(crowd, wanted, 45);
        expect(visible, `seed ${seed}`).toBeGreaterThanOrEqual(range.min);
        expect(visible, `seed ${seed}`).toBeLessThanOrEqual(range.max);
        ratios.push(visible);
        const point = pileClearTouchPoint(crowd, wanted, 45);
        expect(point, `seed ${seed} sans ouverture`).toBeDefined();
        if (!point) continue;
        expect(Math.hypot(point.x - wanted.x, point.y - wanted.y) + PILE_TOUCH_RADIUS).toBeLessThanOrEqual(45 * HIT_RADIUS_RATIO + 1e-8);
        const above = crowd.filter((character) => !character.isWanted && character.zIndex >= wanted.zIndex);
        if (above.some((character) => Math.abs(character.x - wanted.x) <= 22.5 && Math.abs(character.y - wanted.y) <= 22.5)) coveredCenters++;
        for (const blocker of above) {
          const dx = Math.max(0, Math.abs(point.x - blocker.x) - 22.5);
          const dy = Math.max(0, Math.abs(point.y - blocker.y) - 22.5);
          expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(PILE_TOUCH_RADIUS);
        }
        const candidates = crowd.map((character, z) => ({ ...character, cx: character.x, cy: character.y, size: 45, z }));
        expect(pickCharacterAt(point.x, point.y, candidates, 0)?.id).toBe(wanted.id);
        expect(wanted.imageSrc).toBe(spec.wanted.imageSrc);
        expect(crowd.filter((character) => !character.isWanted).every((character) => spec.decoys.some((decoy) => decoy.imageSrc === character.imageSrc))).toBe(true);
      }
      expect(coveredCenters).toBeGreaterThan(50);
      expect(Math.min(...ratios)).toBeLessThan(range.min + .08);
      expect(Math.max(...ratios)).toBeGreaterThan(range.max - .08);
    }
  });

  it("reste déterministe, conserve les tenues et ne cache pas les cibles prévues au-dessus", () => {
    const spec = { ...hiddenPile(7), accessories: { target: "moustache" as const, decoyChance: .5 } };
    const crowd = placePile(spec);
    expect(placePile(spec)).toEqual(crowd);
    expect(crowd.find((character) => character.isWanted)?.look.accessoryId).toBe("moustache");
    const safe = { ...spec, params: { ...spec.params, wantedBelow: false } };
    expect(placePile(safe)).toEqual(placePile({ ...safe, params: { ...safe.params, pileVisibility: undefined } }));
    const legacy = { ...spec, params: { ...spec.params, pileVisibility: undefined } };
    const original = placePile(legacy);
    const target = original.find((character) => character.isWanted)!;
    expect(original.filter((character) => !character.isWanted && character.zIndex >= target.zIndex)
      .every((character) => Math.hypot(character.x - target.x, character.y - target.y) >= 45 * .8)).toBe(true);
  });

  it("restaure les trois cercles de visibilité du tas historique", () => {
    const zones = pileDebugZones(100, 200, 45);
    expect(zones.map((zone) => zone.color)).toEqual([0xff0000, 0x00ff00, 0x0000ff]);
    expect(zones[0]).toMatchObject({ x: 100, y: 200 - 45 / 3.2 - 2, radius: 45 / 6.4 });
    expect(zones[1]).toMatchObject({ x: 100, y: 200, radius: 45 / 3.2 / 1.6 });
    expect(zones[2]).toMatchObject({ x: 100, y: 200 + 45 / 3.2 + 2, radius: 45 / 6.4 });
  });

  it("garde une ouverture touchable même si tous les tirages de cachettes tombent sur le même amas", () => {
    const crowded = placePile(hiddenPile(42)).map((character) => ({ ...character, x: 195, y: 260, zIndex: character.isWanted ? 2 : 90 }));
    const wanted = crowded.find((character) => character.isWanted)!;
    const repeatedRng = { ...createRng(42), next: () => .5, pick: <T,>(items: readonly T[]) => items[0] };
    const result = placeHiddenPileTarget(crowded, wanted, { min: .18, max: .2 }, repeatedRng, { w: 390, h: 520, size: 45 });
    const target = result.find((character) => character.isWanted)!;
    expect(result).toHaveLength(crowded.length);
    expect(pileHeadVisibility(result, target, 45)).toBeGreaterThanOrEqual(.18);
    expect(pileHeadVisibility(result, target, 45)).toBeLessThanOrEqual(.2);
    expect(pileClearTouchPoint(result, target, 45)).toBeDefined();
  });
});
