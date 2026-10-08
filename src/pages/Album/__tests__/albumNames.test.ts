import { describe, expect, it } from "vitest";
import { animalsPack, historyPack, peoplePack } from "../../../helpers/characters";
import { WORLDS } from "../../../content/worlds";
import { LANGUAGES, localeTag } from "../../../i18n/locales";
import { messages } from "../../../i18n/messages";
import { albumCharacterLabel, albumLabelKey, sortedAlbumEntries } from "../albumNames";

const animal = (name: string) => animalsPack.find(character => character.name === name)!;

describe("album names and alphabetical order", () => {
  it("completes breed-only names and preserves names that already identify the animal", () => {
    expect(albumCharacterLabel(animal("chat-sphynx"), "fr")).toBe("Chat Sphynx");
    expect(albumCharacterLabel(animal("chat-siamois"), "fr")).toBe("Chat Siamois");
    expect(albumCharacterLabel(animal("chien-husky"), "fr")).toBe("Chien Husky");
    expect(albumLabelKey(animal("chat-ragdoll"))).toBe("Chat Ragdoll");
    expect(albumLabelKey(animal("mouton-merinos"))).toBe("Mouton Mérinos");
    expect(albumLabelKey(animal("ours"))).toBe("Ours brun");
    expect(albumLabelKey(animal("requin-marteau"))).toBe("Requin-marteau");
    expect(albumLabelKey(animal("poney-shetland"))).toBe("Poney Shetland");
    expect(albumLabelKey(peoplePack[0])).toBe(peoplePack[0].label);
  });

  it("groups all cats and dogs by their complete French names", () => {
    const names = sortedAlbumEntries(animalsPack, "fr").map(entry => entry.label);
    for (const species of ["Chat", "Chien"]) {
      const group = names.filter(name => name === species || name.startsWith(`${species} `));
      expect(group).toHaveLength(animalsPack.filter(character => character.species === species.toLowerCase()).length);
      const first = names.indexOf(group[0]);
      expect(names.slice(first, first + group.length)).toEqual(group);
    }
    expect(names.indexOf("Chat Sphynx")).toBeLessThan(names.indexOf("Chien"));
  });

  it("sorts by the displayed translation in every language and every collection", () => {
    for (const language of LANGUAGES) {
      const collator = new Intl.Collator(localeTag(language.code), { sensitivity: "base", numeric: true });
      for (const characters of [...WORLDS.map(world => world.characters), peoplePack, historyPack]) {
        const entries = sortedAlbumEntries(characters, language.code);
        expect(entries).toHaveLength(characters.length);
        for (let index = 1; index < entries.length; index++) {
          expect(collator.compare(entries[index - 1].label, entries[index].label)).toBeLessThanOrEqual(0);
        }
      }
    }
    expect(albumCharacterLabel(animal("chat-sphynx"), "en")).toBe("Sphynx cat");
    expect(albumCharacterLabel(animal("chat-sphynx"), "zh")).toBe("斯芬克斯猫");
  });

  it("translates all completed names without changing the catalogue or save identifiers", () => {
    const original = animalsPack.map(character => ({ ...character }));
    for (const character of animalsPack) {
      expect(messages[albumLabelKey(character)], character.name).toHaveLength(LANGUAGES.length);
    }
    const sorted = sortedAlbumEntries(animalsPack, "fr");
    expect(animalsPack).toEqual(original);
    expect(sorted.map(entry => entry.character.name).sort()).toEqual(original.map(character => character.name).sort());
    expect(animal("chat-sphynx").label).toBe("Sphynx");
  });
});
