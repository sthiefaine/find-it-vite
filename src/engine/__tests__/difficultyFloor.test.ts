import { describe, expect, it } from "vitest";
import { difficultyFloor } from "../difficultyFloor";
import type { Layout, Tier } from "../types";
import { generatePlayableLevel } from "../../game/playableLevel";
import { charactersDetails } from "../../helpers/characters";
import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../../components/Game/Grid/layouts";
import type { LevelSpec } from "../types";
import { sceneForIndex } from "../../content/scenes";

const SEEDS = [1, 42, 2026, 777];
const crowdSize = (spec: LevelSpec) => (spec.layout === "grid" ? layoutGrid(spec).cells : spec.layout === "scroll"
  ? layoutScroll(spec).slots : spec.layout === "pile" ? placePile(spec) : placeSwarm(spec)).length;

describe("plancher de difficulté", () => {
  it("monte avec le niveau, plus doucement en Enfant et allégé pour les respirations", () => {
    for (const tier of ["easy", "normal", "expert"] as Tier[]) {
      for (const breather of [false, true]) {
        let previous = difficultyFloor(1, tier, breather);
        for (let index = 2; index <= 300; index++) {
          const floor = difficultyFloor(index, tier, breather);
          for (const key of ["gridSize", "pileCount", "swarmCount", "scrollFill", "extraLines"] as const) {
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
      const pause = difficultyFloor(index, "normal", true);
      for (const key of ["gridSize", "pileCount", "swarmCount", "scrollFill", "extraLines"] as const) {
        expect(easy[key]).toBeLessThanOrEqual(normal[key]);
        expect(pause[key]).toBeLessThanOrEqual(normal[key]);
      }
      if (index > 10) expect(normal.gridSize).toBeGreaterThanOrEqual(6);
      if (index > 20) {
        expect(normal.gridSize).toBeGreaterThanOrEqual(7);
        expect(pause.gridSize).toBeGreaterThanOrEqual(6);
      }
    }
    expect(difficultyFloor(1, "easy").gridSize).toBe(3);
    expect(difficultyFloor(24, "easy").gridSize).toBeLessThan(difficultyFloor(24, "normal").gridSize);
    expect(difficultyFloor(60, "normal").fullGrid).toBe(true);
    expect(difficultyFloor(60, "easy").fullGrid).toBe(false);
  });

  it("n'offre plus de petite grille après le niveau 15 et respecte le plancher dans chaque disposition", () => {
    for (const tier of ["easy", "normal", "expert"] as Tier[]) {
      for (const seed of SEEDS) {
        for (let index = 1; index <= 200; index++) {
          const spec = generatePlayableLevel(index, { seed, tier, pool: charactersDetails });
          const floor = difficultyFloor(index, tier, sceneForIndex(index).breather);
          const p = spec.params;
          if (spec.layout === "grid" && !p.fullGrid) {
            expect(p.gridSize!, `${tier} #${index}`).toBeGreaterThanOrEqual(floor.gridSize);
            if (tier !== "easy" && index > 15) expect(p.gridSize!, `#${index} seed ${seed}`).toBeGreaterThan(4);
            if (tier !== "easy" && index > 20) expect(p.gridSize!).toBeGreaterThanOrEqual(6);
          }
          if (spec.layout === "pile") expect(p.count!).toBeGreaterThanOrEqual(floor.pileCount);
          if (spec.layout === "swarm") expect(p.count!).toBeGreaterThanOrEqual(floor.swarmCount);
          if (spec.layout === "scroll") {
            expect(p.extraLines!).toBeGreaterThanOrEqual(floor.extraLines);
            expect(p.scrollFill!).toBeGreaterThanOrEqual(floor.scrollFill - 1e-9);
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
            const spec = generatePlayableLevel(index, { seed, tier, pool: charactersDetails });
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
