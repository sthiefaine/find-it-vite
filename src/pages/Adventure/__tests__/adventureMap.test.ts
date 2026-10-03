import { describe, expect, it } from "vitest";
import { levelUrl, nextLevel, nodeX, starsMissing, worldStars } from "../adventureMap";
import { LEVELS_PER_WORLD, WORLDS } from "../../../content/worlds";

const save = (stars: Record<string, number>) => ({ adventure: { stars } });

describe("nextLevel", () => {
  it("commence au niveau 1 du premier monde", () => {
    expect(nextLevel(save({}))).toEqual({ worldId: "animaux", level: 1 });
  });

  it("propose le premier niveau débloqué sans étoile", () => {
    expect(nextLevel(save({ "animaux:1": 3, "animaux:2": 1 }))).toEqual({ worldId: "animaux", level: 3 });
  });

  it("passe au monde suivant quand il s'ouvre", () => {
    const stars: Record<string, number> = {};
    for (let l = 1; l <= LEVELS_PER_WORLD; l++) stars[`animaux:${l}`] = 2;
    expect(nextLevel(save(stars))).toEqual({ worldId: WORLDS[1].id, level: 1 });
  });

  it("garde le dernier niveau si le monde suivant est fermé", () => {
    const stars: Record<string, number> = {};
    for (let l = 1; l <= LEVELS_PER_WORLD; l++) stars[`animaux:${l}`] = 1;
    // 10★ : le monde 2 demande plus
    expect(WORLDS[1].unlockStars).toBeGreaterThan(10);
    expect(nextLevel(save(stars))).toEqual({ worldId: "animaux", level: LEVELS_PER_WORLD });
  });
});

describe("autres calculs", () => {
  it("étoiles manquantes et étoiles d'un monde", () => {
    const s = save({ "animaux:1": 3, "animaux:2": 2 });
    expect(starsMissing(s, WORLDS[0])).toBe(0);
    expect(starsMissing(s, WORLDS[1])).toBe(WORLDS[1].unlockStars - 5);
    expect(worldStars(s, WORLDS[0])).toBe(5);
  });

  it("le chemin reste dans l'écran", () => {
    for (let l = 1; l <= LEVELS_PER_WORLD; l++) {
      expect(nodeX(l)).toBeGreaterThanOrEqual(15);
      expect(nodeX(l)).toBeLessThanOrEqual(85);
    }
  });

  it("url de partie", () => {
    expect(levelUrl("ocean", 3)).toBe("/game?mode=adventure&world=ocean&level=3");
  });
});
