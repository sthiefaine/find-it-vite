import { describe, expect, it } from "vitest";
import { defaultSave } from "../../save/schema";
import type { Save } from "../../save/schema";
import {
  FRAMES,
  isFrameUnlocked,
  isLevelUnlocked,
  isWorldUnlocked,
  masteryOf,
  starsFor,
  todayISO,
  totalStars,
} from "../progress";
import { FUN_WORLDS, getWorld, WORLDS } from "../worlds";

const withStars = (stars: Record<string, number>): Save => ({ ...defaultSave(), adventure: { stars } });

// n niveaux d'animaux à 3★ (et le reste à 0)
const animals3 = (n: number) =>
  withStars(Object.fromEntries(Array.from({ length: n }, (_, i) => [`animaux:${i + 1}`, 3])));

describe("progress", () => {
  it("totalStars et starsFor", () => {
    const save = withStars({ "animaux:1": 3, "animaux:2": 1, "ocean:1": 2 });
    expect(totalStars(save)).toBe(6);
    expect(totalStars(defaultSave())).toBe(0);
    expect(starsFor(save, "ocean", 1)).toBe(2);
    expect(starsFor(save, "ocean", 2)).toBe(0);
  });

  it("isWorldUnlocked : premier monde ouvert, puis étape 20 du monde précédent franchie", () => {
    const ocean = getWorld("ocean")!;
    expect(isWorldUnlocked(defaultSave(), WORLDS[0])).toBe(true);
    expect(isWorldUnlocked(defaultSave(), ocean)).toBe(false);
    // beaucoup d'étoiles ne suffisent plus
    expect(isWorldUnlocked(animals3(9), ocean)).toBe(false);
    expect(isWorldUnlocked(withStars({ "animaux:20": 1 }), ocean)).toBe(true);
    expect(isWorldUnlocked(withStars({ "animaux:20": 0 }), ocean)).toBe(false);
    for (const experimental of FUN_WORLDS) expect(isWorldUnlocked(withStars({ "ocean:10": 1 }), experimental)).toBe(false);
  });

  it("les déblocages historiques restent lisibles sans réactiver les thèmes fun", () => {
    const save: Save = { ...defaultSave(), adventure: { stars: {}, unlocked: ["ocean", "dinos"] } };
    expect(isWorldUnlocked(save, getWorld("ocean")!)).toBe(true);
    expect(isLevelUnlocked(save, "ocean", 1)).toBe(true);
    expect(isLevelUnlocked(save, "ocean", 2)).toBe(false);
    expect(isLevelUnlocked(save, "dinos", 1)).toBe(false);
    expect(isLevelUnlocked(save, "dinos", 2)).toBe(false);
  });

  it("isLevelUnlocked : étape 1 d'un monde ouvert, ou précédente à 1★", () => {
    const save = withStars({ "animaux:1": 1, "animaux:2": 0 });
    expect(isLevelUnlocked(defaultSave(), "animaux", 1)).toBe(true);
    expect(isLevelUnlocked(defaultSave(), "animaux", 2)).toBe(false);
    expect(isLevelUnlocked(save, "animaux", 2)).toBe(true);
    expect(isLevelUnlocked(save, "animaux", 3)).toBe(false); // étape 2 jouée à 0★
    expect(isLevelUnlocked(save, "ocean", 1)).toBe(false);
    expect(isLevelUnlocked(withStars({ "animaux:20": 2 }), "ocean", 1)).toBe(true);
    for (const level of [0, 21, 1.5]) expect(isLevelUnlocked(save, "animaux", level)).toBe(false);
    expect(isLevelUnlocked(save, "inconnu", 1)).toBe(false);
  });

  it("masteryOf : découvert à 1, médailles à 25 / 50 / 100 / 250", () => {
    const cases: [number, string][] = [
      [0, "none"], [1, "caught"], [3, "caught"], [6, "caught"], [10, "caught"], [24, "caught"],
      [25, "bronze"], [49, "bronze"], [50, "silver"], [99, "silver"],
      [100, "gold"], [249, "gold"], [250, "platinum"], [1000, "platinum"],
    ];
    for (const [n, m] of cases) expect(masteryOf(n)).toBe(m);
  });

  it("cadres : classic 0, neon 10, gold 25, ice 40", () => {
    expect(FRAMES.map((f) => [f.id, f.unlockStars])).toEqual([
      ["classic", 0], ["neon", 10], ["gold", 25], ["ice", 40],
    ]);
    expect(isFrameUnlocked(defaultSave(), "classic")).toBe(true);
    expect(isFrameUnlocked(defaultSave(), "neon")).toBe(false);
    expect(isFrameUnlocked(withStars({ "animaux:1": 3, "animaux:2": 3, "animaux:3": 3, "animaux:4": 1 }), "neon")).toBe(true);
    expect(isFrameUnlocked(animals3(8), "gold")).toBe(false); // 24★
    expect(isFrameUnlocked(animals3(9), "gold")).toBe(true);
  });

  it("todayISO donne la date locale AAAA-MM-JJ", () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
