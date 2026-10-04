import { describe, expect, it } from "vitest";
import { generateLevel } from "../../engine";
import { allCharacters, getWorld, LEVELS_PER_WORLD, WORLDS } from "../../content/worlds";
import { defaultSave } from "../../save/schema";
import {
  entersNewPhase,
  furthestStep,
  globalStep,
  MIX_PHASE,
  poolOfStep,
  runSummary,
  STEP_GOAL,
  stepInfo,
  stepStars,
  stepTarget,
  welcomeText,
  WORLD_STEPS,
} from "../adventureRun";
import { missionSeed, missionSubSeeds } from "../modes";

describe("étapes globales", () => {
  it("monde + étape ↔ étape globale", () => {
    expect(globalStep("animaux", 1)).toBe(1);
    expect(globalStep("animaux", 10)).toBe(10);
    expect(globalStep("ocean", 1)).toBe(11);
    expect(globalStep("espace", 10)).toBe(WORLD_STEPS);
    for (let g = 1; g <= WORLD_STEPS; g++) {
      const info = stepInfo(g);
      expect(globalStep(info.worldId!, info.level)).toBe(g);
    }
  });

  it("l'index moteur suit startIndex + étape - 1, puis continue de monter", () => {
    expect(stepInfo(3)).toMatchObject({ worldId: "animaux", level: 3, index: 3 });
    const ocean = getWorld("ocean")!;
    expect(stepInfo(14)).toMatchObject({ worldId: "ocean", level: 4, index: ocean.startIndex + 3 });
    expect(stepInfo(WORLD_STEPS + 1)).toMatchObject({ phase: MIX_PHASE, worldId: null, index: WORLD_STEPS + 1 });
    expect(stepInfo(200).index).toBe(200);
  });

  it("change de monde après l'étape 10, puis passe au Grand Mélange après l'Espace", () => {
    expect(entersNewPhase(9)).toBe(false);
    expect(entersNewPhase(10)).toBe(true);
    expect(stepInfo(11).phase).toBe("ocean");
    expect(entersNewPhase(WORLD_STEPS)).toBe(true);
    expect(stepInfo(WORLD_STEPS + 1).phase).toBe(MIX_PHASE);
    expect(entersNewPhase(WORLD_STEPS + 1)).toBe(false);
    expect(entersNewPhase(WORLD_STEPS + 10)).toBe(false);
  });

  it("pool : celui du monde, puis tous les persos", () => {
    expect(poolOfStep(1)).toBe(WORLDS[0].characters);
    expect(poolOfStep(25)).toBe(getWorld("dinos")!.characters);
    expect(poolOfStep(WORLD_STEPS + 3)).toHaveLength(allCharacters().length);
  });

  it("bandeaux de bienvenue", () => {
    expect(welcomeText("ocean")).toBe("Bienvenue dans l'Océan ! 🌊");
    expect(welcomeText(MIX_PHASE)).toContain("Grand Mélange");
  });
});

describe("stepTarget", () => {
  it("même index pour les 5 avis, une graine par avis, 5 recherchés différents", () => {
    for (const g of [1, 7, 11, 23, 40, 50, 51, 77]) {
      const pool = poolOfStep(g);
      const targets = [1, 2, 3, 4, 5].map((k) => stepTarget(g, k));
      expect(new Set(targets.map((t) => t.index))).toEqual(new Set([stepInfo(g).index]));
      expect(new Set(targets.map((t) => t.seed)).size).toBe(STEP_GOAL);
      const names = targets.map((t) => generateLevel(t.index, { seed: t.seed, tier: "normal", pool }).wanted.name);
      expect(new Set(names).size, `étape ${g}`).toBe(STEP_GOAL);
    }
  });

  it("garde les sous-graines des missions d'avant (mêmes niveaux qu'avant)", () => {
    const w = getWorld("ocean")!;
    const seeds = missionSubSeeds(missionSeed("ocean", 2), w.startIndex + 1, w.characters);
    expect([1, 2, 3, 4, 5].map((k) => stepTarget(12, k).seed)).toEqual(seeds);
  });

  it("le Grand Mélange génère des niveaux valides loin dans la partie", () => {
    for (const g of [51, 60, 99, 150]) {
      const t = stepTarget(g, 3);
      expect(() => generateLevel(t.index, { seed: t.seed, tier: "normal", pool: poolOfStep(g) })).not.toThrow();
    }
  });
});

describe("stepStars", () => {
  it("3★ ≤ 25 s, 2★ ≤ 40 s, 1★ au-delà", () => {
    expect(stepStars(0)).toBe(3);
    expect(stepStars(25_000)).toBe(3);
    expect(stepStars(25_001)).toBe(2);
    expect(stepStars(40_000)).toBe(2);
    expect(stepStars(40_001)).toBe(1);
    expect(stepStars(10 * 60_000)).toBe(1);
  });

  it("bilan de partie", () => {
    expect(runSummary([])).toEqual({ cleared: 0, stars: 0 });
    expect(
      runSummary([
        { step: 1, worldId: "animaux", level: 1, stars: 3 },
        { step: 2, worldId: "animaux", level: 2, stars: 1 },
      ])
    ).toEqual({ cleared: 2, stars: 4 });
  });
});

describe("furthestStep", () => {
  it("l'étape la plus avancée débloquée", () => {
    expect(furthestStep(defaultSave())).toEqual({ worldId: "animaux", level: 1 });
    const stars: Record<string, number> = {};
    for (let l = 1; l <= LEVELS_PER_WORLD; l++) stars[`animaux:${l}`] = 1;
    stars["ocean:1"] = 2;
    expect(furthestStep({ adventure: { stars } })).toEqual({ worldId: "ocean", level: 2 });
  });
});
