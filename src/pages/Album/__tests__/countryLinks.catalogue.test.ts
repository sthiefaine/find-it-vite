import { describe, expect, it } from "vitest";
import { animalsPack } from "../../../helpers/characters";
import { ALBUM_COLLECTIONS } from "../albumLogic";

describe("nouveaux portraits dans l'album", () => {
  it("affiche tous les animaux publiés même si l'Aventure garde son ancien pool", () => {
    const albumIds = new Set(ALBUM_COLLECTIONS.find(collection => collection.id === "animaux")!.characters.map(character => character.name));
    expect(animalsPack.every(animal => albumIds.has(animal.name))).toBe(true);
  });
});
