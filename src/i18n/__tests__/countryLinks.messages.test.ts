import { describe, expect, it } from "vitest";
import { countryMessages } from "../countryMessages";
import { LANGUAGES } from "../locales";

describe("traductions pays", () => {
  it("fournit chaque libellé dans les dix langues du jeu", () => {
    expect(LANGUAGES.map(language => language.code)).toEqual(["fr", "en", "pt_BR", "es", "it", "ru", "ku", "ckb", "zh", "de"]);
    for (const [key, translations] of Object.entries(countryMessages)) {
      expect(translations, key).toHaveLength(LANGUAGES.length);
      expect(translations[0], key).toBe(key);
      expect(translations.every(value => value.trim().length > 0), key).toBe(true);
      for (const translation of translations) expect(translation.match(/{{\w+}}/g) ?? [], key).toEqual(key.match(/{{\w+}}/g) ?? []);
    }
  });
  it("utilise un libellé de lien géographique sans présumer la nationalité", () => {
    expect(countryMessages["Tous les pays"][1]).toBe("All countries");
    expect(countryMessages["Célébrités · {{country}}"][1]).toBe("Celebrities · {{country}}");
    expect(countryMessages["Des portraits liés à ce pays."][1]).toBe("Portraits connected to this country.");
  });
});
