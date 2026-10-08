import { describe, expect, it } from "vitest";
import { ACCESSORIES } from "../../../../content/accessories";
import type { LevelSpec } from "../../../../engine/types";
import { wantedClue } from "../wantedClue";

describe("indice de l'avis dans une foule de sosies", () => {
  it("décrit la tenue de la cible pour chaque formation habillée", () => {
    for (const species of ["same", "two"] as const) {
      for (const dress of ["single", "mixed"] as const) {
        for (const accessory of ACCESSORIES) {
          const spec = { rule: "classic" as const, crowdVariant: { species, dress }, accessories: { target: accessory.id, decoyChance: 1 } };
          expect(wantedClue(spec)?.toLocaleLowerCase("fr")).toContain(accessory.label.toLocaleLowerCase("fr"));
        }
      }
    }
  });

  it("cherche le personnage sans tenue quand tous les leurres sont habillés", () => {
    for (const species of ["same", "two"] as const) {
      expect(wantedClue({ rule: "classic", crowdVariant: { species, dress: "bare" }, accessories: { target: null, decoyChance: 1 } })).toBe("Sans accessoire");
    }
  });

  it("n'invente aucun indice pour les autres objectifs ou une tenue absente", () => {
    expect(wantedClue(null)).toBeUndefined();
    expect(wantedClue({ rule: "classic" })).toBeUndefined();
    expect(wantedClue({ rule: "classic", crowdVariant: { species: "same", dress: "single" } })).toBeUndefined();
    for (const rule of ["memory", "silhouette", "findAll", "goldRush", "oddOneOut"] as LevelSpec["rule"][]) {
      expect(wantedClue({ rule, crowdVariant: { species: "same", dress: "single" }, accessories: { target: "moustache", decoyChance: 1 } })).toBeUndefined();
    }
  });
});
