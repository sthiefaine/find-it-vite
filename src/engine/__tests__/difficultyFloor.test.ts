import { describe, expect, it } from "vitest";
import { difficultyFloor } from "../difficultyFloor";
import type { Layout, Tier } from "../types";
import { generatePlayableLevel } from "../../game/playableLevel";
import { charactersDetails } from "../../helpers/characters";
import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../../components/Game/Grid/layouts";
import type { LevelSpec } from "../types";
import { sceneForIndex } from "../../content/scenes";
import { LIMITS, validateSpec } from "../validate";
import { levelTarget } from "../../game/modes";
import { poolOfStep, stepTarget } from "../../game/adventureRun";

const SEEDS = [1, 42, 2026, 777];
const FLOOR_PARAMETERS = ["gridSize", "pileCount", "swarmCount", "scrollSpeed", "swarmSpeed", "scrollFill", "extraLines"] as const;
const crowdSize = (spec: LevelSpec) => (spec.layout === "grid" ? layoutGrid(spec).cells : spec.layout === "scroll"
  ? layoutScroll(spec).slots : spec.layout === "pile" ? placePile(spec) : placeSwarm(spec)).length;

describe("plancher de difficulté", () => {
  it("monte avec le niveau, plus doucement en Enfant et allégé pour les respirations", () => {
    for (const tier of ["easy", "normal", "expert"] as Tier[]) {
      for (const breather of [false, true]) {
        let previous = difficultyFloor(1, tier, breather);
        for (let index = 2; index <= 300; index++) {
          const floor = difficultyFloor(index, tier, breather);
          for (const key of FLOOR_PARAMETERS) {
            expect(floor[key], `${tier} ${key} #${index}`).toBeGreaterThanOrEqual(previous[key]);
          }
          if (previous.fullGrid) expect(floor.fullGrid).toBe(true);
          previous = floor;
        }
      }
    }
    for (let index = 1; index <= 200; index++) {
      const normal = difficultyFloor(index, "normal");
      const easy = difficultyFloor(index, "easy");
      const expert = difficultyFloor(index, "expert");
      const pause = difficultyFloor(index, "normal", true);
      for (const key of FLOOR_PARAMETERS) {
        expect(easy[key]).toBeLessThanOrEqual(normal[key]);
        expect(normal[key]).toBeLessThanOrEqual(expert[key]);
        expect(pause[key]).toBeLessThanOrEqual(normal[key]);
      }
      if (index > 10) expect(normal.gridSize).toBeGreaterThanOrEqual(6);
      if (index > 20) {
        expect(normal.gridSize).toBeGreaterThanOrEqual(7);
        expect(pause.gridSize).toBeGreaterThanOrEqual(7);
      }
    }
    expect(difficultyFloor(1, "easy").gridSize).toBe(3);
    expect(difficultyFloor(24, "easy").gridSize).toBeLessThan(difficultyFloor(24, "normal").gridSize);
    expect(difficultyFloor(60, "normal").fullGrid).toBe(true);
    expect(difficultyFloor(60, "easy").fullGrid).toBe(false);
  });

  it("n'offre plus de petite grille dès le niveau 15 et respecte le plancher dans chaque disposition", () => {
    for (const tier of ["easy", "normal", "expert"] as Tier[]) {
      for (const seed of SEEDS) {
        for (let index = 1; index <= 200; index++) {
          const spec = generatePlayableLevel(index, { seed, tier, pool: charactersDetails });
          const floor = difficultyFloor(index, tier, sceneForIndex(index).breather);
          const p = spec.params;
          if (spec.layout === "grid" && !p.fullGrid) {
            expect(p.gridSize!, `${tier} #${index}`).toBeGreaterThanOrEqual(floor.gridSize);
            if (tier !== "easy" && index >= 15) expect(p.gridSize!, `#${index} seed ${seed}`).toBeGreaterThan(4);
            if (tier !== "easy" && index > 20) expect(p.gridSize!).toBeGreaterThanOrEqual(7);
          }
          if (spec.layout === "pile") expect(p.count!).toBeGreaterThanOrEqual(floor.pileCount);
          if (spec.layout === "swarm") {
            expect(p.count!).toBeGreaterThanOrEqual(floor.swarmCount);
            expect(p.speed!).toBeGreaterThanOrEqual(floor.swarmSpeed);
          }
          if (spec.layout === "scroll") {
            // L'absence d'accessoire doit être prouvée sur chaque portrait :
            // cette variante retire les rangées qui pourraient cacher une tenue.
            if (spec.crowdVariant?.dress === "bare") {
              expect(p.extraLines).toBe(0);
              expect(p.edgeRows).toBeUndefined();
              expect(p.movement).not.toBe("wave");
            } else expect(p.extraLines!).toBeGreaterThanOrEqual(floor.extraLines);
            expect(p.scrollFill!).toBeGreaterThanOrEqual(floor.scrollFill - 1e-9);
            expect(p.speed!).toBeGreaterThanOrEqual(floor.scrollSpeed);
          }
        }
      }
    }
  });

  it("garde de vraies foules pendant les respirations 15, 25 et 35", () => {
    for (const seed of SEEDS) {
      for (const tier of ["normal", "expert"] as const) {
        for (const [index, minimumSide] of [[15, 5], [25, 7], [35, 7]]) {
          const spec = generatePlayableLevel(index, { seed, tier, pool: charactersDetails });
          const cells = layoutGrid(spec).cells;
          expect(spec.layout).toBe("grid");
          expect(cells.length).toBeGreaterThanOrEqual(minimumSide ** 2);
          expect(cells.filter((animal) => animal.isWanted)).toHaveLength(1);
          expect(spec.scene?.foliage).toBeUndefined();
          expect(spec.scene?.seagulls).toBe(false);
          expect(spec.accessories).toBeUndefined();
          expect(spec.modifiers).toEqual([]);
        }
      }
    }
  });

  it("fait monter les vitesses sans accélérer les premières découvertes ni dépasser les limites", () => {
    for (const tier of ["easy", "normal", "expert"] as const) {
      const context = { seed: 42, tier, pool: charactersDetails };
      // Une même scène reprise plus tard ne retrouve pas sa vitesse de découverte.
      const firstScroll = generatePlayableLevel(42, context);
      const laterScroll = generatePlayableLevel(58, context);
      expect(firstScroll.scene?.id).toBe(laterScroll.scene?.id);
      expect(laterScroll.params.speed).toBeGreaterThanOrEqual(firstScroll.params.speed!);
      const scrollLimit = tier === "easy" ? LIMITS.scroll.speedMaxEasy : LIMITS.scroll.speedMax;
      const swarmLimit = tier === "easy" ? LIMITS.swarm.speedMaxEasy : LIMITS.swarm.speedMax;
      const finalFloor = difficultyFloor(4000, tier);
      expect(finalFloor.scrollSpeed).toBe(scrollLimit);
      expect(finalFloor.swarmSpeed).toBe(swarmLimit);
      for (let index = 1; index <= 300; index++) {
        const spec = generatePlayableLevel(index, context);
        if (spec.layout !== "scroll" && spec.layout !== "swarm") continue;
        expect(spec.params.speed).toBeLessThanOrEqual(spec.layout === "scroll" ? scrollLimit : swarmLimit);
        expect(validateSpec(spec, context).errors).toEqual([]);
      }
    }
    expect(generatePlayableLevel(3, { seed: 42, tier: "normal", pool: charactersDetails }).params.speed).toBe(.55);
    expect(generatePlayableLevel(11, { seed: 42, tier: "normal", pool: charactersDetails }).params.speed).toBe(.3);
  });

  it("conserve la progression à 25/26 et aux changements de monde dans tous les modes", () => {
    for (const index of [15, 20, 21, 25, 26, 35, 40, 41, 56, 57, 100, 200, 4000]) {
      for (const tier of ["easy", "normal", "expert"] as const) {
        for (const seed of SEEDS) {
          const expected = generatePlayableLevel(index, { seed, tier, pool: charactersDetails }, { crowdVariants: false });
          const targets = [levelTarget("endless", seed, index), levelTarget("daily", seed, index),
            ...[1, 2, 3, 4, 5].map((avis) => stepTarget(index, avis))];
          for (const target of targets) {
            const context = { seed: target.seed, tier, pool: poolOfStep(index) };
            const spec = generatePlayableLevel(target.index, context, { crowdVariants: false });
            expect(spec.index).toBe(index);
            expect(spec.layout).toBe(expected.layout);
            expect(spec.params).toEqual(expected.params);
            expect(validateSpec(spec, context).errors).toEqual([]);
          }
        }
      }
    }
  });

  it("fait croître la foule en moyenne par tranche de dix niveaux", () => {
    for (const tier of ["easy", "normal"] as Tier[]) {
      // Moyennes par tranche, toutes dispositions confondues et par disposition :
      // le mélange des dispositions d'une tranche suit le cycle des scènes, la foule
      // d'une même disposition ne doit jamais diminuer d'une tranche à l'autre.
      const totals: number[] = [];
      const byLayout = new Map<Layout, number[]>();
      for (let decade = 0; decade < 20; decade++) {
        let sum = 0;
        let n = 0;
        const sums = new Map<Layout, [number, number]>();
        for (const seed of SEEDS) {
          for (let index = decade * 10 + 1; index <= decade * 10 + 10; index++) {
            // Mesure le moteur de densité ; les variantes de tenue ajoutent
            // une difficulté visuelle et peuvent espacer volontairement les têtes.
            const spec = generatePlayableLevel(index, { seed, tier, pool: charactersDetails }, { crowdVariants: false });
            const size = crowdSize(spec);
            sum += size;
            n++;
            if (sceneForIndex(index).breather) continue;
            const [s, c] = sums.get(spec.layout) ?? [0, 0];
            sums.set(spec.layout, [s + size, c + 1]);
          }
        }
        totals.push(sum / n);
        for (const [layout, [s, c]] of sums) byLayout.set(layout, [...(byLayout.get(layout) ?? []), s / c]);
      }
      // La campagne (1–40) monte strictement ; au-delà, la moyenne ne redescend jamais
      // sous celle des tranches de la campagne.
      for (let decade = 1; decade < 4; decade++) expect(totals[decade], `${tier} tranche ${decade}`).toBeGreaterThan(totals[decade - 1]);
      for (let decade = 4; decade < 20; decade++) expect(totals[decade]).toBeGreaterThan(totals[3]);
      for (const [layout, averages] of byLayout) {
        // Hors respirations ; 3 % de marge pour le hasard des graines.
        averages.reduce((best, average, decade) => {
          expect(average, `${tier} ${layout} tranche ${decade}`).toBeGreaterThanOrEqual(best * .97);
          return Math.max(best, average);
        }, 0);
      }
      const half = (from: number) => totals.slice(from, from + 8).reduce((a, b) => a + b) / 8;
      expect(half(12)).toBeGreaterThanOrEqual(half(4) * .99);
    }
  });
});
