import { describe, expect, it } from "vitest";
import { characterPoolFor } from "../../game/characterPool";
import { generatePlayableLevel } from "../../game/playableLevel";
import { animalsPack, celebritiesPack, historyPack, peoplePack } from "../../helpers/characters";
import { generateRound } from "../../pages/Duel/duelLogic";
import { defaultSave } from "../../save/schema";
import { defaultThemeForFamily, PLAY_THEMES, playThemeFromSearch, playThemePool, publishedThemePool, THEME_FAMILIES, themeOptions } from "../playThemes";
import { unlockedPeople } from "../personUnlocks";
import { CHARACTER_REGIONS, charactersInRegion } from "../characterRegions";
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
      expect(option.availableCount).toBe(option.theme.family === "personnages"
        ? unlockedPeople({}, publishedThemePool(option.theme.id)).length : option.totalCount);
      expect(option.enabled).toBe(!option.theme.comingSoon && option.availableCount >= 3);
    }
    for (const id of ["ferme", "foret", "savane", "ocean", "jungle", "polaires"] as const) {
      const candidates = animalsPack.filter((animal) => animal.tags?.includes(id));
      const option = endless.find(({ theme }) => theme.id === id)!;
      expect(option.totalCount).toBe(candidates.length);
      expect(option.availableCount).toBe(unlockedAnimals(save, candidates).length);
      expect(option.enabled).toBe(option.availableCount >= 3);
    }
    for (const options of [endless, duel]) {
      expect(options.find(({ theme }) => theme.id === "personnes")).toMatchObject({ availableCount: unlockedPeople(save, celebritiesPack).length, totalCount: celebritiesPack.length });
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
    for (const search of ["", "?serie=ferme", "?theme=inconnu", "?theme=__proto__", ...PLAY_THEMES.filter(theme => theme.comingSoon).map(theme => `?theme=${theme.id}`)]) {
      expect(playThemeFromSearch(search)).toBe("ferme");
    }
    expect(playThemeFromSearch("?theme=foret&serie=ferme")).toBe("foret");
    const unknownId = "inconnu" as unknown as PlayThemeId;
    expect(playThemePool("endless", unknownId, defaultSave())).toEqual(unlockedAnimals(defaultSave()));
    expect(playThemePool("duel", unknownId, defaultSave())).toEqual(animalsPack);
  });

  it("limite toutes les cibles et tous les leurres de l'Infini au thème autorisé", () => {
    const ocean = animalsPack.filter((animal) => animal.tags?.includes("ocean"));
    const save = { collection: Object.fromEntries([...animalsPack.filter((animal) => ["renard", "ours", "singe", "giraffe", "zebre", "elephant"].includes(animal.name)), ...ocean.slice(0, 3)].map((animal) => [animal.name, 1])) };
    for (const theme of PLAY_THEMES) {
      const pool = playThemePool("endless", theme.id, save);
      expect(pool.every((animal) => theme.family === "personnages" || theme.id === "drapeaux" || isAnimalUnlocked(save, animal.name))).toBe(true);
      if (pool.length < 3) continue;
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

  it("rend 12 portraits historiques disponibles avec des tenues progressives", () => {
    expect(historyPack.length).toBeGreaterThanOrEqual(24);
    expect(playThemeFromSearch("?theme=histoire")).toBe("histoire");
    for (const mode of ["endless", "duel"] as const) {
      expect(playThemePool(mode, "histoire", defaultSave())).toEqual(unlockedPeople({}, historyPack));
      expect(themeOptions(mode, defaultSave()).find(({ theme }) => theme.id === "histoire")).toMatchObject({ enabled: true, availableCount: 12 });
    }
    for (const index of [1, 6, 12, 13, 40]) {
      const spec = generatePlayableLevel(index, { seed: 42, tier: "normal", pool: historyPack });
      expect([spec.wanted, ...spec.decoys].every(character => character.serie === "history")).toBe(true);
      if (index < 13) expect(spec.accessories).toBeUndefined();
      if (index === 13) expect(spec.accessories?.target).toBeTruthy();
    }
  });

  it("rend la politique disponible dès le départ sans élargir les thèmes animaliers", () => {
    const save = defaultSave();
    const french = charactersInRegion(peoplePack, "fr");
    expect(french).toHaveLength(41);
    for (const mode of ["endless", "duel"] as const) {
      expect(themeOptions(mode, save).find(({ theme }) => theme.id === "politique"))
        .toMatchObject({ availableCount: 12, totalCount: french.length, enabled: true });
      expect(playThemePool(mode, "politique", save)).toEqual(unlockedPeople({}, french));
      expect(playThemePool(mode, "animaux", save).every((character) => character.serie === "animal")).toBe(true);
    }
    expect(playThemeFromSearch("?theme=politique")).toBe("politique");
    for (const index of [1, 13, 47, 100]) {
      const spec = generatePlayableLevel(index, { seed: 42, tier: "normal", pool: french });
      expect([spec.wanted, ...spec.decoys].every((character) => character.serie === "politics")).toBe(true);
      if (index < 13) expect(spec.accessories).toBeUndefined();
      if (index === 13) expect(spec.accessories?.target).toBeTruthy();
    }
  });

  it("organise les catalogues en familles et choisit la ferme par défaut", () => {
    expect(THEME_FAMILIES.map(family => family.id)).toEqual(["animaux", "personnages", "drapeaux"]);
    expect(defaultThemeForFamily("animaux")).toBe("ferme");
    expect(defaultThemeForFamily("personnages")).toBe("personnages");
    expect(defaultThemeForFamily("drapeaux")).toBe("drapeaux");
    expect(playThemeFromSearch("")).toBe("ferme");
    expect(themeOptions("endless", defaultSave()).find(option => option.theme.id === "ferme"))
      .toMatchObject({ availableCount: 3, enabled: true });
    for (const id of ["jungle", "polaires", "histoire-fr", "histoire-us"] as const) {
      expect(playThemeFromSearch(`?theme=${id}`)).toBe(id);
    }
  });

  it("propose les catalogues politiques brésilien et américain en exigeant trois portraits débloqués", () => {
    for (const id of ["politique-br", "politique-us"] as const) {
      const pool = charactersInRegion(peoplePack, id === "politique-br" ? "br" : "us");
      expect(pool.length).toBeGreaterThanOrEqual(3);
      expect(publishedThemePool(id)).toEqual(pool);
      expect(playThemeFromSearch(`?theme=${id}`)).toBe(id);
      for (const mode of ["endless", "duel"] as const) {
        for (const count of [0, 2, 3]) {
          const save = { ...defaultSave(), purchasedPeople: pool.slice(0, count).map(person => person.name) };
          expect(themeOptions(mode, save).find(option => option.theme.id === id))
            .toMatchObject({ availableCount: count, totalCount: pool.length, enabled: count >= 3, theme: { comingSoon: false, family: "personnages", group: "politique" } });
          expect(playThemePool(mode, id, save)).toEqual(pool.slice(0, count));
        }
      }
    }
  });

  it("partage des régions historiques explicites, y compris les liens à plusieurs pays", () => {
    const french = charactersInRegion(historyPack, "fr");
    const american = charactersInRegion(historyPack, "us");
    expect(french).toHaveLength(9);
    expect(american.map(character => character.name)).toEqual(["josephine-baker", "rosa-parks", "martin-luther-king"]);
    expect(CHARACTER_REGIONS["josephine-baker"]).toEqual(["fr", "us"]);
    expect(french.some(character => character.name === "leonard-de-vinci")).toBe(true);
    for (const id of Object.keys(CHARACTER_REGIONS)) {
      expect(historyPack.find(character => character.name === id)?.profile).toBeDefined();
    }
    for (const character of french) expect(character.profile!.description).toMatch(/France|français|Orléans/);
    for (const character of american) expect(character.profile!.description).toMatch(/États-Unis|américain/);
    expect(publishedThemePool("histoire-fr")).toEqual(french);
    expect(publishedThemePool("histoire-us")).toEqual(american);
  });

  it("garde une région historique verrouillée sans repli sur les animaux", () => {
    const save = defaultSave();
    for (const mode of ["endless", "duel"] as const) {
      expect(playThemePool(mode, "histoire-us", save).map(character => character.name)).toEqual(["rosa-parks"]);
      expect(themeOptions(mode, save).find(option => option.theme.id === "histoire-us"))
        .toMatchObject({ availableCount: 1, totalCount: 3, enabled: false });
      const unlocked = { ...save, purchasedPeople: ["josephine-baker", "martin-luther-king"] };
      expect(playThemePool(mode, "histoire-us", unlocked)).toEqual(charactersInRegion(historyPack, "us"));
      expect(themeOptions(mode, unlocked).find(option => option.theme.id === "histoire-us"))
        .toMatchObject({ availableCount: 3, enabled: true });
    }
  });
});
