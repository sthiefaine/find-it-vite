import { describe, expect, it } from "vitest";
import { animalConfusionRisk, animalSimilarity } from "../animalSimilarity";
import type { CharacterDetails } from "../../helpers/characters";

const animal = (name: string): CharacterDetails => ({ name, label: name, imageSrc: "", serie: "animal", color: "brown", family: name, species: name, dominantColors: ["brown"], tags: [] });
describe("profil visuel réutilisé", () => {
  it("suit les éditions des champs et des tableaux sans modifier les portraits", () => {
    const cat = animal("chat"), edited = animal("autre");
    expect(animalConfusionRisk(cat, edited)).toBe(0);
    edited.species = "chat";
    expect(animalConfusionRisk(cat, edited)).toBe(3);
    edited.species = "autre";
    edited.tags!.push("felins");
    expect(animalConfusionRisk(cat, edited)).toBe(1);
    const before = animalSimilarity(cat, edited);
    edited.dominantColors![0] = "blue";
    expect(animalSimilarity(cat, edited)).toBe(before - 1);
    edited.tags!.splice(0, 1);
    expect(animalConfusionRisk(cat, edited)).toBe(0);
    expect(cat.dominantColors).toEqual(["brown"]);
  });
});
