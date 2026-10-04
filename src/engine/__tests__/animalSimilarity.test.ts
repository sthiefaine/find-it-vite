import { describe, expect, it } from "vitest";
import type { CharacterDetails } from "../../helpers/characters";
import { animalSimilarity, selectAnimalDecoys } from "../animalSimilarity";
import { createRng } from "../rng";

const animal = (name: string, values: Partial<CharacterDetails> = {}): CharacterDetails => ({
  name, label: name, imageSrc: `/${name}.png`, serie: "animal", color: "white", family: name, ...values,
});

describe("leurres par race et couleurs", () => {
  const wanted = animal("chat-siamois", { species: "Chat", breed: "Siamois", color: "brown", dominantColors: ["brown", "white"] });
  const cat = animal("chat-persan", { species: "chat", breed: "Persan", color: "grey" });
  const cow = animal("vache", { species: "Vache", color: "brown" });
  const sheep = animal("mouton");
  const pool = [wanted, cat, cow, sheep];

  it("privilégie une autre race de la même espèce devant la seule couleur", () => {
    expect(animalSimilarity(wanted, cat)).toBeGreaterThan(animalSimilarity(wanted, cow));
    expect(animalSimilarity(wanted, sheep)).toBeGreaterThan(0);
  });

  it("augmente les sosies avec la difficulté, garde une seule identité cible et reste déterministe", () => {
    const easy = selectAnimalDecoys(wanted, .2, pool, createRng(42));
    const hard = selectAnimalDecoys(wanted, .8, pool, createRng(42));
    expect(hard.filter((c) => c.name === cat.name).length).toBeGreaterThan(easy.filter((c) => c.name === cat.name).length);
    expect(hard.some((c) => c.name === wanted.name)).toBe(false);
    expect(hard).toHaveLength(20);
    expect(hard).toEqual(selectAnimalDecoys(wanted, .8, pool, createRng(42)));
  });

  it("gère les petits catalogues et les anciens sprites sans métadonnées", () => {
    const a = animal("a");
    const b = animal("b");
    expect(selectAnimalDecoys(a, .8, [a, b], createRng(1))).toEqual(Array(20).fill(b));
    expect(selectAnimalDecoys(a, .8, [a], createRng(1))).toEqual([]);
    const unrelated = animal("c", { color: "green" });
    expect(selectAnimalDecoys(a, .8, [a, unrelated], createRng(1))).toEqual(Array(20).fill(unrelated));
  });
});
