import { describe, expect, it } from "vitest";
import { generateLevel, hash32 } from "../../engine";
import { getWorld } from "../../content/worlds";
import {
  advanceMission,
  dailyShareText,
  levelTarget,
  MISSION_GOAL,
  missionEngineIndex,
  missionSeed,
  missionStars,
  nextMissionUrl,
  nextTime,
  readModeParams,
  subLevelSeed,
} from "../modes";

describe("missionStars", () => {
  it("1★ réussie, 2★ dès 10 s, 3★ dès 20 s, 0 si ratée", () => {
    expect(missionStars(false, 30)).toBe(0);
    expect(missionStars(true, 0)).toBe(1);
    expect(missionStars(true, 9)).toBe(1);
    expect(missionStars(true, 10)).toBe(2);
    expect(missionStars(true, 19)).toBe(2);
    expect(missionStars(true, 20)).toBe(3);
    expect(missionStars(true, 75)).toBe(3);
  });
});

describe("advanceMission", () => {
  it("compte les avis jusqu'à 5", () => {
    let found = 0;
    const done: boolean[] = [];
    for (let i = 0; i < MISSION_GOAL; i++) {
      const r = advanceMission(found);
      found = r.found;
      done.push(r.done);
    }
    expect(found).toBe(5);
    expect(done).toEqual([false, false, false, false, true]);
    expect(advanceMission(5)).toEqual({ found: 5, done: true });
  });
});

describe("graines de mission", () => {
  it("la graine dépend du monde et du niveau", () => {
    expect(missionSeed("ocean", 3)).toBe(hash32("adv", "ocean", 3));
    expect(missionSeed("ocean", 3)).not.toBe(missionSeed("ocean", 4));
    expect(missionSeed("ocean", 3)).not.toBe(missionSeed("dinos", 3));
  });

  it("5 sous-graines différentes, même index moteur", () => {
    const seed = missionSeed("ocean", 1);
    const subs = [1, 2, 3, 4, 5].map((step) => subLevelSeed(seed, step));
    expect(new Set(subs).size).toBe(5);
    expect(subs[0]).toBe(hash32(seed, 0));
    const targets = [1, 2, 3, 4, 5].map((step) => levelTarget("adventure", seed, step, 11, 1));
    expect(targets.every((t) => t.index === 11)).toBe(true);
    expect(targets.map((t) => t.seed)).toEqual(subs);
  });

  it("les 5 foules sont différentes mais de même difficulté", () => {
    const world = getWorld("ocean")!;
    const seed = missionSeed("ocean", 4);
    const specs = [1, 2, 3, 4, 5].map((step) => {
      const t = levelTarget("adventure", seed, step, world.startIndex, 4);
      return generateLevel(t.index, { seed: t.seed, tier: "normal", pool: world.characters });
    });
    expect(new Set(specs.map((s) => s.seed)).size).toBe(5);
    expect(new Set(specs.map((s) => s.index))).toEqual(new Set([missionEngineIndex(11, 4)]));
    expect(specs.every((s) => s.wanted.serie === "ocean")).toBe(true);
  });

  it("Infini et Défi : l'index suit le niveau, la graine ne change pas", () => {
    expect(levelTarget("endless", 42, 7)).toEqual({ index: 7, seed: 42 });
    expect(levelTarget("daily", 42, 3)).toEqual({ index: 3, seed: 42 });
  });
});

describe("readModeParams", () => {
  it("lit le mode depuis l'URL", () => {
    expect(readModeParams("")).toEqual({ mode: "endless" });
    expect(readModeParams("?seed=12&level=8")).toEqual({ mode: "endless" });
    expect(readModeParams("?mode=daily")).toEqual({ mode: "daily" });
    expect(readModeParams("?mode=adventure&world=ocean&level=3")).toEqual({
      mode: "adventure",
      worldId: "ocean",
      level: 3,
    });
    expect(readModeParams("?mode=adventure&world=ocean&level=99")).toMatchObject({ level: 10 });
    expect(readModeParams("?mode=adventure&world=lune&level=3")).toEqual({ mode: "endless" });
  });
});

describe("nextTime", () => {
  it("plafond de 60 s, sauf en Aventure", () => {
    expect(nextTime("endless", 58, 5)).toBe(60);
    expect(nextTime("daily", 58, 5)).toBe(60);
    expect(nextTime("adventure", 58, 5)).toBe(63);
    expect(nextTime("adventure", 2, -5)).toBe(0);
  });
});

describe("nextMissionUrl", () => {
  it("niveau suivant, puis monde suivant après le niveau 10", () => {
    expect(nextMissionUrl("ocean", 3)).toBe("/game?mode=adventure&world=ocean&level=4");
    expect(nextMissionUrl("ocean", 10)).toBe("/game?mode=adventure&world=dinos&level=1");
    expect(nextMissionUrl("espace", 10)).toBeNull();
  });
});

describe("dailyShareText", () => {
  it("formate la date en jour/mois", () => {
    expect(dailyShareText("2026-10-03", 23)).toBe("Find It – Défi du 03/10 : 23 trouvés !");
    expect(dailyShareText("2026-10-03", 1)).toBe("Find It – Défi du 03/10 : 1 trouvé !");
  });
});
