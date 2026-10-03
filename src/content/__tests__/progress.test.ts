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
import { getWorld, WORLDS } from "../worlds";

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

  it("isWorldUnlocked suit unlockStars", () => {
    const ocean = getWorld("ocean")!;
    expect(isWorldUnlocked(defaultSave(), WORLDS[0])).toBe(true);
    expect(isWorldUnlocked(defaultSave(), ocean)).toBe(false);
    expect(isWorldUnlocked(animals3(3), ocean)).toBe(false); // 9★
    expect(isWorldUnlocked(animals3(4), ocean)).toBe(true); // 12★
    expect(isWorldUnlocked(animals3(4), getWorld("dinos")!)).toBe(false);
  });

  it("isLevelUnlocked : niveau 1 d'un monde ouvert, ou précédent à 1★", () => {
    const save = withStars({ "animaux:1": 1, "animaux:2": 0 });
    expect(isLevelUnlocked(defaultSave(), "animaux", 1)).toBe(true);
    expect(isLevelUnlocked(defaultSave(), "animaux", 2)).toBe(false);
    expect(isLevelUnlocked(save, "animaux", 2)).toBe(true);
    expect(isLevelUnlocked(save, "animaux", 3)).toBe(false); // niveau 2 joué à 0★
    expect(isLevelUnlocked(save, "ocean", 1)).toBe(false);
    expect(isLevelUnlocked(animals3(4), "ocean", 1)).toBe(true);
    for (const level of [0, 11, 1.5]) expect(isLevelUnlocked(save, "animaux", level)).toBe(false);
    expect(isLevelUnlocked(save, "inconnu", 1)).toBe(false);
  });

  it("masteryOf : seuils 1 / 3 / 6 / 10", () => {
    const cases: [number, string][] = [
      [0, "none"], [1, "caught"], [2, "caught"], [3, "bronze"], [5, "bronze"],
      [6, "silver"], [9, "silver"], [10, "gold"], [99, "gold"],
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
