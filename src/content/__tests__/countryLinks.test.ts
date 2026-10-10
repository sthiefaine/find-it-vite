import { describe, expect, it } from "vitest";
import type { CharacterDetails, CountryLink } from "../../helpers/characters";
import { isCountryLink, validatedCountryLinks } from "../countryLinks";
import { CHARACTER_REGIONS, characterRegions, charactersInRegion, regionsInPool } from "../characterRegions";

const link: CountryLink = { code: "US", relation: "Carrière artistique aux États-Unis ; lien culturel documenté.", sourceUrl: "https://www.grammy.com/artists/example" };
const person = (name: string, countryLinks?: CountryLink[], serie = "celebrity", tags: string[] = []): CharacterDetails => ({ name, label: name, imageSrc: "/portrait.png", color: "brown", family: "brun", serie, tags, ...(countryLinks === undefined ? {} : { countryLinks }) });

describe("liens pays documentés", () => {
  it("conserve une relation culturelle libre sans la transformer en nationalité", () => {
    expect(validatedCountryLinks([{ ...link, relation: `  ${link.relation}  `, untrusted: true }])).toEqual([link]);
  });
  it("reste facultatif pour les catalogues anciens", () => {
    expect(validatedCountryLinks(undefined)).toBeUndefined();
    expect(validatedCountryLinks([])).toEqual([]);
  });
  it.each([
    null, {}, "US", { ...link, code: "us" }, { ...link, code: "USA" }, { ...link, code: "ZZ" }, { ...link, code: "KU" },
    { ...link, relation: " " }, { ...link, relation: "x".repeat(241) },
    { ...link, sourceUrl: "http://example.com" }, { ...link, sourceUrl: "javascript:alert(1)" },
    { ...link, sourceUrl: "https://" }, { ...link, sourceUrl: `https://example.com/${"x".repeat(2048)}` },
  ])("refuse les champs malformés : %j", invalid => {
    expect(isCountryLink(invalid)).toBe(false);
    expect(() => validatedCountryLinks([invalid])).toThrow("liens pays");
  });
});

describe("rattachements pays", () => {
  it("préserve exactement le mapping historique existant, y compris les contributions en France", () => {
    expect(CHARACTER_REGIONS).toEqual({
      "napoleon-bonaparte": ["fr"], "louis-xiv": ["fr"], "jeanne-d-arc": ["fr"], "leonard-de-vinci": ["fr"],
      "francois-ier": ["fr"], "marie-antoinette": ["fr"], "olympe-de-gouges": ["fr"], "victor-hugo": ["fr"],
      "josephine-baker": ["fr", "us"], "rosa-parks": ["us"], "martin-luther-king": ["us"],
    });
    expect(characterRegions(person("josephine-baker", undefined, "history"))).toEqual(["fr", "us"]);
    expect(characterRegions(person("leonard-de-vinci", undefined, "history"))).toEqual(["fr"]);
  });
  it("garde l'ancien pool politique français sans rattacher les nouveaux humains à la France", () => {
    expect(characterRegions(person("ancien-politique", undefined, "politics", ["france"]))).toEqual(["fr"]);
    expect(characterRegions(person("politique-us", [link], "politics", ["france"]))).toEqual(["us"]);
    expect(characterRegions(person("politique-br", [{ ...link, code: "BR" }], "politics", ["france"]))).toEqual(["br"]);
  });
  it("combine plusieurs liens et déduplique les pays sans déduire une origine du nom ou des tags", () => {
    const mixed = person("artiste", [link, { ...link, code: "BR" }, link]);
    const unknown = person("un-nom-francais", undefined, "celebrity", ["france"]);
    expect(characterRegions(mixed)).toEqual(["us", "br"]);
    expect(characterRegions(unknown)).toEqual([]);
    expect(charactersInRegion([unknown, mixed], "US")).toEqual([mixed]);
    expect(regionsInPool([mixed, unknown])).toEqual(["us", "br"]);
  });
  it("ne transforme pas un lien invalide en pays par défaut", () => {
    expect(characterRegions(person("malforme", [{ ...link, code: "XX" }], "politics", ["france"]))).toEqual([]);
  });
});
