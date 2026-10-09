import { describe, expect, it } from "vitest";
import { animalsPack, celebritiesPack, historyPack, peoplePack } from "../../helpers/characters";
import { defaultSave } from "../../save/schema";
import { generatePlayableLevel } from "../../game/playableLevel";
import { MULTIPLAYER_THEMES, multiplayerLevel, multiplayerPool } from "../../multiplayer/multiplayerRules";
import { defaultThemeForFamily, playThemeFromSearch, playThemePool, publishedThemePool, themeOptions } from "../playThemes";
import { isPersonUnlocked, unlockedPeople } from "../personUnlocks";

const allPeople = [...peoplePack, ...historyPack, ...celebritiesPack];

describe("all characters theme", () => {
  it("defaults the character family to the combined catalogue of public figures", () => {
    expect(defaultThemeForFamily("personnages")).toBe("personnages");
    expect(playThemeFromSearch("?theme=personnages")).toBe("personnages");
    expect(publishedThemePool("personnages")).toEqual(allPeople);
    expect(new Set(allPeople.map(character => character.name)).size).toBe(allPeople.length);
    expect(MULTIPLAYER_THEMES).toContain("personnages");
  });

  it("includes starters and purchases from every collection in solo and duel", () => {
    const save = defaultSave();
    const purchases = [peoplePack, historyPack, celebritiesPack].flatMap(pack => pack.find(character => !isPersonUnlocked(save, character.name))?.name ?? []);
    const starters = unlockedPeople(save, allPeople).length;
    for (const mode of ["endless", "duel"] as const) {
      expect(playThemePool(mode, "personnages", save)).toEqual(unlockedPeople(save, allPeople));
      expect(themeOptions(mode, save).find(option => option.theme.id === "personnages"))
        .toMatchObject({ availableCount: starters, totalCount: allPeople.length, enabled: true });
      const purchased = { ...save, purchasedPeople: purchases };
      expect(playThemePool(mode, "personnages", purchased)).toEqual(unlockedPeople(purchased, allPeople));
      expect(playThemePool(mode, "personnages", purchased)).toHaveLength(starters + purchases.length);
      expect(playThemePool(mode, "personnages", { ...save, purchasedPeople: allPeople.map(character => character.name) })).toEqual(allPeople);
    }
    expect(multiplayerPool("personnages", purchases)).toEqual(unlockedPeople({ purchasedPeople: purchases }, allPeople));
  });

  it("draws targets from every collection without admitting animals or locked people", () => {
    const pool = playThemePool("endless", "personnages", defaultSave());
    const allowed = new Set(pool.map(character => character.name));
    const series = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const spec of [generatePlayableLevel(1, { seed, tier: "normal", pool }), multiplayerLevel(1, seed, "personnages")]) {
        series.add(spec.wanted.serie);
        expect([spec.wanted, ...spec.decoys].every(character => allowed.has(character.name))).toBe(true);
        expect([spec.wanted, ...spec.decoys].some(character => animalsPack.includes(character))).toBe(false);
      }
    }
    expect(series).toEqual(new Set(pool.map(character => character.serie)));
  });
});
