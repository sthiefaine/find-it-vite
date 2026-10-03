import { describe, expect, it } from "vitest";
import { charactersDetails } from "../../helpers/characters";
import { generateLevel, GOLD_RUSH_TARGETS } from "../../engine";
import type { LevelSpec, Rule } from "../../engine";
import { isLevelComplete, newMechanics, resolveTap, tickClock } from "../session";

const base = generateLevel(1, { seed: 123, tier: "normal", pool: charactersDetails });
const specOf = (rule: Rule, extra: Partial<LevelSpec> = {}): LevelSpec => ({
  ...base,
  rule,
  findCount: rule === "findAll" ? 3 : 1,
  ...extra,
});

describe("resolveTap", () => {
  it("classic : la cible finit le niveau et rapporte le temps de récompense", () => {
    const spec = specOf("classic");
    const r = resolveTap(spec, [], { id: 4, isWanted: true });
    expect(r).toEqual({
      kind: "target",
      foundIds: [4],
      points: 1,
      timeDelta: spec.rewardS,
      levelDone: true,
      golden: false,
    });
  });

  it("findAll : +1 par cible, temps gagné seulement sur la dernière", () => {
    const spec = specOf("findAll");
    let found: number[] = [];
    const results = [7, 2, 9].map((id) => {
      const r = resolveTap(spec, found, { id, isWanted: true });
      if (r.kind === "target") found = r.foundIds;
      return r;
    });
    expect(results.map((r) => r.kind === "target" && r.levelDone)).toEqual([false, false, true]);
    expect(results.map((r) => r.kind === "target" && r.timeDelta)).toEqual([0, 0, spec.rewardS]);
    expect(results.every((r) => r.kind === "target" && r.points === 1)).toBe(true);
    expect(found).toEqual([7, 2, 9]);
  });

  it("une cible déjà trouvée est ignorée", () => {
    const spec = specOf("findAll");
    expect(resolveTap(spec, [7], { id: 7, isWanted: true })).toEqual({ kind: "ignored" });
  });

  it("une erreur coûte penaltyS, sauf pendant une découverte", () => {
    const spec = specOf("classic");
    expect(resolveTap(spec, [], { id: 1, isWanted: false })).toEqual({
      kind: "miss",
      timeDelta: -spec.penaltyS,
      countsAsMiss: true,
      blink: true,
    });
    const discovery = resolveTap(spec, [], { id: 1, isWanted: false }, { isDiscovery: true });
    expect(discovery).toMatchObject({ kind: "miss", timeDelta: 0, countsAsMiss: true });
  });

  it("goldRush : +1 par cible dorée, jamais de pénalité ni de temps gagné", () => {
    const spec = specOf("goldRush", { durationS: 8 });
    const hit = resolveTap(spec, [], { id: 3, isWanted: true });
    expect(hit).toMatchObject({ kind: "target", points: 1, timeDelta: 0, levelDone: false, golden: true });
    expect(resolveTap(spec, [], { id: 5, isWanted: false })).toEqual({
      kind: "miss",
      timeDelta: 0,
      countsAsMiss: false,
      blink: false,
    });
  });

  it("goldRush : la dernière cible dorée termine le niveau tout de suite", () => {
    const spec = specOf("goldRush", { durationS: 8 });
    const found = Array.from({ length: GOLD_RUSH_TARGETS - 1 }, (_, i) => i);
    const last = resolveTap(spec, found, { id: 99, isWanted: true });
    expect(last).toMatchObject({ kind: "target", levelDone: true, timeDelta: 0 });
  });
});

describe("isLevelComplete", () => {
  it("suit le nombre de cibles de la règle", () => {
    expect(isLevelComplete(specOf("classic"), 1)).toBe(true);
    expect(isLevelComplete(specOf("findAll"), 2)).toBe(false);
    expect(isLevelComplete(specOf("findAll"), 3)).toBe(true);
    expect(isLevelComplete(specOf("goldRush"), GOLD_RUSH_TARGETS - 1)).toBe(false);
    expect(isLevelComplete(specOf("goldRush"), GOLD_RUSH_TARGETS)).toBe(true);
  });
});

describe("newMechanics", () => {
  it("ne garde que les mécaniques jamais vues", () => {
    expect(newMechanics(["layout:grid", "rule:findAll"], ["layout:grid"])).toEqual(["rule:findAll"]);
    expect(newMechanics(["layout:grid"], ["layout:grid"])).toEqual([]);
  });
});

describe("tickClock", () => {
  it("décompte les secondes entières sans perdre la fraction", () => {
    let acc = 0;
    let total = 0;
    for (const delta of [400, 400, 400, 900, 100, -50]) {
      const r = tickClock(acc, delta);
      acc = r.accMs;
      total += r.seconds;
    }
    expect(total).toBe(2);
    expect(acc).toBe(200);
  });
});
