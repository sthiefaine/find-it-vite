import { describe, expect, it } from "vitest";
import { isFutureVersion, migrate } from "../migrations";
import { defaultSave, SAVE_VERSION } from "../schema";
import { isLevelUnlocked, isWorldUnlocked } from "../../content/progress";
import { getWorld } from "../../content/worlds";

// Champs ajoutés par la v4, tels qu'une migration les crée
const V4_EXTRA = { goals: defaultSave().goals, wallet: { stars: 0, onlineRewards: {} }, purchasedPeople: [], adventure: { stars: {}, unlocked: [] }, collection: {}, daily: null };
const v4Settings = (sound: boolean) => ({ sound, calm: false, frame: "classic" });

describe("migrate", () => {
  it("donne la sauvegarde par défaut si rien n'est lisible", () => {
    for (const raw of [null, undefined, "", "{pas du json", "42", "[]", 12, { foo: 1 }, { version: "1" }]) {
      expect(migrate(raw)).toEqual(defaultSave());
    }
  });

  it("migre une sauvegarde v1 jusqu'à v5, en chaîne ou en objet, en profil Normal", () => {
    const v1 = {
      version: 1,
      settings: { sound: false },
      progress: { bestScore: 12, bestLevel: 7, gamesPlayed: 3, totalFound: 20 },
    };
    const expected = {
      ...v1,
      ...V4_EXTRA,
      version: SAVE_VERSION,
      settings: v4Settings(false),
      profile: { tier: "normal" },
      seenMechanics: [],
    };
    expect(migrate(v1)).toEqual(expected);
    expect(migrate(JSON.stringify(v1))).toEqual(expected);
  });

  it("une v1 qui contenait déjà un champ profile repart en Normal", () => {
    const v1 = { version: 1, settings: { sound: true }, progress: {}, profile: { tier: "easy" } };
    expect(migrate(v1).profile).toEqual({ tier: "normal" });
  });

  it("relit une sauvegarde v5 valide avec son profil", () => {
    for (const tier of ["easy", "normal"] as const) {
      const save = { ...defaultSave(), profile: { tier } };
      expect(migrate(JSON.stringify(save))).toEqual(save);
    }
  });

  it("migre une v2 en v5 sans mécanique vue, Expert devient Normal", () => {
    const v2 = {
      version: 2,
      settings: { sound: false },
      progress: { bestScore: 21, bestLevel: 18, gamesPlayed: 5, totalFound: 60 },
      profile: { tier: "expert" },
    };
    const expected = {
      ...v2,
      ...V4_EXTRA,
      version: SAVE_VERSION,
      settings: v4Settings(false),
      profile: { tier: "normal" },
      seenMechanics: [],
    };
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

  it("remplace un profil inconnu, absent ou Expert par Normal", () => {
    for (const profile of [{ tier: "bébé" }, { tier: 3 }, { tier: null }, { tier: "expert" }, {}, "expert", null, undefined]) {
      expect(migrate({ ...defaultSave(), profile }).profile).toEqual({ tier: "normal" });
    }
  });

  it("la sauvegarde par défaut joue en Normal", () => {
    expect(defaultSave().profile).toEqual({ tier: "normal" });
  });

  describe("v4 → v5", () => {
    const v4 = {
      version: 4,
      settings: { sound: false, calm: true, frame: "gold" },
      progress: { bestScore: 40, bestLevel: 9, gamesPlayed: 6, totalFound: 33 },
      seenMechanics: ["layout:grid"],
      adventure: { stars: { "ocean:2": 3 } },
      collection: { chat: 2 },
      daily: { date: "2026-10-03", best: 8, played: 2 },
    };

    it("un profil pas encore choisi (null) devient Normal, le reste est gardé", () => {
      expect(migrate(JSON.stringify({ ...v4, profile: { tier: null } }))).toEqual({
        ...v4,
        version: SAVE_VERSION,
        adventure: { stars: { "ocean:2": 3 }, unlocked: ["ocean"] },
        wallet: { stars: 2, onlineRewards: {} },
        purchasedPeople: [],
        goals: defaultSave().goals,
        profile: { tier: "normal" },
      });
    });

    it("Expert, qui n'est plus proposé, devient Normal", () => {
      expect(migrate({ ...v4, profile: { tier: "expert" } }).profile).toEqual({ tier: "normal" });
    });

    it("Enfant et Normal sont gardés", () => {
      expect(migrate({ ...v4, profile: { tier: "easy" } }).profile).toEqual({ tier: "easy" });
      expect(migrate({ ...v4, profile: { tier: "normal" } }).profile).toEqual({ tier: "normal" });
    });

    it("un profil absent ou abîmé devient Normal", () => {
      for (const profile of [undefined, null, "easy", { tier: "bébé" }]) {
        expect(migrate({ ...v4, profile }).profile).toEqual({ tier: "normal" });
      }
    });
  });

  it("répare les champs abîmés sans perdre les bons", () => {
    const result = migrate({
      version: 5,
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

  it("migre une v3 en v5 : calme désactivé, cadre classique, Aventure et collection vides", () => {
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
      version: SAVE_VERSION,
      settings: v4Settings(false),
    });
  });

  it("relit les champs v4 et nettoie les valeurs invalides", () => {
    const save = {
      ...defaultSave(),
      settings: { sound: true, calm: true, frame: "gold" },
      adventure: { stars: { "ocean:3": 2, "animaux:1": 3 }, unlocked: ["ocean"] },
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
      expect(migrate({ ...defaultSave(), adventure }).adventure).toEqual({ stars: {}, unlocked: [] });
    }
    expect(migrate({ ...defaultSave(), daily: { date: "2026-01-02", best: -4 } }).daily).toEqual({
      date: "2026-01-02",
      best: 0,
      played: 0,
    });
  });

  describe("v5 → v6 (Aventure continue)", () => {
    const v5 = (stars: Record<string, number>) => ({ ...defaultSave(), version: 5, adventure: { stars } });
    const animals = (n: number, value = 3) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`animaux:${i + 1}`, value]));

    it("garde ouverts les mondes déjà débloqués par le total d'étoiles", () => {
      expect(migrate(v5({})).adventure.unlocked).toEqual([]);
      expect(migrate(v5(animals(3))).adventure.unlocked).toEqual([]); // 9★
      expect(migrate(v5(animals(4))).adventure.unlocked).toEqual(["ocean"]); // 12★
      expect(migrate(v5({ ...animals(10), "ocean:1": 3 })).adventure.unlocked).toEqual(["ocean", "dinos"]); // 33★
      expect(migrate(v5({ ...animals(10), "ocean:1": 3, "ocean:2": 3 })).adventure.unlocked).toEqual([
        "ocean",
        "dinos",
        "halloween",
      ]); // 36★
    });

    it("les étoiles ne bougent pas", () => {
      const stars = { ...animals(5, 2), "ocean:1": 1 };
      expect(migrate(JSON.stringify(v5(stars))).adventure.stars).toEqual(stars);
    });

    it("une liste abîmée est nettoyée", () => {
      const raw = { ...defaultSave(), adventure: { stars: {}, unlocked: ["ocean", "lune", 3, "ocean"] } };
      expect(migrate(raw).adventure.unlocked).toEqual(["ocean"]);
      expect(migrate({ ...defaultSave(), adventure: { stars: {}, unlocked: "ocean" } }).adventure.unlocked).toEqual([]);
    });
  });

  describe("v6 → v7 (40 étapes)", () => {
    it("garde Océan ouvert après l'ancien final Animaux sans déplacer les étoiles", () => {
      const stars = { "animaux:1": 3, "animaux:10": 1, "dinos:5": 2 };
      const save = migrate({ ...defaultSave(), version: 6, adventure: { stars, unlocked: [] } });
      expect(save.version).toBe(SAVE_VERSION);
      expect(save.adventure.stars).toEqual(stars);
      expect(isWorldUnlocked(save, getWorld("ocean")!)).toBe(true);
      expect(isLevelUnlocked(save, "ocean", 1)).toBe(true);
      expect(isLevelUnlocked(save, "animaux", 11)).toBe(true);
      expect(migrate(save)).toEqual(save);
    });

    it("garde un monde déjà joué ou explicitement débloqué, même sans l'ancien final", () => {
      const played = migrate({ ...defaultSave(), version: 6, adventure: { stars: { "ocean:3": 2 } } });
      expect(played.adventure.unlocked).toContain("ocean");
      const explicit = migrate({ ...defaultSave(), version: 6, adventure: { stars: {}, unlocked: ["ocean"] } });
      expect(explicit.adventure.unlocked).toEqual(["ocean"]);
    });

    it("n'ouvre pas Océan aux nouveaux joueurs à l'étape 10", () => {
      const fresh = { ...defaultSave(), adventure: { stars: { "animaux:10": 3 }, unlocked: [] } };
      expect(isWorldUnlocked(migrate(fresh), getWorld("ocean")!)).toBe(false);
      const incomplete = migrate({ ...defaultSave(), version: 6, adventure: { stars: { "animaux:10": 0 } } });
      expect(incomplete.adventure.unlocked).not.toContain("ocean");
    });
  });
});
