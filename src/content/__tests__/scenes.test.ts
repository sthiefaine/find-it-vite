import { describe, expect, it } from "vitest";
import { SCENES, sceneForIndex } from "../scenes";
import { LEVELS_PER_WORLD, WORLDS } from "../worlds";

describe("campagne de scènes", () => {
  it("donne une scène nommée à chacune des 40 étapes de la carte", () => {
    expect(SCENES).toHaveLength(40);
    expect(new Set(SCENES.map((scene) => scene.id)).size).toBe(40);
    expect(new Set(SCENES.map((scene) => scene.name)).size).toBe(40);
    for (const world of WORLDS) {
      for (let level = 1; level <= LEVELS_PER_WORLD; level++) {
        const scene = sceneForIndex(world.startIndex + level - 1);
        expect(scene.name.length).toBeLessThanOrEqual(20);
        expect(scene.hint.length).toBeGreaterThan(10);
      }
    }
  });

  it("introduit les obstacles seuls, puis ménage des respirations régulières", () => {
    const foliage = SCENES.find((s) => s.foliage)!;
    const birds = SCENES.find((s) => s.seagulls)!;
    expect(foliage.layout).toBe("grid");
    expect(foliage.seagulls).toBe(false);
    expect(birds.layout).toBe("grid");
    expect(birds.foliage).toBeUndefined();
    for (const i of [5, 15, 25, 35]) {
      const pause = sceneForIndex(i);
      expect(pause.breather).toBe(true);
      expect(pause.foliage).toBeUndefined();
      expect(pause.seagulls).toBe(false);
      expect(pause.density).toBeLessThan(.25);
    }
  });

  it("garde les mouvements compatibles avec leur disposition", () => {
    for (const scene of SCENES) {
      if (scene.movement === "wave") expect(scene.layout).toBe("scroll");
      if (scene.movement === "orbit") expect(scene.layout).toBe("swarm");
      if (scene.movement === "stopGo") expect(["scroll", "swarm"]).toContain(scene.layout);
    }
  });

  it("recycle les scènes avancées dans un autre ordre après la campagne", () => {
    const replay = Array.from({ length: 30 }, (_, i) => sceneForIndex(41 + i));
    expect(new Set(replay.map((scene) => scene.id)).size).toBe(30);
    expect(replay).not.toEqual(SCENES.slice(10));
    expect(sceneForIndex(4000)).toEqual(sceneForIndex(4000));
    for (const i of [0, -1, 1.5, Infinity, NaN]) expect(() => sceneForIndex(i)).toThrow();
  });
});
