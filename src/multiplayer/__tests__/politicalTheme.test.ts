import { describe, expect, it } from "vitest";
import { historyPack, peoplePack } from "../../helpers/characters";
import { unlockedPeople } from "../../content/personUnlocks";
import { MULTIPLAYER_THEMES, levelCharacterIds, multiplayerLevel, multiplayerPool } from "../multiplayerRules";

describe.each([["politique", peoplePack], ["histoire", historyPack]] as const)("%s dans les salons en ligne", (theme, pack) => {
  it("propose les mêmes portraits sur le serveur et dans le jeu", () => {
    expect(MULTIPLAYER_THEMES).toContain(theme);
    expect(multiplayerPool(theme)).toEqual(unlockedPeople({}, pack));
    for (const index of [1, 13, 43, 80]) {
      const spec = multiplayerLevel(index, 42, theme);
      expect(spec).toEqual(multiplayerLevel(index, 42, theme));
      expect([spec.wanted, ...spec.decoys].every((character) => pack.some((person) => person.name === character.name))).toBe(true);
      expect(levelCharacterIds(spec).wanted.size).toBe(1);
      expect(spec.accessories).toBeUndefined();
    }
  });
});
