import { describe, expect, it } from "vitest";
import { generatePlayableLevel } from "../playableLevel";
import { charactersDetails } from "../../helpers/characters";
import { validateSpec } from "../../engine/validate";
import { WORLDS } from "../../content/worlds";
import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../../components/Game/Grid/layouts";

describe("objectif unique des parties", () => {
  it("garde une seule cible visible, même aux anciens niveaux de bonus ou d'intrus", () => {
    const layouts = new Set<string>();
    for (const tier of ["easy", "normal", "expert"] as const) {
      for (let index = 1; index <= 150; index++) {
        const spec = generatePlayableLevel(index, { seed: 42, tier, pool: charactersDetails });
        expect(spec.rule).toBe("classic");
        expect(spec.findCount).toBe(1);
        expect(spec.durationS).toBeUndefined();
        layouts.add(spec.layout);
      }
    }
    expect(layouts.size).toBe(4);
  });

  it("produit des foules valides de 45 px, avec une cible, pour les deux mondes et les reprises", () => {
    for (const world of WORLDS) {
      for (const tier of ["easy", "normal", "expert"] as const) {
        for (const seed of [1, 42, 2026]) {
          const context = { tier, seed, pool: world.characters };
          for (const index of [...Array.from({ length: 40 }, (_, i) => i + 1), 41, 71, 200, 4000]) {
            const spec = generatePlayableLevel(index, context);
            const check = validateSpec(spec, context);
            expect(check.errors, `${world.id} ${tier} #${index}`).toEqual([]);
            expect(spec.modifiers).not.toContain("flashlight");
            expect(spec.spriteSize).toBe(45);
            expect(spec.scene?.name).toBeTruthy();
            const crowd = spec.layout === "grid" ? layoutGrid(spec).cells : spec.layout === "scroll" ? layoutScroll(spec).slots
              : spec.layout === "pile" ? placePile(spec) : placeSwarm(spec);
            expect(crowd.filter((item) => item.isWanted)).toHaveLength(1);
          }
        }
      }
    }
  });

  it("allège la foule et ne cumule pas oiseaux et feuillage en Enfant", () => {
    for (let index = 1; index <= 70; index++) {
      const context = { seed: 42, pool: charactersDetails };
      const easy = generatePlayableLevel(index, { ...context, tier: "easy" });
      const normal = generatePlayableLevel(index, { ...context, tier: "normal" });
      expect(easy.scene?.foliage).not.toBe("dense");
      expect(Boolean(easy.scene?.foliage && easy.scene.seagulls)).toBe(false);
      for (const parameter of ["gridSize", "count", "speed", "extraLines"] as const) {
        if (easy.params[parameter] !== undefined) expect(easy.params[parameter]).toBeLessThanOrEqual(normal.params[parameter]!);
      }
    }
  });

  it("reste déterministe et respecte les modificateurs explicitement désactivés", () => {
    const context = { seed: 2026, tier: "normal" as const, pool: charactersDetails, allowedModifiers: [] };
    const spec = generatePlayableLevel(40, context);
    expect(generatePlayableLevel(40, context)).toEqual(spec);
    expect(spec.modifiers).toEqual([]);
  });

  it("introduit le défilement avec une petite foule et conserve toujours la cible", () => {
    for (const seed of [1, 42, 2026]) {
      const context = { seed, pool: charactersDetails };
      const easy = layoutScroll(generatePlayableLevel(3, { ...context, tier: "easy" })).slots;
      const normal = layoutScroll(generatePlayableLevel(3, { ...context, tier: "normal" })).slots;
      expect(easy).toHaveLength(22);
      expect(normal).toHaveLength(37);
      expect(easy.filter((c) => c.isWanted)).toHaveLength(1);
      expect(normal.filter((c) => c.isWanted)).toHaveLength(1);
    }
  });

  it("alterne les lignes complètes et espacées, y compris lors des reprises", () => {
    for (const tier of ["easy", "normal", "expert"] as const) {
      const context = { seed: 42, tier, pool: charactersDetails };
      for (const index of [4, 10, 13, 17, 19, 22, 23, 26, 29, 31, 34, 37, 39, 42, 46, 49, 52, 54, 58, 61, 64]) {
        const spec = generatePlayableLevel(index, context);
        const crowd = layoutScroll(spec);
        const original = layoutScroll({ ...spec, params: { ...spec.params, scrollFill: undefined } });
        expect(spec.layout).toBe("scroll");
        expect(spec.params.scrollFill).toBe(1);
        expect(crowd).toEqual(original);
        expect(crowd.slots).toHaveLength(crowd.speeds.length * Math.floor(crowd.period / crowd.size));
        expect(crowd.slots.filter((slot) => slot.isWanted)).toHaveLength(1);
        expect(crowd.size).toBe(45);
      }
      for (const index of [3, 7, 12]) {
        const spec = generatePlayableLevel(index, context);
        const crowd = layoutScroll(spec);
        const full = layoutScroll({ ...spec, params: { ...spec.params, scrollFill: 1 } });
        expect(spec.params.scrollFill).toBeLessThan(1);
        expect(crowd.slots.length).toBeLessThan(full.slots.length);
        expect(crowd.slots.filter((slot) => slot.isWanted)).toHaveLength(1);
      }
    }
  });

  it("retrouve les plateaux pleins, les tas superposés et les rondes chargées après le niveau 40", () => {
    for (const tier of ["normal", "expert"] as const) {
      const context = { seed: 53, tier, pool: charactersDetails };
      for (let index = 41; index <= 100; index++) {
        const spec = generatePlayableLevel(index, context);
        if (spec.layout === "grid") {
          const { cells } = layoutGrid(spec);
          expect(spec.params.fullGrid).toBe(true);
          expect(cells.length).toBeGreaterThanOrEqual(88);
          expect(cells.filter((cell) => cell.isWanted)).toHaveLength(1);
        } else if (spec.layout === "pile") {
          const crowd = placePile(spec);
          expect(spec.params.backgroundGrid).toBe(true);
          expect(crowd.length).toBeGreaterThanOrEqual(210);
          expect(crowd.filter((animal) => animal.isBackground)).toHaveLength(88);
          expect(crowd.filter((animal) => animal.isWanted)).toHaveLength(1);
          expect(spec.params.wantedBelow).toBe(!spec.scene?.foliage);
        } else if (spec.layout === "swarm") {
          expect(placeSwarm(spec).length).toBeGreaterThanOrEqual(99);
          expect(spec.params.count).toBeLessThanOrEqual(120);
        }
        expect(validateSpec(spec, context).errors).toEqual([]);
      }
      const level53 = generatePlayableLevel(53, context);
      expect(level53.params).toMatchObject({ fullGrid: true, staggered: true });
      expect(layoutGrid(level53).cells.length).toBe(93);
    }
  });

  it("place moins d'animaux en défilement Enfant dans la campagne et les reprises", () => {
    for (let index = 1; index <= 100; index++) {
      for (const seed of [1, 42, 2026]) {
        const context = { seed, pool: charactersDetails };
        const easy = generatePlayableLevel(index, { ...context, tier: "easy" });
        if (easy.layout !== "scroll") continue;
        const normal = generatePlayableLevel(index, { ...context, tier: "normal" });
        const easyCrowd = layoutScroll(easy).slots;
        const normalCrowd = layoutScroll(normal).slots;
        expect(easyCrowd.length, `scène ${index}`).toBeLessThanOrEqual(normalCrowd.length);
        expect(easyCrowd.filter((c) => c.isWanted)).toHaveLength(1);
        expect(normalCrowd.filter((c) => c.isWanted)).toHaveLength(1);
      }
    }
  });
});
