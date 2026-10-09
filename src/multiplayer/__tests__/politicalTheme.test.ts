import { describe, expect, it } from "vitest";
import { historyPack, peoplePack } from "../../helpers/characters";
import { unlockedPeople } from "../../content/personUnlocks";
import { MULTIPLAYER_THEMES, levelCharacterIds, multiplayerLevel, multiplayerPool } from "../multiplayerRules";
import { charactersInRegion } from "../../content/characterRegions";
import { playThemePool } from "../../content/playThemes";
import { defaultSave } from "../../save/schema";

describe.each([["politique", peoplePack], ["histoire", historyPack]] as const)("%s dans les salons en ligne", (theme, pack) => {
  it("propose les mêmes portraits sur le serveur et dans le jeu", () => {
    expect(MULTIPLAYER_THEMES).toContain(theme);
    expect(multiplayerPool(theme)).toEqual(unlockedPeople({}, pack));
    for (const index of [1, 13, 43, 80]) {
      const spec = multiplayerLevel(index, 42, theme);
      expect(spec).toEqual(multiplayerLevel(index, 42, theme));
      expect([spec.wanted, ...spec.decoys].every((character) => pack.some((person) => person.name === character.name))).toBe(true);
      expect(levelCharacterIds(spec).wanted.size).toBe(1);
      if (index < 13) expect(spec.accessories).toBeUndefined();
      if (index === 13) expect(spec.accessories?.target).toBeTruthy();
      expect(spec.crowdVariant).toBeUndefined();
    }
  });
});

describe("catalogues communs des salons", () => {
  it("utilise les 29 portraits marins publiés, comme la sélection de thème", () => {
    const ocean = multiplayerPool("ocean");
    expect(ocean).toHaveLength(29);
    expect(ocean.map(character => character.name)).toEqual(expect.arrayContaining([
      "baleine-bleue", "poisson-clown", "meduse", "calamar", "seiche",
      "murene", "poisson-lune", "poisson-lion", "lamantin", "dugong",
    ]));
    expect(ocean).toEqual(playThemePool("duel", "ocean", defaultSave()));
    expect(ocean.every(character => !character.emoji && character.tags?.includes("ocean") && character.imageSrc.startsWith("/assets/images/characters/animals/"))).toBe(true);
    const spec = multiplayerLevel(1, 42, "ocean");
    expect([spec.wanted, ...spec.decoys].every(character => ocean.some(item => item.name === character.name))).toBe(true);
  });

  it("partage les sous-régions historiques en respectant les achats", () => {
    expect(MULTIPLAYER_THEMES).toEqual(expect.arrayContaining(["jungle", "polaires", "histoire-fr", "histoire-us"]));
    expect(MULTIPLAYER_THEMES).not.toContain("politique-br");
    expect(MULTIPLAYER_THEMES).not.toContain("politique-us");
    expect(multiplayerPool("histoire-fr")).toEqual(unlockedPeople({}, charactersInRegion(historyPack, "fr")));
    expect(multiplayerPool("histoire-us").map(character => character.name)).toEqual(["rosa-parks"]);
    const purchases = ["josephine-baker", "martin-luther-king"];
    expect(multiplayerPool("histoire-us", purchases)).toEqual(charactersInRegion(historyPack, "us"));
    const spec = multiplayerLevel(1, 42, "histoire-us", purchases);
    expect([spec.wanted, ...spec.decoys].every(character => charactersInRegion(historyPack, "us").some(item => item.name === character.name))).toBe(true);
  });
});
