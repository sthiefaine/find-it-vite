import { describe, expect, it, vi } from "vitest";
import { celebritiesPack, historyPack, peoplePack } from "../../helpers/characters";
import { CHARACTER_REGIONS, characterRegions } from "../characterRegions";
import { PLAY_THEMES, playThemeFromSearch, playThemePool, publishedThemePool, themeOptions } from "../playThemes";
import { MULTIPLAYER_THEMES, multiplayerPool } from "../../multiplayer/multiplayerRules";

// Countries must work as soon as a sufficiently large sourced manifest is
// published; this fixture also exercises stale France tags on new politicians.
vi.mock("../../helpers/characters", async importOriginal => {
  const actual = await importOriginal<typeof import("../../helpers/characters")>();
  const portrait = (name: string, serie: string, code?: string) => ({ name, label: name, serie, imageSrc: `/assets/images/characters/runtime/${name}.webp`, color: "brown", family: "brun", tags: serie === "politics" ? ["france"] : [],
    ...(code ? { countryLinks: [{ code, relation: "Lien culturel documenté pour cette fixture.", sourceUrl: "https://example.com/biography" }] } : {}) });
  return { ...actual,
    peoplePack: ["emmanuel-macron", "nicolas-sarkozy", "francois-hollande"].map(name => portrait(name, "politics"))
      .concat(["us-one", "us-two", "us-three"].map(name => portrait(name, "politics", "US")), ["br-one", "br-two", "br-three"].map(name => portrait(name, "politics", "BR"))),
    historyPack: ["napoleon-bonaparte", "louis-xiv", "jeanne-d-arc", "leonard-de-vinci", "francois-ier", "marie-antoinette", "olympe-de-gouges", "victor-hugo", "josephine-baker", "rosa-parks", "martin-luther-king"].map(name => portrait(name, "history"))
      .concat(["max-planck", "ludwig-van-beethoven", "de-history-fixture"].map(name => portrait(name, "history", "DE")), [portrait("piotr-ilitch-tchaikovski", "history", "RU")]),
    celebritiesPack: ["br-chef", "br-singer", "br-athlete"].map(name => portrait(name, "celebrity", "BR"))
      .concat([portrait("gb-actor", "celebrity", "GB")]),
  };
});

const allPurchased = { purchasedPeople: [...peoplePack, ...historyPack, ...celebritiesPack].map(person => person.name) };

describe("thèmes pays publiés", () => {
  it("préserve l'ancien politique français et sépare les nouveaux USA/Brésil", () => {
    expect(publishedThemePool("politique").map(person => person.name)).toEqual(["emmanuel-macron", "nicolas-sarkozy", "francois-hollande"]);
    expect(publishedThemePool("politique-us").map(person => person.name)).toEqual(["us-one", "us-two", "us-three"]);
    expect(publishedThemePool("politique-br").map(person => person.name)).toEqual(["br-one", "br-two", "br-three"]);
    for (const id of ["politique-us", "politique-br"] as const) {
      expect(PLAY_THEMES.find(theme => theme.id === id)?.comingSoon).toBe(false);
      expect(publishedThemePool(id).every(person => !characterRegions(person).includes("fr"))).toBe(true);
      expect(themeOptions("endless", allPurchased).find(option => option.theme.id === id)?.enabled).toBe(true);
      expect(playThemeFromSearch(`?theme=${id}`)).toBe(id);
    }
  });
  it("garde les thèmes pays fermés tant que trois personnes ne sont pas débloquées", () => {
    expect(themeOptions("endless", {}).find(option => option.theme.id === "politique-us")).toMatchObject({ totalCount: 3, availableCount: 0, enabled: false });
    expect(playThemePool("endless", "politique-us", {})).toEqual([]);
    expect(playThemePool("duel", "politique-br", {})).toEqual([]);
    expect(playThemePool("endless", "politique-us", { purchasedPeople: ["us-one", "us-two"] })).toHaveLength(2);
    expect(playThemePool("endless", "politique-us", allPurchased)).toHaveLength(3);
  });
  it("préserve les anciens pools historiques FR/US et garde les nouveaux compositeurs dans l'histoire", () => {
    for (const code of ["fr", "us"]) {
      const legacyIds = Object.entries(CHARACTER_REGIONS).filter(([, countries]) => countries.includes(code)).map(([name]) => name);
      expect(publishedThemePool(`histoire-${code}`).map(person => person.name)).toEqual(historyPack.filter(person => legacyIds.includes(person.name)).map(person => person.name));
    }
    expect(publishedThemePool("histoire-de").map(person => person.name)).toEqual(["max-planck", "ludwig-van-beethoven", "de-history-fixture"]);
    expect(publishedThemePool("histoire-ru").map(person => person.name)).toEqual(["piotr-ilitch-tchaikovski"]);
    expect(publishedThemePool("personnes").some(person => person.name === "max-planck")).toBe(false);
  });
  it("crée les filtres célébrités depuis les pays présents et indique les petits pools à venir", () => {
    expect(PLAY_THEMES.find(theme => theme.id === "personnes-br")).toMatchObject({ group: "celebrites", region: "br", labelKey: "Célébrités · {{country}}", comingSoon: false, preview: celebritiesPack[0].imageSrc });
    expect(PLAY_THEMES.find(theme => theme.id === "personnes-gb")?.comingSoon).toBe(true);
    expect(PLAY_THEMES.some(theme => theme.id === "personnes-cn")).toBe(false);
    expect(publishedThemePool("personnages")).toHaveLength(peoplePack.length + historyPack.length + celebritiesPack.length);
  });
  it("rend les nouveaux pays jouables en duel tout en filtrant les thèmes insuffisants", () => {
    expect(MULTIPLAYER_THEMES).toContain("politique-us");
    expect(MULTIPLAYER_THEMES).toContain("politique-br");
    expect(MULTIPLAYER_THEMES).toContain("personnes-br");
    expect(MULTIPLAYER_THEMES).not.toContain("personnes-gb");
    expect(multiplayerPool("politique-us", allPurchased.purchasedPeople)).toEqual(publishedThemePool("politique-us"));
    expect(multiplayerPool("politique-br")).toEqual([]);
  });
});
