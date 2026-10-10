import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMatchDistractions, distractionAt, matchObstacleAssets } from "../distractions";
import { multiplayerLevel } from "../multiplayerRules";

describe("perturbations des duels", () => {
  it("laisse les deux premières manches libres puis partage la même chronologie", () => {
    for (const level of [1, 2]) {
      const spec = multiplayerLevel(level, 20, "animaux");
      expect(matchObstacleAssets(spec)).toEqual([]);
      expect(createMatchDistractions(spec)(8)).toEqual([]);
    }
    for (const level of [3, 5, 12, 30]) {
      const spec = multiplayerLevel(level, 20, "animaux");
      const a = createMatchDistractions(spec), b = createMatchDistractions(spec);
      for (let elapsed = 0; elapsed < 60; elapsed += .25) expect(a(elapsed)).toEqual(b(elapsed));
      a(55); a(12);
      expect(a(6)).toEqual(b(6));
      expect(a(0)).toEqual([]);
      expect(a(4.6).length).toBeGreaterThan(0);
    }
  });
  it("varie les passages, les feuilles et la brume sans masquer tout le plateau", () => {
    const spec = multiplayerLevel(12, 33, "animaux");
    const frames = createMatchDistractions(spec);
    const kinds = new Set<string>();
    let visible = 0;
    for (let time = 0; time < 60; time += .1) {
      const items = frames(time);
      items.forEach(item => { kinds.add(item.kind); expect(item.width).toBeLessThanOrEqual(138); });
      if (items.length) visible++;
      expect(items.length).toBeLessThanOrEqual(5);
    }
    expect([...kinds].sort()).toEqual(["leaves", "mist", "passer"]);
    expect(visible).toBeLessThan(400); // des fenêtres dégagées entre les passages
    expect(matchObstacleAssets(spec).every(path => existsSync(`public${path}`))).toBe(true);
  });
  it("reste jouable sur les drapeaux sans dépendre d’assets de planètes, et rend les clics masqués neutres", () => {
    const spec = multiplayerLevel(5, 33, "drapeaux");
    expect(matchObstacleAssets(spec)).toEqual([]);
    const items = createMatchDistractions(spec)(4.6);
    expect(items.every(item => item.kind === "mist")).toBe(true);
    expect(distractionAt({ x: items[0].x, y: items[0].y }, items)).toBe(true);
    expect(distractionAt({ x: -500, y: -500 }, items)).toBe(false);
  });
});
