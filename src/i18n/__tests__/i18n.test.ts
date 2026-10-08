import { headerTitle } from "../../components/Headers/headerNav";
import { animalsPack } from "../../helpers/characters";
import { SCENES, ADVANCED_SCENES } from "../../content/scenes";
import { PLAY_THEMES } from "../../content/playThemes";
import { FRAMES } from "../../content/progress";
import { WORLDS } from "../../content/worlds";
import { ANIMAL_CATEGORIES, ANIMAL_COLORS, ANIMAL_SPECIES } from "../../content/animalTaxonomy";
import { afterEach, describe, expect, it } from "vitest";
import { translateFor } from "../index";
import { LANGUAGES, localeDirection } from "../locales";
import { messages } from "../messages";
import { createLanguageStore, LANGUAGE_KEY, useLanguageStore } from "../store";
import { createMemoryStorage } from "../../save/storage";
import { formatDailyDate } from "../format";
import { formatSeconds, scoreMessage } from "../../components/Results/resultsHelpers";
import { dailyShareText } from "../../game/modes";

afterEach(() => useLanguageStore.setState({ locale: "fr" }));

describe("translation catalog", () => {
  it("includes every language and preserves interpolation parameters", () => {
    for (const [key, translations] of Object.entries(messages)) {
      expect(translations, key).toHaveLength(LANGUAGES.length);
      const parameters = [...key.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort();
      for (const translation of translations) {
        expect(translation.trim(), key).not.toBe("");
        for (const form of translation.split("|")) {
          expect([...form.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort(), key).toEqual(parameters);
        }
      }
    }
  });

  it("covers dynamic labels in the active catalog and adventure map", () => {
    const labels = [
      ...["/adventure", "/album", "/options", "/duel", "/multiplayer", "/play"].map(route => headerTitle(route)!),
      ...animalsPack.flatMap(animal => [animal.label, ...(animal.breed ? [animal.breed] : [])]),
      ...WORLDS.flatMap(world => [world.name, ...world.characters.map(character => character.label)]),
      ...[...SCENES, ...ADVANCED_SCENES].map(scene => scene.name),
      ...PLAY_THEMES.flatMap(theme => [theme.label, theme.description]),
      ...FRAMES.map(frame => frame.name),
      ...Object.values(ANIMAL_CATEGORIES), ...Object.values(ANIMAL_SPECIES),
      ...Object.values(ANIMAL_COLORS).map(color => color.label),
    ];
    for (const label of labels) expect(messages[label], label).toBeDefined();
  });

  it("selects French, English and Russian plurals", () => {
    expect(translateFor("fr", "{{count}} étoiles", { count: 1 })).toBe("1 étoile");
    expect(translateFor("en", "{{count}} étoiles", { count: 2 })).toBe("2 stars");
    expect(translateFor("en", "points", { count: 0 })).toBe("points");
    expect(translateFor("en", "points", { count: 1 })).toBe("point");
    expect(translateFor("ru", "points", { count: 2 })).toBe("очка");
    expect(translateFor("ru", "{{count}} étoiles", { count: 1 })).toBe("1 звезда");
    expect(translateFor("ru", "{{count}} étoiles", { count: 2 })).toBe("2 звезды");
    expect(translateFor("ru", "{{count}} étoiles", { count: 5 })).toBe("5 звёзд");
    expect(translateFor("ru", "{{count}} étoiles", { count: 21 })).toBe("21 звезда");
  });

  it("supports both Kurdish variants and RTL only for Sorani", () => {
    expect(translateFor("ku", "Jouer")).toBe("Bileyize");
    expect(translateFor("ckb", "Jouer")).toBe("یاری بکە");
    expect(localeDirection("ckb")).toBe("rtl");
    expect(localeDirection("ku")).toBe("ltr");
  });

  it("keeps unknown names intact and substitutes values literally", () => {
    expect(translateFor("zh", "Emmanuel Macron")).toBe("Emmanuel Macron");
    expect(translateFor("en", "{{name}} a gagné !", { name: "$& {{other}}" })).toBe("$& {{other}} won!");
  });

  it("localizes scores, dates and share text", () => {
    useLanguageStore.setState({ locale: "en" });
    expect(formatSeconds(830)).toBe("0.8 s");
    expect(scoreMessage(0)).toBe("You can do it!");
    expect(formatDailyDate("2026-10-08")).toBe("08/10");
    expect(dailyShareText("2026-10-08", 2)).toBe("Find It – 08/10 challenge: 2 found!");
    useLanguageStore.setState({ locale: "fr" });
    expect(dailyShareText("2026-10-08", 1)).toBe("Find It – Défi du 08/10 : 1 trouvé !");
  });
});

describe("language persistence", () => {
  it("restores a selection without touching player progress", async () => {
    const storage = createMemoryStorage({ [LANGUAGE_KEY]: "pt_BR", "find-it:save": "progress" });
    const store = createLanguageStore(storage);
    await store.getState().load();
    expect(store.getState().locale).toBe("pt_BR");
    store.getState().setLocale("ckb");
    await store.getState().flush();
    expect(storage.data.get(LANGUAGE_KEY)).toBe("ckb");
    expect(storage.data.get("find-it:save")).toBe("progress");
  });

  it("ignores invalid stored locales", async () => {
    const store = createLanguageStore(createMemoryStorage({ [LANGUAGE_KEY]: "invalid" }));
    await store.getState().load();
    expect(store.getState().locale).toBe("fr");
  });

  it("does not overwrite a user selection while restoring storage", async () => {
    let resolveRead!: (value: string) => void;
    const store = createLanguageStore({
      get: () => new Promise(resolve => { resolveRead = resolve; }),
      set: async () => undefined,
      remove: async () => undefined,
    });
    const loaded = store.getState().load();
    store.getState().setLocale("de");
    resolveRead("en");
    await loaded;
    expect(store.getState().locale).toBe("de");
  });

  it("persists the last of several rapid changes and tolerates unavailable storage", async () => {
    const storage = createMemoryStorage();
    const store = createLanguageStore(storage);
    for (const language of LANGUAGES) store.getState().setLocale(language.code);
    await store.getState().flush();
    expect(storage.data.get(LANGUAGE_KEY)).toBe("de");
    const unavailable = createLanguageStore({ get: async () => { throw Error("blocked"); }, set: async () => { throw Error("blocked"); }, remove: async () => undefined });
    await unavailable.getState().load();
    unavailable.getState().setLocale("es");
    await unavailable.getState().flush();
    expect(unavailable.getState().locale).toBe("es");
  });
});
