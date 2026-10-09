import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameStateEnum, useGameStore } from "../../../store/store";
import { defaultSave, SAVE_KEY, SAVE_VERSION } from "../../save/schema";
import { migrate } from "../../save/migrations";
import { applyDailyReward, createSaveStore, useSaveStore } from "../../save/saveStore";
import { createMemoryStorage } from "../../save/storage";
import { generatePlayableLevel } from "../playableLevel";
import { ACCESSORY_LOOKALIKES } from "../../content/accessories";
import { charactersDetails, historyPack, peoplePack } from "../../helpers/characters";
import { isPersonUnlocked } from "../../content/personUnlocks";
import { advanceStreaks, emptyStreaks } from "../streaks";
import { dailyRewardPerson } from "../dailyReward";
import { crowdVariantAt } from "../crowdVariants";

const spec = generatePlayableLevel(1, { seed: 42, tier: "normal", pool: charactersDetails });
const found = { type: "found", elapsedMs: 1000 } as const;
const date = "2026-10-09";
const config = { runSeed: 42, tier: "normal", level: 1 } as const;

beforeEach(() => {
  vi.useFakeTimers();
  useSaveStore.setState({ save: defaultSave(), loaded: true, readOnly: false });
  useGameStore.getState().setClearGameStore();
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); useGameStore.getState().setClearGameStore(); });

function finishPortrait(index: number, elapsedMs: number | null = 1000) {
  useGameStore.getState().setCurrentSpec({ ...spec, seed: index });
  useGameStore.setState({ levelShownAt: elapsedMs === null ? null : performance.now() - elapsedMs });
  useGameStore.getState().recordTargetFound(1, true);
}

describe("bonus automatiques", () => {
  it("verse +5 aux 30 sans erreur et +5 toutes les 10 recherches rapides, y compris simultanément", () => {
    let streaks = emptyStreaks();
    let total = 0;
    for (let i = 1; i <= 60; i++) {
      const next = advanceStreaks(streaks, found);
      expect(next.reward).toBe(i % 30 === 0 ? 10 : i % 10 === 0 ? 5 : 0);
      total += next.reward;
      streaks = next.streaks;
    }
    expect(total).toBe(40);
    expect(streaks).toMatchObject({ clean: 60, quick: 60, cleanBonuses: 2, quickBonuses: 6 });
  });
  it("interrompt les deux séries à l'erreur, sans effacer les bonus déjà gagnés", () => {
    let streaks = emptyStreaks();
    for (let i = 0; i < 29; i++) streaks = advanceStreaks(streaks, found).streaks;
    const next = advanceStreaks(streaks, { type: "miss" });
    expect(next).toMatchObject({ reward: 0, streaks: { clean: 0, quick: 0, quickBonuses: 2, found: 29 } });
    expect(advanceStreaks(next.streaks, found).reward).toBe(0);
  });
  it("exige strictement moins de 10 secondes, et une recherche lente garde la série sans erreur", () => {
    const state = { ...emptyStreaks(), clean: 9, quick: 9 };
    expect(advanceStreaks(state, { ...found, elapsedMs: 9999 }).reward).toBe(5);
    for (const elapsedMs of [10_000, 11_000, null, -1, NaN, Infinity]) {
      expect(advanceStreaks(state, { ...found, elapsedMs })).toMatchObject({ reward: 0, streaks: { clean: 10, quick: 0 } });
    }
  });
  it("compte les avis terminés une seule fois malgré les doublons de toucher et de bilan", () => {
    useGameStore.getState().startRun(config);
    useGameStore.setState({ gameState: GameStateEnum.PLAYING });
    for (let i = 0; i < 30; i++) {
      finishPortrait(i);
      useGameStore.getState().recordTargetFound(1, true);
      useGameStore.getState().recordTargetFound(2, true);
    }
    expect(useSaveStore.getState().save.wallet.stars).toBe(50);
    expect(useGameStore.getState().streaks).toMatchObject({ cleanBonuses: 1, quickBonuses: 3, found: 30 });
    useGameStore.getState().submitGameResult();
    useGameStore.getState().submitGameResult();
    expect(useGameStore.getState().gameRecord).toMatchObject({ earnedStars: 50, streaks: { cleanBonuses: 1, quickBonuses: 3 } });
    expect(useSaveStore.getState().save.wallet.stars).toBe(50);
  });
  it("ignore les cibles partielles et repart à zéro au prochain départ", () => {
    useGameStore.getState().startRun(config);
    useGameStore.getState().setCurrentSpec(spec);
    useGameStore.getState().recordTargetFound(1, false);
    expect(useGameStore.getState().streaks.found).toBe(0);
    useGameStore.getState().recordTargetFound(2, true);
    expect(useGameStore.getState().streaks.clean).toBe(1);
    useGameStore.getState().startRun(config);
    expect(useGameStore.getState().streaks).toEqual(emptyStreaks());
    expect(useGameStore.getState().runStars).toBe(0);
  });
  it("chronomètre à partir du plateau prêt, et pas pendant le chargement", () => {
    const clock = vi.spyOn(performance, "now");
    useGameStore.getState().startRun(config);
    for (let i = 0; i < 10; i++) {
      useGameStore.getState().setCurrentSpec({ ...spec, seed: i });
      clock.mockReturnValue(i * 30_000);
      useGameStore.getState().setAnimationLevelLoading(true);
      clock.mockReturnValue(i * 30_000 + 20_000);
      useGameStore.getState().setAnimationLevelLoading(false);
      clock.mockReturnValue(i * 30_000 + 29_999);
      useGameStore.getState().recordTargetFound(1, true);
    }
    expect(useGameStore.getState().streaks.quickBonuses).toBe(1);
    expect(useSaveStore.getState().save.wallet.stars).toBe(15);
  });
});

describe("portrait du défi quotidien", () => {
  it("choisit un personnage encore verrouillé et ne débloque rien avant 10 trouvailles", () => {
    const save = defaultSave();
    const person = dailyRewardPerson(save, date)!;
    expect(isPersonUnlocked(save, person.name)).toBe(false);
    expect(dailyRewardPerson(save, date)).toBe(person);
    for (const count of [0, 9, NaN, Infinity]) expect(applyDailyReward(save, date, count).save).toBe(save);
    expect(applyDailyReward(save, "bad-date", 10).save).toBe(save);
    const { save: earned, reward } = applyDailyReward(save, date, 10);
    expect(reward).toMatchObject({ person, stars: 0 });
    expect(isPersonUnlocked(earned, person.name)).toBe(true);
    expect(earned.collection[person.name]).toBeUndefined();
    expect(earned.wallet.stars).toBe(0);
    expect(applyDailyReward(earned, date, 100).save).toBe(earned);
  });
  it("enregistre le portrait pendant la partie, puis interdit les doublons au rejeu et après rechargement", async () => {
    useGameStore.getState().startRun({ ...config, mode: "daily", dailyDate: date });
    const person = useGameStore.getState().dailyReward!.person!;
    for (let i = 0; i < 9; i++) finishPortrait(i, 15_000);
    expect(isPersonUnlocked(useSaveStore.getState().save, person.name)).toBe(false);
    finishPortrait(9, 15_000);
    expect(useGameStore.getState().dailyReward).toMatchObject({ person, unlocked: true, claimedBefore: false });
    const earned = useSaveStore.getState().save;
    expect(earned.purchasedPeople).toEqual([person.name]);
    expect(migrate(JSON.stringify(earned)).dailyRewards).toEqual({ [date]: person.name });
    useGameStore.getState().submitGameResult();
    expect(useGameStore.getState().gameRecord?.dailyReward?.unlocked).toBe(true);
    useGameStore.getState().setClearGameStore();
    useGameStore.getState().startRun({ ...config, mode: "daily", dailyDate: date });
    expect(useGameStore.getState().dailyReward).toMatchObject({ person, claimedBefore: true, unlocked: false });
    for (let i = 0; i < 10; i++) finishPortrait(i, 15_000);
    expect(useSaveStore.getState().save.purchasedPeople).toEqual([person.name]);
    const next = applyDailyReward(useSaveStore.getState().save, "2026-10-10", 10);
    expect(next.reward?.person?.name).not.toBe(person.name);
    const storage = createMemoryStorage();
    const store = createSaveStore(storage);
    await store.getState().load();
    store.getState().claimDailyReward(date, 10);
    await store.getState().flush();
    expect(JSON.parse(storage.data.get(SAVE_KEY)!).dailyRewards[date]).toBe(person.name);
    const restored = createSaveStore(storage);
    await restored.getState().load();
    expect(restored.getState().claimDailyReward(date, 10)).toBeNull();
  });
  it("donne une prime de remplacement une seule fois si tous les personnages sont disponibles", () => {
    const save = defaultSave();
    save.purchasedPeople = [...historyPack, ...peoplePack].filter(person => !isPersonUnlocked(save, person.name)).map(person => person.name);
    expect(dailyRewardPerson(save, date)).toBeNull();
    const next = applyDailyReward(save, date, 10);
    expect(next.reward).toEqual({ person: null, stars: 5 });
    expect(next.save.wallet.stars).toBe(5);
    expect(applyDailyReward(next.save, date, 10).save).toBe(next.save);
  });
  it("conserve étoiles, achats et captures d'une v9 tout en retirant les anciens menus", () => {
    const person = dailyRewardPerson(defaultSave(), date)!;
    const old = { ...defaultSave(), version: 9, goals: { person: person.name, contract: "precise-5", completedContracts: ["quick-3"] }, wallet: { stars: 77, onlineRewards: {} }, purchasedPeople: [person.name], collection: { chat: 4 } };
    const migrated = migrate(old);
    expect(migrated).toMatchObject({ version: SAVE_VERSION, wallet: old.wallet, purchasedPeople: old.purchasedPeople, collection: old.collection, dailyRewards: {} });
    expect(migrated).not.toHaveProperty("goals");
    expect(migrate({ ...migrated, dailyRewards: { [date]: person.name, invalid: person.name, "2026-10-10": "unknown", "2026-10-11": null } }).dailyRewards).toEqual({ [date]: person.name, "2026-10-11": null });
  });
  it("refuse les primes avant chargement et en lecture seule", () => {
    for (const state of [{ loaded: false, readOnly: false }, { loaded: true, readOnly: true }]) {
      useSaveStore.setState(state);
      expect(useSaveStore.getState().claimDailyReward(date, 10)).toBeNull();
      expect(useSaveStore.getState().awardStreakBonus(5)).toBe(0);
      expect(useSaveStore.getState().save).toEqual(defaultSave());
    }
  });
});

describe("variantes avancées", () => {
  it("retire les tenues isolées après 55 en Normal/Expert sans changer Enfant ni les respirations", () => {
    for (const tier of ["normal", "expert"] as const) for (const layout of ["grid", "scroll", "pile", "swarm"] as const) {
      for (let seed = 1; seed <= 50; seed++) {
        const selected = crowdVariantAt(80, tier, layout, { seed, position: 80 });
        expect(selected?.endsWith("-single") ?? false).toBe(false);
      }
    }
    const easy = Array.from({ length: 50 }, (_, seed) => crowdVariantAt(80, "easy", "grid", { seed, position: 80 }));
    expect(easy.some(kind => kind?.endsWith("-single"))).toBe(true);
    expect(crowdVariantAt(80, "normal", "grid", { seed: 42, position: 80 }, true)).toBeUndefined();
  });

  it("choisit des tenues à sosies en avancé tout en gardant les leurres enfant à leur fréquence habituelle", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const context = { seed, tier: "normal", pool: charactersDetails } as const;
      const spec = generatePlayableLevel(80, context, { forceVariant: "two-mixed" });
      expect(ACCESSORY_LOOKALIKES[spec.accessories!.target!].length).toBeGreaterThan(0);
      expect(spec.accessories?.similarChance).toBe(.8);
      expect(generatePlayableLevel(80, { ...context, tier: "easy" }, { forceVariant: "two-mixed" }).accessories?.similarChance).toBe(.4);
    }
  });
});
