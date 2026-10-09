import { describe, expect, it } from "vitest";
import { animalsPack, historyPack, peoplePack } from "../../helpers/characters";
import { defaultSave } from "../../save/schema";
import { generatePlayableLevel } from "../../game/playableLevel";
import { MULTIPLAYER_THEMES, multiplayerLevel, multiplayerPool } from "../../multiplayer/multiplayerRules";
import { defaultThemeForFamily, playThemeFromSearch, playThemePool, publishedThemePool, themeOptions } from "../playThemes";
import { isPersonUnlocked, unlockedPeople } from "../personUnlocks";

const allPeople = [...peoplePack, ...historyPack];

describe("all characters theme", () => {
  it("defaults the character family to the combined political and historical catalogue", () => {
    expect(defaultThemeForFamily("personnages")).toBe("personnages");
    expect(playThemeFromSearch("?theme=personnages")).toBe("personnages");
    expect(publishedThemePool("personnages")).toEqual(allPeople);
    expect(new Set(allPeople.map(character => character.name)).size).toBe(allPeople.length);
    expect(MULTIPLAYER_THEMES).toContain("personnages");
  });

  it("includes starters and purchases from both collections in solo and duel", () => {
    const save = defaultSave();
    const purchases = [peoplePack, historyPack].map(pack => pack.find(character => !isPersonUnlocked(save, character.name))!.name);
    for (const mode of ["endless", "duel"] as const) {
      expect(playThemePool(mode, "personnages", save)).toEqual(unlockedPeople(save, allPeople));
      expect(themeOptions(mode, save).find(option => option.theme.id === "personnages"))
        .toMatchObject({ availableCount: 24, totalCount: allPeople.length, enabled: true });
      const purchased = { ...save, purchasedPeople: purchases };
      expect(playThemePool(mode, "personnages", purchased)).toEqual(unlockedPeople(purchased, allPeople));
      expect(playThemePool(mode, "personnages", purchased)).toHaveLength(26);
      expect(playThemePool(mode, "personnages", { ...save, purchasedPeople: allPeople.map(character => character.name) })).toEqual(allPeople);
    }
    expect(multiplayerPool("personnages", purchases)).toEqual(unlockedPeople({ purchasedPeople: purchases }, allPeople));
  });

  it("draws targets from both collections without admitting animals or locked people", () => {
    const pool = playThemePool("endless", "personnages", defaultSave());
    const allowed = new Set(pool.map(character => character.name));
    const series = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const spec of [generatePlayableLevel(1, { seed, tier: "normal", pool }), multiplayerLevel(1, seed, "personnages")]) {
        series.add(spec.wanted.serie);
        expect([spec.wanted, ...spec.decoys].every(character => allowed.has(character.name))).toBe(true);
        expect([spec.wanted, ...spec.decoys].some(character => animalsPack.includes(character))).toBe(false);
      }
    }
    expect(series).toEqual(new Set(["politics", "history"]));
  });
});
