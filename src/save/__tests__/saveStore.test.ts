import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyGameResult, createSaveStore } from "../saveStore";
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
      [SAVE_KEY]: JSON.stringify({ ...defaultSave(), settings: { sound: false } }),
    });
    const store = createSaveStore(storage, { debounceMs: 50 });
    await store.getState().load();
    expect(store.getState().save.settings.sound).toBe(false);

    store.getState().setSound(true);
    await store.getState().flush();
    expect(JSON.parse(storage.data.get(SAVE_KEY)!).settings.sound).toBe(true);
  });

  it("enregistre le profil choisi et réécrit une v1 au format v2", async () => {
    const storage = createMemoryStorage({
      [SAVE_KEY]: JSON.stringify({
        version: 1,
        settings: { sound: true },
        progress: { bestScore: 4, bestLevel: 2, gamesPlayed: 1, totalFound: 4 },
      }),
    });
    const store = createSaveStore(storage, { debounceMs: 20 });
    await store.getState().load();
    expect(store.getState().save.profile.tier).toBeNull();

    store.getState().setProfileTier("easy");
    await store.getState().flush();
    const saved = JSON.parse(storage.data.get(SAVE_KEY)!);
    expect(saved.version).toBe(2);
    expect(saved.profile).toEqual({ tier: "easy" });
    expect(saved.progress.bestScore).toBe(4);
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
});
