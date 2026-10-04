import { describe, expect, it } from "vitest";
import { charactersDetails } from "../../helpers/characters";
import {
  codeFromSeed,
  createRng,
  dailySeed,
  FLASHLIGHT_INTRO,
  generateLevel,
  hash32,
  isGoldRushSlot,
  LAYOUT_INTRO,
  RULE_INTRO,
  seedToCode,
  SPRITE_SIZE,
  validateSpec,
} from "../index";
import type { GenContext, LevelSpec, Tier } from "../index";

const TIERS: Tier[] = ["easy", "normal", "expert"];
const ctxOf = (seed: number, tier: Tier, extra: Partial<GenContext> = {}): GenContext => ({
  seed,
  tier,
  pool: charactersDetails,
  ...extra,
});

describe("rng", () => {
  it("est déterministe et fork est indépendant de la consommation", () => {
    const a = createRng(42);
    const b = createRng(42);
    a.next();
    expect(a.fork("x").next()).toBe(b.fork("x").next());
    expect(createRng(7).shuffle([1, 2, 3, 4, 5])).toEqual(createRng(7).shuffle([1, 2, 3, 4, 5]));
  });
  it("shuffle ne mute pas l'entrée, int reste dans ses bornes", () => {
    const arr = [1, 2, 3, 4];
    createRng(1).shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4]);
    const r = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
  it("code de partage aller-retour", () => {
    for (const s of [0, 1, 123456, 0xffffffff, hash32("a", 1)]) {
      const code = seedToCode(s);
      expect(code).toHaveLength(7);
      expect(codeFromSeed(code)).toBe(s);
      expect(codeFromSeed(code.toLowerCase())).toBe(s);
    }
    expect(codeFromSeed("!!")).toBeNull();
    expect(dailySeed("2026-10-03")).toBe(dailySeed("2026-10-03"));
    expect(dailySeed("2026-10-03")).not.toBe(dailySeed("2026-10-04"));
  });
});

describe("generateLevel", () => {
  it("même (seed, index, tier) ⇒ spec identique, indépendamment de l'historique", () => {
    for (const tier of TIERS) {
      const ctx = ctxOf(1234, tier);
      const direct = [generateLevel(500, ctx), generateLevel(37, ctx)];
      for (let i = 1; i < 500; i++) generateLevel(i, ctx);
      expect(generateLevel(500, ctx)).toEqual(direct[0]);
      expect(generateLevel(37, ctxOf(1234, tier))).toEqual(direct[1]);
    }
  });

  it("3 tiers × 20 graines × niveaux 1-300 : specs valides et calendrier respecté", () => {
    for (const tier of TIERS) {
      for (let s = 0; s < 20; s++) {
        const ctx = ctxOf(hash32("test", s), tier);
        const specs: LevelSpec[] = [];
        for (let n = 1; n <= 300; n++) {
          const spec = generateLevel(n, ctx);
          const res = validateSpec(spec, ctx);
          if (!res.ok) throw new Error(`${tier} s${s} n${n}: ${res.errors.join(", ")}`);
          specs.push(spec);

          // plafonds (redondants avec validateSpec, mais explicites)
          expect(spec.spriteSize).toBe(SPRITE_SIZE);
          if (spec.layout === "grid") expect(spec.params.gridSize!).toBeLessThanOrEqual(8);
          if (spec.layout === "pile") expect(spec.params.count!).toBeLessThanOrEqual(160);
          if (spec.layout === "swarm") expect(spec.params.speed!).toBeLessThanOrEqual(0.6);
          if (spec.layout === "scroll") expect(spec.params.speed!).toBeLessThanOrEqual(1.6);

          // calendrier
          expect(n >= LAYOUT_INTRO[spec.layout]).toBe(true);
          if (spec.rule in RULE_INTRO) expect(n).toBeGreaterThanOrEqual(RULE_INTRO[spec.rule as keyof typeof RULE_INTRO]);
          if (spec.rule === "goldRush") expect(isGoldRushSlot(n)).toBe(true);
          if (spec.modifiers.includes("flashlight")) expect(n).toBeGreaterThanOrEqual(FLASHLIGHT_INTRO);

          // variété : pas 3 fois de suite (sauf niveaux 1-3 où seule la grille existe)
          if (n >= 4) {
            const [a, b, c] = specs.slice(-3).map((x) => x.layout);
            expect(a === b && b === c).toBe(false);
          }
          // recherché différent des 2 précédents
          for (const prev of specs.slice(-3, -1)) expect(prev.wanted.name).not.toBe(spec.wanted.name);
        }

        // mécanique seule à son niveau d'intro
        for (const [layout, at] of Object.entries(LAYOUT_INTRO)) {
          if (at === 1) continue;
          const sp = specs[at - 1];
          expect([sp.layout, sp.rule, sp.modifiers.length]).toEqual([layout, "classic", 0]);
        }
        for (const [rule, at] of Object.entries(RULE_INTRO)) {
          const sp = specs[at - 1];
          expect([sp.layout, sp.rule, sp.modifiers.length]).toEqual(["grid", rule, 0]);
        }
        const fl = specs[FLASHLIGHT_INTRO - 1];
        expect([fl.layout, fl.rule, fl.modifiers]).toEqual(["grid", "classic", ["flashlight"]]);
      }
    }
  });

  it("allowedRules: ['classic'] ⇒ uniquement classic", () => {
    const ctx = ctxOf(99, "normal", { allowedRules: ["classic"], allowedModifiers: [] });
    for (let n = 1; n <= 300; n++) {
      const spec = generateLevel(n, ctx);
      expect(spec.rule).toBe("classic");
      expect(spec.modifiers).toEqual([]);
      expect(validateSpec(spec, ctx).ok).toBe(true);
    }
  });

  it("oddOneOut et findAll respectent leurs règles de leurres", () => {
    const ctx = ctxOf(5, "normal");
    let seen = 0;
    for (let n = 1; n <= 300; n++) {
      const spec = generateLevel(n, ctx);
      if (spec.rule === "oddOneOut") {
        seen++;
        expect(spec.decoys.every((d) => d.name === spec.wanted.name)).toBe(true);
      } else expect(spec.decoys.some((d) => d.name === spec.wanted.name)).toBe(false);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("1000 premiers niveaux en moins de 500 ms", () => {
    const ctx = ctxOf(2024, "expert");
    const t0 = performance.now();
    for (let n = 1; n <= 1000; n++) generateLevel(n, ctx);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe("taille des têtes", () => {
  it("SPRITE_SIZE = 45 (taille d'origine) pour toutes les dispositions et tous les tiers", () => {
    expect(SPRITE_SIZE).toBe(45);
    for (const tier of TIERS) {
      const ctx = ctxOf(hash32("size", tier), tier);
      for (let n = 1; n <= 120; n++) expect(generateLevel(n, ctx).spriteSize).toBe(45);
    }
  });

  it("la grille la plus large tient dans la largeur logique", async () => {
    const { BOARD, LIMITS } = await import("../index");
    expect(LIMITS.grid.max).toBe(8);
    expect(LIMITS.grid.max * SPRITE_SIZE).toBeLessThanOrEqual(BOARD.w);
  });

  it("validateSpec refuse une autre taille de tête", () => {
    const ctx = ctxOf(1, "normal");
    const spec = generateLevel(5, ctx);
    expect(validateSpec({ ...spec, spriteSize: 96 }, ctx).ok).toBe(false);
  });
});

describe("goldRush en grille", () => {
  it("gridSize ≥ 4 dans tous les tiers : les 10 dorés et un peu de foule tiennent", async () => {
    const { targetCount, LIMITS } = await import("../index");
    let seen = 0;
    for (const tier of TIERS) {
      for (let s = 0; s < 40; s++) {
        const ctx = ctxOf(hash32("gold", s), tier);
        for (let n = 1; n <= 200; n++) {
          if (!isGoldRushSlot(n)) continue;
          const spec = generateLevel(n, ctx);
          if (spec.rule !== "goldRush" || spec.layout !== "grid") continue;
          seen++;
          const g = spec.params.gridSize!;
          expect(g).toBeGreaterThanOrEqual(LIMITS.grid.minGoldRush);
          expect(g * g).toBeGreaterThan(targetCount(spec));
          expect(validateSpec(spec, ctx).ok).toBe(true);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("validateSpec refuse un goldRush en grille 3×3", () => {
    const ctx = ctxOf(1, "easy");
    for (let n = 1; n <= 400; n++) {
      const spec = generateLevel(n, ctx);
      if (spec.rule !== "goldRush" || spec.layout !== "grid") continue;
      const bad = { ...spec, params: { ...spec.params, gridSize: 3 } };
      expect(validateSpec(bad, ctx).errors).toContain("goldRush : gridSize < 4");
      return;
    }
    throw new Error("aucun goldRush en grille trouvé");
  });
});
