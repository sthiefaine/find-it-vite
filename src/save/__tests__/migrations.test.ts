import { describe, expect, it } from "vitest";
import { isFutureVersion, migrate } from "../migrations";
import { defaultSave, SAVE_VERSION } from "../schema";

// Champs ajoutés par la v4, tels qu'une migration les crée
const V4_EXTRA = { adventure: { stars: {} }, collection: {}, daily: null };
const v4Settings = (sound: boolean) => ({ sound, calm: false, frame: "classic" });

describe("migrate", () => {
  it("donne la sauvegarde par défaut si rien n'est lisible", () => {
    for (const raw of [null, undefined, "", "{pas du json", "42", "[]", 12, { foo: 1 }, { version: "1" }]) {
      expect(migrate(raw)).toEqual(defaultSave());
    }
  });

  it("migre une sauvegarde v1 jusqu'à v4, en chaîne ou en objet, sans profil choisi", () => {
    const v1 = {
      version: 1,
      settings: { sound: false },
      progress: { bestScore: 12, bestLevel: 7, gamesPlayed: 3, totalFound: 20 },
    };
    const expected = {
      ...v1,
      ...V4_EXTRA,
      version: 4,
      settings: v4Settings(false),
      profile: { tier: null },
      seenMechanics: [],
    };
    expect(migrate(v1)).toEqual(expected);
    expect(migrate(JSON.stringify(v1))).toEqual(expected);
  });

  it("une v1 qui contenait déjà un champ profile repart sans profil", () => {
    const v1 = { version: 1, settings: { sound: true }, progress: {}, profile: { tier: "expert" } };
    expect(migrate(v1).profile).toEqual({ tier: null });
  });

  it("relit une sauvegarde v4 valide avec son profil", () => {
    for (const tier of ["easy", "normal", "expert"] as const) {
      const save = { ...defaultSave(), profile: { tier } };
      expect(migrate(JSON.stringify(save))).toEqual(save);
    }
  });

  it("migre une v2 en v4 sans mécanique vue, en gardant le reste", () => {
    const v2 = {
      version: 2,
      settings: { sound: false },
      progress: { bestScore: 21, bestLevel: 18, gamesPlayed: 5, totalFound: 60 },
      profile: { tier: "expert" },
    };
    const expected = { ...v2, ...V4_EXTRA, version: 4, settings: v4Settings(false), seenMechanics: [] };
    expect(migrate(v2)).toEqual(expected);
    expect(migrate(JSON.stringify(v2))).toEqual(expected);
  });

  it("une v2 qui contenait déjà seenMechanics repart de zéro", () => {
    const v2 = { version: 2, settings: { sound: true }, progress: {}, seenMechanics: ["rule:memory"] };
    expect(migrate(v2).seenMechanics).toEqual([]);
  });

  it("relit les mécaniques vues d'une v4 et nettoie les valeurs invalides", () => {
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
      version: 4,
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

  it("migre une v3 en v4 : calme désactivé, cadre classique, Aventure et collection vides", () => {
    const v3 = {
      version: 3,
      settings: { sound: false },
      progress: { bestScore: 7, bestLevel: 5, gamesPlayed: 2, totalFound: 9 },
      profile: { tier: "easy" },
      seenMechanics: ["layout:grid"],
      collection: { chat: 5 }, // champ v4 présent par erreur dans une v3 : ignoré
    };
    expect(migrate(JSON.stringify(v3))).toEqual({
      ...v3,
      ...V4_EXTRA,
      version: 4,
      settings: v4Settings(false),
    });
  });

  it("relit les champs v4 et nettoie les valeurs invalides", () => {
    const save = {
      ...defaultSave(),
      settings: { sound: true, calm: true, frame: "gold" },
      adventure: { stars: { "ocean:3": 2, "animaux:1": 3 } },
      collection: { chat: 4, "ocean-requin": 1 },
      daily: { date: "2026-10-03", best: 12, played: 3 },
    };
    expect(migrate(JSON.stringify(save))).toEqual(save);

    const messy = migrate({
      ...defaultSave(),
      settings: { sound: true, calm: "oui", frame: "arc-en-ciel" },
      adventure: { stars: { "ocean:3": 7, "ocean:0": 2, bidon: 1, "dinos:2": -1, "espace:4": 1.6 } },
      collection: { chat: 2.9, chien: 0, "": 3, lion: "beaucoup" },
      daily: { date: "hier", best: 3, played: 1 },
    });
    expect(messy.settings).toEqual({ sound: true, calm: false, frame: "classic" });
    expect(messy.adventure.stars).toEqual({ "ocean:3": 3, "espace:4": 1 });
    expect(messy.collection).toEqual({ chat: 2 });
    expect(messy.daily).toBeNull();
    for (const adventure of [null, "x", { stars: [1, 2] }]) {
      expect(migrate({ ...defaultSave(), adventure }).adventure).toEqual({ stars: {} });
    }
    expect(migrate({ ...defaultSave(), daily: { date: "2026-01-02", best: -4 } }).daily).toEqual({
      date: "2026-01-02",
      best: 0,
      played: 0,
    });
  });
});
