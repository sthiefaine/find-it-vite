import { describe, expect, it } from "vitest";
import { peoplePack } from "../../helpers/characters";
import { MULTIPLAYER_THEMES, levelCharacterIds, multiplayerLevel, multiplayerPool } from "../multiplayerRules";

describe("politique dans les salons en ligne", () => {
  it("propose les mêmes portraits sur le serveur et dans le jeu", () => {
    expect(MULTIPLAYER_THEMES).toContain("politique");
    expect(multiplayerPool("politique")).toEqual(peoplePack);
    for (const index of [1, 13, 43, 80]) {
      const spec = multiplayerLevel(index, 42, "politique");
      expect(spec).toEqual(multiplayerLevel(index, 42, "politique"));
      expect([spec.wanted, ...spec.decoys].every((character) => peoplePack.some((person) => person.name === character.name))).toBe(true);
      expect(levelCharacterIds(spec).wanted.size).toBe(1);
      expect(spec.accessories).toBeUndefined();
    }
  });
});
