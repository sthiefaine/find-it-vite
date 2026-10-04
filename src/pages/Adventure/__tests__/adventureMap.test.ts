import { describe, expect, it } from "vitest";
import { levelUrl, nextLevel, nodeX, unlockHint, worldStars } from "../adventureMap";
import { LEVELS_PER_WORLD, WORLDS } from "../../../content/worlds";

const save = (stars: Record<string, number>, unlocked: string[] = []) => ({ adventure: { stars, unlocked } });

describe("nextLevel (Continuer l'aventure)", () => {
  it("commence à l'étape 1 du premier monde", () => {
    expect(nextLevel(save({}))).toEqual({ worldId: "animaux", level: 1 });
  });

  it("repart de l'étape la plus avancée atteinte", () => {
    expect(nextLevel(save({ "animaux:1": 3, "animaux:2": 1 }))).toEqual({ worldId: "animaux", level: 3 });
  });

  it("passe au monde suivant une fois l'étape 10 franchie, quelles que soient les étoiles", () => {
    const stars: Record<string, number> = {};
    for (let l = 1; l <= LEVELS_PER_WORLD; l++) stars[`animaux:${l}`] = 1;
    expect(nextLevel(save(stars))).toEqual({ worldId: WORLDS[1].id, level: 1 });
  });

  it("tout fini : la dernière étape de l'Espace (puis le Grand Mélange en jeu)", () => {
    const stars: Record<string, number> = {};
    for (const w of WORLDS) for (let l = 1; l <= LEVELS_PER_WORLD; l++) stars[`${w.id}:${l}`] = 2;
    expect(nextLevel(save(stars))).toEqual({ worldId: "espace", level: LEVELS_PER_WORLD });
  });

  it("monde gardé ouvert par l'ancienne règle", () => {
    expect(nextLevel(save({ "animaux:1": 3 }, ["ocean"]))).toEqual({ worldId: "ocean", level: 1 });
  });
});

describe("autres calculs", () => {
  it("indice d'un monde fermé et étoiles d'un monde", () => {
    const s = save({ "animaux:1": 3, "animaux:2": 2 });
    expect(unlockHint(WORLDS[1])).toBe("Finis 🦁 Animaux 10");
    expect(unlockHint(WORLDS[0])).toBe("");
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
