import { describe, expect, it } from "vitest";
import { animalsPack } from "../../helpers/characters";
import { defaultSave } from "../../save/schema";
import { isAnimalUnlocked, STARTER_ANIMAL_IDS, unlockedAnimals } from "../unlockedAnimals";

describe("animaux débloqués", () => {
  it("offre exactement cinq animaux au départ sans inventer de captures", () => {
    const save = defaultSave();
    expect(unlockedAnimals(save).map((animal) => animal.name).sort()).toEqual([...STARTER_ANIMAL_IDS].sort());
    expect(save.collection).toEqual({});
    expect(save.progress.totalFound).toBe(0);
    expect(isAnimalUnlocked(save, "vache")).toBe(true);
    expect(isAnimalUnlocked(save, "vache-normande")).toBe(false);
  });

  it("réutilise les captures des anciennes sauvegardes sans migration ni modification", () => {
    const save = { collection: { panda: 3, serpent: 1, renard: 0, tigre: -1 } };
    const before = JSON.stringify(save);
    const ids = unlockedAnimals(save).map((animal) => animal.name);
    expect(ids).toEqual(animalsPack.filter((animal) => [...STARTER_ANIMAL_IDS, "panda", "serpent"].includes(animal.name)).map((animal) => animal.name));
    expect(JSON.stringify(save)).toBe(before);
    expect(unlockedAnimals({}).map((animal) => animal.name)).toEqual(unlockedAnimals(defaultSave()).map((animal) => animal.name));
  });

  it("débloque chaque portrait séparément et ignore les identifiants absents du catalogue", () => {
    const save = { collection: { "vache-normande": 1, "ancien-animal-retire": 12 } };
    expect(isAnimalUnlocked(save, "vache-normande")).toBe(true);
    expect(isAnimalUnlocked(save, "vache-highland")).toBe(false);
    const pool = animalsPack.filter((animal) => ["chat", "vache", "vache-normande", "vache-highland"].includes(animal.name));
    expect(unlockedAnimals(save, pool).map((animal) => animal.name)).toEqual(pool.filter((animal) => animal.name !== "vache-highland").map((animal) => animal.name));
    expect(unlockedAnimals(save).some((animal) => animal.name === "ancien-animal-retire")).toBe(false);
    expect(unlockedAnimals(save, [])).toEqual([]);
  });
});
