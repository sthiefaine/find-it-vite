import { describe, expect, it } from "vitest";
import { isFutureVersion, migrate } from "../migrations";
import { defaultSave, SAVE_VERSION } from "../schema";

describe("migrate", () => {
  it("donne la sauvegarde par défaut si rien n'est lisible", () => {
    for (const raw of [null, undefined, "", "{pas du json", "42", "[]", 12, { foo: 1 }, { version: "1" }]) {
      expect(migrate(raw)).toEqual(defaultSave());
    }
  });

  it("relit une sauvegarde v1 valide, en chaîne ou en objet", () => {
    const save = {
      version: 1,
      settings: { sound: false },
      progress: { bestScore: 12, bestLevel: 7, gamesPlayed: 3, totalFound: 20 },
    };
    expect(migrate(save)).toEqual(save);
    expect(migrate(JSON.stringify(save))).toEqual(save);
  });

  it("répare les champs abîmés sans perdre les bons", () => {
    const result = migrate({
      version: 1,
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
