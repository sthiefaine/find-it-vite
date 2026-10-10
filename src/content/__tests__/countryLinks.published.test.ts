import { describe, expect, it } from "vitest";
import { celebritiesPack, historyPack, peoplePack } from "../../helpers/characters";
import { characterRegions } from "../characterRegions";
import { isCountryLink } from "../countryLinks";
import { PLAY_THEMES, publishedThemePool, themeOptions } from "../playThemes";
import { MULTIPLAYER_THEMES } from "../../multiplayer/multiplayerRules";

describe("liens pays des portraits réellement publiés", () => {
  it("dispose de politiques USA et Brésil distincts de l'ancien catalogue français", () => {
    for (const [id, code] of [["politique-us", "us"], ["politique-br", "br"]] as const) {
      const pool = publishedThemePool(id);
      expect(pool.length).toBeGreaterThanOrEqual(3);
      expect(pool.every(person => person.serie === "politics" && characterRegions(person).includes(code) && !characterRegions(person).includes("fr"))).toBe(true);
      expect(PLAY_THEMES.find(theme => theme.id === id)?.comingSoon).toBe(false);
      expect(themeOptions("endless", { purchasedPeople: pool.map(person => person.name) }).find(option => option.theme.id === id)?.enabled).toBe(true);
      expect(MULTIPLAYER_THEMES).toContain(id);
    }
    const legacyFrance = peoplePack.filter(person => !person.countryLinks?.length && person.tags?.includes("france"));
    const currentFrance = new Set(publishedThemePool("politique").map(person => person.name));
    expect(legacyFrance.length).toBeGreaterThanOrEqual(3);
    expect(legacyFrance.every(person => currentFrance.has(person.name))).toBe(true);
  });
  it("conserve les sources pays valides et les nouveaux compositeurs dans le pool historique", () => {
    const sourcedPeople = [...peoplePack, ...historyPack, ...celebritiesPack].filter(person => person.countryLinks?.length);
    expect(sourcedPeople.length).toBeGreaterThan(0);
    expect(sourcedPeople.every(person => person.countryLinks!.every(isCountryLink))).toBe(true);
    for (const subject of ["max-planck", "ludwig-van-beethoven"]) {
      expect(publishedThemePool("histoire-de").some(person => person.name === subject)).toBe(true);
      expect(celebritiesPack.some(person => person.name === subject)).toBe(false);
    }
    expect(publishedThemePool("histoire-ru").some(person => /tchaik/.test(person.name))).toBe(true);
  });
});
