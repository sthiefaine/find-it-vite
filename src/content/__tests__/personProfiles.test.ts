import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { historyPack, peoplePack } from "../../helpers/characters";
import profiles from "../personProfiles.json";
import catalog from "../../../content/sprites/catalog.json";

describe("fiches des personnalités dans l’album", () => {
  it("associe une description sourcée à chaque portrait historique et politique", () => {
    const people = [...historyPack, ...peoplePack];
    expect(people.length).toBeGreaterThanOrEqual(65);
    expect(new Set(people.map(person => person.name)).size).toBe(people.length);
    expect(Object.keys(profiles).sort()).toEqual(people.map(person => person.name).sort());
    for (const person of people) {
      expect(person.profile?.description.length, person.name).toBeGreaterThan(60);
      expect(person.profile?.source.label, person.name).toBeTruthy();
      expect(new URL(person.profile!.source.url).protocol, person.name).toBe("https:");
    }
  });
  it("publie les portraits historiques avec une période et un fichier présent", () => {
    for (const person of historyPack) {
      expect(person.profile?.period, person.name).toBeTruthy();
      expect(person.serie).toBe("history");
      expect(existsSync(`public${person.imageSrc}`), person.name).toBe(true);
      expect(catalog.sprites.find(sprite => sprite.id === person.name)).toMatchObject({ themeId: "histoire", status: "ready", source: person.detailImageSrc });
    }
  });
});
