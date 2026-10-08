import { describe, expect, it } from "vitest";
import { characterPoolFor } from "../../game/characterPool";
import { generatePlayableLevel } from "../../game/playableLevel";
import { animalsPack, historyPack, peoplePack } from "../../helpers/characters";
import { generateRound } from "../../pages/Duel/duelLogic";
import { defaultSave } from "../../save/schema";
import { PLAY_THEMES, playThemeFromSearch, playThemePool, themeOptions } from "../playThemes";
import { unlockedPeople } from "../personUnlocks";
import type { PlayThemeId } from "../playThemes";
import { isAnimalUnlocked, unlockedAnimals } from "../unlockedAnimals";
import { getWorld } from "../worlds";

describe("thèmes proposés avant une partie", () => {
  it("compte les animaux jouables selon le mode et garde les thèmes futurs indisponibles", () => {
    const save = defaultSave();
    const endless = themeOptions("endless", save);
    const duel = themeOptions("duel", save);
    expect(endless[0]).toMatchObject({ theme: { id: "animaux" }, availableCount: 5, totalCount: animalsPack.length, enabled: true });
    for (const option of duel) {
      expect(option.availableCount).toBe(option.theme.id === "politique" || option.theme.id === "histoire" ? 12 : option.totalCount);
      expect(option.enabled).toBe(!option.theme.comingSoon && option.availableCount >= 3);
    }
    for (const id of ["ferme", "foret", "savane", "ocean"] as const) {
      const candidates = animalsPack.filter((animal) => animal.tags?.includes(id));
      const option = endless.find(({ theme }) => theme.id === id)!;
      expect(option.totalCount).toBe(candidates.length);
      expect(option.availableCount).toBe(unlockedAnimals(save, candidates).length);
      expect(option.enabled).toBe(option.availableCount >= 3);
    }
    for (const options of [endless, duel]) for (const id of ["personnes"]) {
      expect(options.find(({ theme }) => theme.id === id)).toMatchObject({ availableCount: 0, totalCount: 0, enabled: false, theme: { comingSoon: true } });
    }
  });

  it("fait un repli sûr tant qu'un thème n'a pas trois portraits débloqués", () => {
    const ocean = animalsPack.filter((animal) => animal.tags?.includes("ocean"));
    const two = { collection: Object.fromEntries(ocean.slice(0, 2).map((animal) => [animal.name, 1])) };
    const three = { collection: Object.fromEntries(ocean.slice(0, 3).map((animal) => [animal.name, 1])) };
    expect(themeOptions("endless", two).find(({ theme }) => theme.id === "ocean")).toMatchObject({ availableCount: 2, totalCount: ocean.length, enabled: false });
    expect(playThemePool("endless", "ocean", two)).toEqual(unlockedAnimals(two));
    expect(themeOptions("endless", three).find(({ theme }) => theme.id === "ocean")).toMatchObject({ availableCount: 3, enabled: true });
    expect(playThemePool("endless", "ocean", three)).toEqual(ocean.slice(0, 3));
    expect(playThemePool("duel", "ocean", defaultSave())).toEqual(ocean);
  });

  it("utilise les portraits marins publiés pour le thème Océan", () => {
    const pool = playThemePool("duel", "ocean", defaultSave());
    expect(pool.length).toBeGreaterThanOrEqual(3);
    expect(pool.every((animal) => animal.tags?.includes("ocean"))).toBe(true);
    expect(pool.every((animal) => !animal.emoji && animal.imageSrc.startsWith("/assets/images/characters/animals/"))).toBe(true);
    expect(PLAY_THEMES.find((theme) => theme.id === "ocean")?.preview).toBe(pool.find((animal) => animal.name === "dauphin")?.imageSrc);
  });

  it("ignore les anciens liens serie et les thèmes inconnus ou à venir", () => {
    for (const search of ["", "?serie=ferme", "?theme=inconnu", "?theme=personnes", "?theme=__proto__"]) {
      expect(playThemeFromSearch(search)).toBe("animaux");
    }
    expect(playThemeFromSearch("?theme=foret&serie=ferme")).toBe("foret");
    for (const id of ["personnes", "inconnu"] as PlayThemeId[]) {
      expect(playThemePool("endless", id, defaultSave())).toEqual(unlockedAnimals(defaultSave()));
      expect(playThemePool("duel", id, defaultSave())).toEqual(animalsPack);
    }
  });

  it("limite toutes les cibles et tous les leurres de l'Infini au thème autorisé", () => {
    const ocean = animalsPack.filter((animal) => animal.tags?.includes("ocean"));
    const save = { collection: Object.fromEntries([...animalsPack.filter((animal) => ["renard", "ours", "singe", "giraffe", "zebre", "elephant"].includes(animal.name)), ...ocean.slice(0, 3)].map((animal) => [animal.name, 1])) };
    for (const theme of PLAY_THEMES) {
      const pool = playThemePool("endless", theme.id, save);
      expect(pool.every((animal) => theme.id === "politique" || theme.id === "histoire" || theme.id === "drapeaux" || isAnimalUnlocked(save, animal.name))).toBe(true);
      const ids = new Set(pool.map((animal) => animal.name));
      for (const index of [1, 3, 6, 11, 19, 40, 100, 4000]) {
        const spec = generatePlayableLevel(index, { seed: 42, tier: "normal", pool });
        expect(ids.has(spec.wanted.name)).toBe(true);
        expect(spec.decoys.every((animal) => ids.has(animal.name))).toBe(true);
      }
    }
    const farm = playThemePool("endless", "ferme", save);
    expect(farm.every((animal) => animal.tags?.includes("ferme"))).toBe(true);
    expect(farm.some((animal) => animal.name === "vache-highland")).toBe(false);
  });

  it("conserve le même thème en Duel, de la première manche aux suivantes", () => {
    for (const id of ["ferme", "foret", "savane", "ocean", "politique", "histoire", "drapeaux"] as const) {
      const pool = playThemePool("duel", id, defaultSave());
      const ids = new Set(pool.map((animal) => animal.name));
      let previous: string | undefined;
      for (let number = 1; number <= 15; number++) {
        const round = generateRound(42, number, previous, pool);
        expect(ids.has(round.spec.wanted.name)).toBe(true);
        expect(round.cells.every((animal) => ids.has(animal.name))).toBe(true);
        expect(round.spec.wanted.name).not.toBe(previous);
        previous = round.spec.wanted.name;
      }
    }
  });

  it("n'applique les thèmes choisis ni à l'Aventure ni au Défi du jour", () => {
    const save = defaultSave();
    expect(characterPoolFor("daily", 1, save, "ferme")).toEqual(getWorld("animaux")!.characters);
    expect(characterPoolFor("adventure", 21, save, "savane")).toEqual(getWorld("ocean")!.characters);
    expect(characterPoolFor("endless", 1, save, "ferme")).toEqual(playThemePool("endless", "ferme", save));
  });

  it("rend 12 portraits historiques disponibles dans les deux modes sans déguisement", () => {
    expect(historyPack).toHaveLength(24);
    expect(playThemeFromSearch("?theme=histoire")).toBe("histoire");
    for (const mode of ["endless", "duel"] as const) {
      expect(playThemePool(mode, "histoire", defaultSave())).toEqual(unlockedPeople({}, historyPack));
      expect(themeOptions(mode, defaultSave()).find(({ theme }) => theme.id === "histoire")).toMatchObject({ enabled: true, availableCount: 12 });
    }
    for (const index of [1, 6, 12, 40]) {
      const spec = generatePlayableLevel(index, { seed: 42, tier: "normal", pool: historyPack });
      expect([spec.wanted, ...spec.decoys].every(character => character.serie === "history")).toBe(true);
      expect(spec.accessories).toBeUndefined();
      expect(spec.crowdVariant).toBeUndefined();
    }
  });

  it("rend la politique disponible dès le départ sans élargir les thèmes animaliers", () => {
    const save = defaultSave();
    for (const mode of ["endless", "duel"] as const) {
      expect(themeOptions(mode, save).find(({ theme }) => theme.id === "politique"))
        .toMatchObject({ availableCount: 12, totalCount: peoplePack.length, enabled: true });
      expect(playThemePool(mode, "politique", save)).toEqual(unlockedPeople({}, peoplePack));
      expect(playThemePool(mode, "animaux", save).every((character) => character.serie === "animal")).toBe(true);
    }
    expect(playThemeFromSearch("?theme=politique")).toBe("politique");
    for (const index of [1, 13, 47, 100]) {
      const spec = generatePlayableLevel(index, { seed: 42, tier: "normal", pool: peoplePack });
      expect([spec.wanted, ...spec.decoys].every((character) => character.serie === "politics")).toBe(true);
      expect(spec.accessories).toBeUndefined();
      expect(spec.crowdVariant).toBeUndefined();
    }
  });
});
