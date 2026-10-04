import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCollection, applyDaily, applyGameResult, applyStars, createSaveStore } from "../saveStore";
import { createMemoryStorage } from "../storage";
import { defaultSave, SAVE_KEY } from "../schema";

describe("applyGameResult", () => {
  it("met à jour record, niveau, parties et trouvés", () => {
    const save = applyGameResult(defaultSave(), { score: 5, level: 4, found: 5 });
    expect(save.progress).toEqual({ bestScore: 5, bestLevel: 4, gamesPlayed: 1, totalFound: 5 });
    const next = applyGameResult(save, { score: 2, level: 2, found: 2 });
    expect(next.progress).toEqual({ bestScore: 5, bestLevel: 4, gamesPlayed: 2, totalFound: 7 });
  });
});

describe("useSaveStore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("recordGame signale un nouveau record et écrit après le délai", async () => {
    const storage = createMemoryStorage();
    const store = createSaveStore(storage, { debounceMs: 100 });
    await store.getState().load();

    const first = store.getState().recordGame({ score: 8, level: 3, found: 8 });
    expect(first).toEqual({ isNewRecord: true, previousBest: 0, bestScore: 8 });
    expect(storage.data.has(SAVE_KEY)).toBe(false);

    const second = store.getState().recordGame({ score: 3, level: 2, found: 3 });
    expect(second).toEqual({ isNewRecord: false, previousBest: 8, bestScore: 8 });

    await vi.advanceTimersByTimeAsync(100);
    const saved = JSON.parse(storage.data.get(SAVE_KEY)!);
    expect(saved.progress).toEqual({ bestScore: 8, bestLevel: 3, gamesPlayed: 2, totalFound: 11 });
  });

  it("une partie à 0 point n'est jamais un record", async () => {
    const store = createSaveStore(createMemoryStorage());
    await store.getState().load();
    expect(store.getState().recordGame({ score: 0, level: 1, found: 0 }).isNewRecord).toBe(false);
    expect(store.getState().save.progress.gamesPlayed).toBe(1);
  });

  it("charge le réglage son et le persiste", async () => {
    const storage = createMemoryStorage({
      [SAVE_KEY]: JSON.stringify({ ...defaultSave(), settings: { ...defaultSave().settings, sound: false } }),
    });
    const store = createSaveStore(storage, { debounceMs: 50 });
    await store.getState().load();
    expect(store.getState().save.settings.sound).toBe(false);

    store.getState().setSound(true);
    await store.getState().flush();
    expect(JSON.parse(storage.data.get(SAVE_KEY)!).settings.sound).toBe(true);
  });

  it("enregistre le profil choisi et réécrit une v1 au format courant", async () => {
    const storage = createMemoryStorage({
      [SAVE_KEY]: JSON.stringify({
        version: 1,
        settings: { sound: true },
        progress: { bestScore: 4, bestLevel: 2, gamesPlayed: 1, totalFound: 4 },
      }),
    });
    const store = createSaveStore(storage, { debounceMs: 20 });
    await store.getState().load();
    expect(store.getState().save.profile.tier).toBe("normal");

    store.getState().setProfileTier("easy");
    await store.getState().flush();
    const saved = JSON.parse(storage.data.get(SAVE_KEY)!);
    expect(saved.version).toBe(5);
    expect(saved.settings).toEqual({ sound: true, calm: false, frame: "classic" });
    expect(saved.profile).toEqual({ tier: "easy" });
    expect(saved.seenMechanics).toEqual([]);
    expect(saved.progress.bestScore).toBe(4);
  });

  it("persiste les mécaniques vues, sans doublon", async () => {
    const storage = createMemoryStorage();
    const store = createSaveStore(storage, { debounceMs: 20 });
    await store.getState().load();

    store.getState().markMechanicsSeen(["layout:grid", "rule:findAll", "layout:grid"]);
    store.getState().markMechanicsSeen(["layout:grid"]);
    expect(store.getState().save.seenMechanics).toEqual(["layout:grid", "rule:findAll"]);
    await store.getState().flush();
    expect(JSON.parse(storage.data.get(SAVE_KEY)!).seenMechanics).toEqual(["layout:grid", "rule:findAll"]);

    const reloaded = createSaveStore(storage);
    await reloaded.getState().load();
    expect(reloaded.getState().save.seenMechanics).toEqual(["layout:grid", "rule:findAll"]);
  });

  it("n'écrase jamais une sauvegarde d'une version future", async () => {
    const future = JSON.stringify({ version: 99, progress: { bestScore: 40 }, album: [1, 2] });
    const storage = createMemoryStorage({ [SAVE_KEY]: future });
    const store = createSaveStore(storage, { debounceMs: 10 });
    await store.getState().load();

    expect(store.getState().readOnly).toBe(true);
    store.getState().recordGame({ score: 50, level: 9, found: 50 });
    await vi.advanceTimersByTimeAsync(50);
    await store.getState().flush();
    expect(storage.data.get(SAVE_KEY)).toBe(future);
  });

  it("persiste mode calme et cadre", async () => {
    const storage = createMemoryStorage();
    const store = createSaveStore(storage, { debounceMs: 20 });
    await store.getState().load();
    store.getState().setCalm(true);
    store.getState().setFrame("neon");
    await store.getState().flush();
    expect(JSON.parse(storage.data.get(SAVE_KEY)!).settings).toEqual({ sound: true, calm: true, frame: "neon" });
  });

  it("recordStars, recordCollection et recordDaily sont persistés, resetSave efface tout", async () => {
    const storage = createMemoryStorage();
    const store = createSaveStore(storage, { debounceMs: 20 });
    await store.getState().load();
    const s = store.getState();
    s.recordStars("ocean", 2, 2);
    s.recordStars("ocean", 2, 1);
    s.recordCollection("ocean-requin");
    s.recordCollection("ocean-requin", 2);
    s.recordDaily("2026-10-03", 40);
    await store.getState().flush();
    const saved = JSON.parse(storage.data.get(SAVE_KEY)!);
    expect(saved.adventure.stars).toEqual({ "ocean:2": 2 });
    expect(saved.collection).toEqual({ "ocean-requin": 3 });
    expect(saved.daily).toEqual({ date: "2026-10-03", best: 40, played: 1 });

    await store.getState().resetSave();
    expect(store.getState().save).toEqual(defaultSave());
    expect(storage.data.has(SAVE_KEY)).toBe(false);
  });
});

describe("actions v4 (pures)", () => {
  it("applyStars garde le meilleur résultat, borné à 0-3", () => {
    let save = applyStars(defaultSave(), "dinos", 4, 1);
    save = applyStars(save, "dinos", 4, 3);
    expect(applyStars(save, "dinos", 4, 2)).toBe(save);
    expect(save.adventure.stars).toEqual({ "dinos:4": 3 });
    expect(applyStars(defaultSave(), "dinos", 1, 9).adventure.stars["dinos:1"]).toBe(3);
    expect(applyStars(defaultSave(), "dinos", 1, 0).adventure.stars["dinos:1"]).toBe(0);
    expect(applyStars(defaultSave(), "dinos", 1, NaN).adventure.stars).toEqual({});
  });

  it("applyCollection additionne les trouvailles", () => {
    let save = applyCollection(defaultSave(), "chat");
    save = applyCollection(save, "chat", 4);
    save = applyCollection(save, "chien");
    expect(save.collection).toEqual({ chat: 5, chien: 1 });
    expect(applyCollection(save, "chat", 0)).toBe(save);
    expect(applyCollection(save, "", 1)).toBe(save);
  });

  it("applyDaily garde le meilleur score du jour et repart à zéro un autre jour", () => {
    let save = applyDaily(defaultSave(), "2026-10-03", 12);
    save = applyDaily(save, "2026-10-03", 8);
    expect(save.daily).toEqual({ date: "2026-10-03", best: 12, played: 2 });
    save = applyDaily(save, "2026-10-03", 20);
    expect(save.daily).toEqual({ date: "2026-10-03", best: 20, played: 3 });
    save = applyDaily(save, "2026-10-04", 5);
    expect(save.daily).toEqual({ date: "2026-10-04", best: 5, played: 1 });
  });
});
