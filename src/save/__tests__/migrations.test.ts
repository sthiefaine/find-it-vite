import { describe, expect, it } from "vitest";
import { isFutureVersion, migrate } from "../migrations";
import { defaultSave, SAVE_VERSION } from "../schema";

describe("migrate", () => {
  it("donne la sauvegarde par défaut si rien n'est lisible", () => {
    for (const raw of [null, undefined, "", "{pas du json", "42", "[]", 12, { foo: 1 }, { version: "1" }]) {
      expect(migrate(raw)).toEqual(defaultSave());
    }
  });

  it("migre une sauvegarde v1 jusqu'à v3, en chaîne ou en objet, sans profil choisi", () => {
    const v1 = {
      version: 1,
      settings: { sound: false },
      progress: { bestScore: 12, bestLevel: 7, gamesPlayed: 3, totalFound: 20 },
    };
    const expected = { ...v1, version: 3, profile: { tier: null }, seenMechanics: [] };
    expect(migrate(v1)).toEqual(expected);
    expect(migrate(JSON.stringify(v1))).toEqual(expected);
  });

  it("une v1 qui contenait déjà un champ profile repart sans profil", () => {
    const v1 = { version: 1, settings: { sound: true }, progress: {}, profile: { tier: "expert" } };
    expect(migrate(v1).profile).toEqual({ tier: null });
  });

  it("relit une sauvegarde v3 valide avec son profil", () => {
    for (const tier of ["easy", "normal", "expert"] as const) {
      const save = { ...defaultSave(), profile: { tier } };
      expect(migrate(JSON.stringify(save))).toEqual(save);
    }
  });

  it("migre une v2 en v3 sans mécanique vue, en gardant le reste", () => {
    const v2 = {
      version: 2,
      settings: { sound: false },
      progress: { bestScore: 21, bestLevel: 18, gamesPlayed: 5, totalFound: 60 },
      profile: { tier: "expert" },
    };
    const expected = { ...v2, version: 3, seenMechanics: [] };
    expect(migrate(v2)).toEqual(expected);
    expect(migrate(JSON.stringify(v2))).toEqual(expected);
  });

  it("une v2 qui contenait déjà seenMechanics repart de zéro", () => {
    const v2 = { version: 2, settings: { sound: true }, progress: {}, seenMechanics: ["rule:memory"] };
    expect(migrate(v2).seenMechanics).toEqual([]);
  });

  it("relit les mécaniques vues d'une v3 et nettoie les valeurs invalides", () => {
    const save = { ...defaultSave(), seenMechanics: ["layout:grid", "rule:findAll"] };
    expect(migrate(JSON.stringify(save))).toEqual(save);
    expect(
      migrate({ ...defaultSave(), seenMechanics: ["layout:grid", 3, null, "", "layout:grid", "rule:memory"] })
        .seenMechanics
    ).toEqual(["layout:grid", "rule:memory"]);
    for (const seenMechanics of [null, "layout:grid", { a: 1 }, undefined]) {
      expect(migrate({ ...defaultSave(), seenMechanics }).seenMechanics).toEqual([]);
    }
  });

  it("ignore un profil inconnu", () => {
    for (const profile of [{ tier: "bébé" }, { tier: 3 }, "expert", null]) {
      expect(migrate({ ...defaultSave(), profile }).profile).toEqual({ tier: null });
    }
  });

  it("répare les champs abîmés sans perdre les bons", () => {
    const result = migrate({
      version: 3,
      settings: { sound: "oui" },
      progress: { bestScore: 9, bestLevel: -2, gamesPlayed: NaN, totalFound: 4.7 },
    });
    expect(result.settings.sound).toBe(true);
    expect(result.progress).toEqual({ bestScore: 9, bestLevel: 1, gamesPlayed: 0, totalFound: 4 });
  });

  it("lit au mieux une version future et la signale", () => {
    const future = JSON.stringify({
      version: SAVE_VERSION + 1,
      settings: { sound: false },
      progress: { bestScore: 30 },
      profils: [{ nom: "Léa" }],
    });
    expect(isFutureVersion(future)).toBe(true);
    expect(migrate(future).progress.bestScore).toBe(30);
    expect(migrate(future).version).toBe(SAVE_VERSION);
    expect(isFutureVersion(JSON.stringify(defaultSave()))).toBe(false);
  });
});
