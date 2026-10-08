import { describe, expect, it, vi } from "vitest";
import { animalsPack } from "../../helpers/characters";
import type { CharacterDetails } from "../../helpers/characters";
import { animalConfusionRisk, animalSimilarity, selectAnimalDecoys } from "../animalSimilarity";
import type { DecoyProgression } from "../animalSimilarity";
import { lookalikeRatio, slotOf, visualConfusionBudget } from "../curve";
import { generateLevel, wantedAt } from "../generateLevel";
import { createRng } from "../rng";
import type { GenContext, Tier } from "../types";
import * as validation from "../validate";

const animal = (name: string, values: Partial<CharacterDetails> = {}): CharacterDetails => ({
  name, label: name, imageSrc: `/${name}.png`, serie: "animal", color: "white", family: name, ...values,
});

const wanted = animal("chat-siamois", { species: "Chat", breed: "Siamois", color: "brown", dominantColors: ["brown", "white"] });
const closeCat = animal("chat-maine-coon", { species: "chat", breed: "Maine Coon", color: "brown", dominantColors: ["brown", "white"] });
const contrastCat = animal("chat-british-shorthair", { species: "chat", breed: "British Shorthair", color: "grey" });
const tiger = animal("tigre", { species: "tigre", color: "orange" });
const cow = animal("vache", { species: "Vache", color: "brown" });
const pig = animal("cochon", { species: "cochon", color: "pink" });
const sheep = animal("mouton");
const pool = [wanted, closeCat, contrastCat, tiger, cow, pig, sheep];
const stage = (index: number, tier: Tier = "normal"): DecoyProgression => ({ index, tier });
const select = (index: number, tier: Tier = "normal", ratio = 1) => selectAnimalDecoys(wanted, ratio, pool, createRng(42), stage(index, tier));
const riskCount = (decoys: CharacterDetails[], risk: number) => decoys.filter((animal) => animalConfusionRisk(wanted, animal) === risk).length;

describe("ressemblance et risque de confusion", () => {
  it("privilégie une autre race de la même espèce devant la seule couleur", () => {
    expect(animalSimilarity(wanted, contrastCat)).toBeGreaterThan(animalSimilarity(wanted, cow));
    expect(animalSimilarity(wanted, sheep)).toBeGreaterThan(0);
    expect(animalConfusionRisk(wanted, cow)).toBe(0);
    expect(animalConfusionRisk(wanted, tiger)).toBe(1);
    expect(animalConfusionRisk(wanted, contrastCat)).toBe(2);
    expect(animalConfusionRisk(wanted, closeCat)).toBe(3);
  });

  it("reconnaît les paires proches même sans métadonnées ou avec une couleur différente", () => {
    const pairs = [
      [animal("guepard", { color: "yellow" }), animal("leopard", { color: "brown" })],
      [animal("coq"), animal("poule", { color: "orange" })],
      [animal("loup"), animal("chien-husky", { color: "grey" })],
      [animal("ocean-baleine"), animal("ocean-rorqual")],
      [animal("chat"), animal("chat-siamois", { color: "white" })],
    ];
    for (const [a, b] of pairs) {
      expect(animalConfusionRisk(a, b)).toBe(3);
      expect(animalConfusionRisk(b, a)).toBe(3);
    }
    expect(animalConfusionRisk(animal("a", { species: " Guépard " }), animal("b", { species: "LÉOPARD" }))).toBe(3);
    // Les taches seules ne rendent pas la girafe confondable avec un léopard.
    expect(animalConfusionRisk(animal("girafe", { family: "tachete" }), animal("leopard", { family: "tachete" }))).toBe(0);
  });
});

describe("budget progressif de leurres", () => {
  it("exclut aussi la deuxième race la plus ressemblante au début, quel que soit le ratio demandé", () => {
    expect(animalSimilarity(wanted, closeCat)).toBeGreaterThan(animalSimilarity(wanted, contrastCat));
    for (let index = 1; index <= 8; index++) {
      for (const ratio of [0, .5, 1]) {
        expect(select(index, "normal", ratio).every((candidate) => animalConfusionRisk(wanted, candidate) === 0)).toBe(true);
      }
    }
    expect(select(200, "normal", 0).every((candidate) => animalConfusionRisk(wanted, candidate) === 0)).toBe(true);
  });

  it.each([
    ["easy", 15, 36, 71], ["normal", 9, 21, 41], ["expert", 5, 13, 25],
  ] as const)("introduit chaque risque à une place sur vingt en %s", (tier, relatedAt, breedAt, closeAt) => {
    for (const [risk, at] of [[1, relatedAt], [2, breedAt], [3, closeAt]]) {
      expect(riskCount(select(at - 1, tier), risk)).toBe(0);
      expect(riskCount(select(at, tier), risk)).toBe(1);
      expect(riskCount(select(at + 60, tier), risk)).toBeGreaterThan(1);
    }
  });

  it("augmente les plafonds sans que les boss sautent une étape", () => {
    for (const tier of ["easy", "normal", "expert"] as const) {
      let previous = visualConfusionBudget(1, tier);
      for (let index = 2; index <= 200; index++) {
        const budget = visualConfusionBudget(index, tier);
        for (const kind of ["related", "breed", "close"] as const) expect(budget[kind]).toBeGreaterThanOrEqual(previous[kind]);
        const rho = lookalikeRatio(index, tier, "boss");
        expect(rho).toBeLessThanOrEqual(budget.related + budget.breed + budget.close);
        const decoys = select(index, tier, rho);
        for (const [risk, cap] of [[1, budget.related], [2, budget.breed], [3, budget.close]]) {
          expect(riskCount(decoys, risk)).toBeLessThanOrEqual(Math.floor(cap * 20 + 1e-9));
        }
        previous = budget;
      }
    }
    expect(riskCount(select(10), 2)).toBe(0);
    expect(riskCount(select(20), 2)).toBe(0);
    expect(riskCount(select(30), 3)).toBe(0);
    expect(riskCount(select(40), 3)).toBe(0);
  });

  it("ne remplace pas une catégorie absente par davantage de quasi-sosies", () => {
    const onlyCloseOrDistinct = [wanted, closeCat, cow, pig];
    const decoys = selectAnimalDecoys(wanted, 1, onlyCloseOrDistinct, createRng(42), stage(41));
    expect(riskCount(decoys, 3)).toBe(1);
    expect(riskCount(decoys, 0)).toBe(19);
  });

  it("reste déterministe, pondéré, sans la cible et à l'intérieur du pool fourni", () => {
    const hard = select(100, "expert", .8);
    expect(hard).toEqual(select(100, "expert", .8));
    expect(hard).toHaveLength(20);
    expect(hard.some((candidate) => candidate.name === wanted.name)).toBe(false);
    expect(hard.every((candidate) => pool.includes(candidate))).toBe(true);
    expect(new Set(hard.map((candidate) => candidate.species)).size).toBeGreaterThanOrEqual(3);
    expect(riskCount(hard, 3)).toBeGreaterThan(riskCount(select(41, "expert", .8), 3));
  });

  it("gère les anciens sprites et choisit le moins risqué dans un petit pool de races", () => {
    const a = animal("a");
    const b = animal("b");
    expect(selectAnimalDecoys(a, .8, [a, b], createRng(1), stage(1))).toEqual(Array(20).fill(b));
    expect(selectAnimalDecoys(a, .8, [a], createRng(1), stage(1))).toEqual([]);
    const unrelated = animal("c", { color: "green" });
    expect(selectAnimalDecoys(a, .8, [a, unrelated], createRng(1), stage(1))).toEqual(Array(20).fill(unrelated));
    const breeds = [wanted, closeCat, contrastCat];
    const first = selectAnimalDecoys(wanted, 1, breeds, createRng(1), stage(1));
    expect(first).toEqual(Array(20).fill(contrastCat));
    expect(first).toEqual(selectAnimalDecoys(wanted, 1, breeds, createRng(1), stage(1)));
    expect(selectAnimalDecoys(wanted, 1, breeds, createRng(1), stage(41))).toContain(closeCat);
  });
});

describe("intégration au générateur", () => {
  const context = (seed: number, tier: Tier = "normal", candidates = animalsPack): GenContext => ({
    seed, tier, pool: candidates, allowedRules: ["classic"], allowedModifiers: ["lookalikes"],
  });

  it("ne mélange ni chat et race de chat, ni guépard et léopard dans les niveaux 1 à 8 normaux", () => {
    for (let index = 1; index <= 8; index++) {
      const remaining = new Set(["chat", "guepard", "leopard"]);
      // Retrouver chaque cible dans le catalogue réel, quelle que soit sa taille.
      for (let seed = 0; seed < 10_000 && remaining.size; seed++) {
        const ctx = context(seed);
        if (!remaining.has(wantedAt(index, ctx).name)) continue;
        const spec = generateLevel(index, ctx);
        remaining.delete(spec.wanted.name);
        expect(spec.decoys.every((candidate) => animalConfusionRisk(spec.wanted, candidate) === 0)).toBe(true);
        expect(spec.lookalikeRatio).toBe(0);
        expect(spec.budget).toBeDefined();
      }
      expect([...remaining]).toEqual([]);
    }
  });

  it("les pics respectent les dates d'introduction avec le catalogue réel", () => {
    for (const tier of ["easy", "normal", "expert"] as const) {
      for (const seed of [1, 42, 2026]) {
        const ctx = context(seed, tier);
        for (let index = 1; index <= 150; index++) {
          const spec = generateLevel(index, ctx);
          const budget = visualConfusionBudget(index, tier);
          const limits = [1, budget.related, budget.breed, budget.close];
          for (const candidate of spec.decoys) expect(limits[animalConfusionRisk(spec.wanted, candidate)]).toBeGreaterThan(0);
          expect(spec.decoys.some((candidate) => candidate.name === spec.wanted.name)).toBe(false);
          expect(spec.budget).toBeDefined();
          expect(validation.validateSpec(spec, ctx).ok).toBe(true);
          expect(spec.slot).toBe(slotOf(index));
        }
      }
    }
  });

  it("joue un pool de seulement trois races sans ajout d'animal, même au premier niveau", () => {
    const breeds = [wanted, closeCat, contrastCat];
    const ctx = context(42, "normal", breeds);
    for (const index of [1, 2, 3, 8, 20, 40, 80, 2000]) {
      const spec = generateLevel(index, ctx);
      expect(spec).toEqual(generateLevel(index, ctx));
      expect(validation.validateSpec(spec, ctx).ok).toBe(true);
      expect([spec.wanted, ...spec.decoys].every((candidate) => breeds.includes(candidate))).toBe(true);
      expect(spec.decoys.some((candidate) => candidate.name === spec.wanted.name)).toBe(false);
    }
  });

  it("n'introduit pas de sosies lorsque le modificateur est désactivé ni dans le repli de secours", () => {
    for (const index of [10, 40, 80, 200]) {
      const spec = generateLevel(index, { ...context(42), allowedModifiers: [] });
      expect(spec.decoys.every((candidate) => animalConfusionRisk(spec.wanted, candidate) === 0)).toBe(true);
    }
    const mock = vi.spyOn(validation, "validateSpec").mockReturnValue({ ok: false, errors: ["échec simulé"] });
    try {
      const spec = generateLevel(1, context(42));
      expect(spec.budget).toBeUndefined();
      expect(spec.decoys.every((candidate) => animalConfusionRisk(spec.wanted, candidate) === 0)).toBe(true);
    } finally {
      mock.mockRestore();
    }
  });
});
