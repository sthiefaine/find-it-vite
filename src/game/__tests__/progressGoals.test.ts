import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameStateEnum, useGameStore } from "../../../store/store";
import { defaultSave, SAVE_KEY } from "../../save/schema";
import { migrate } from "../../save/migrations";
import { applyContractReward, createSaveStore, useSaveStore } from "../../save/saveStore";
import { createMemoryStorage } from "../../save/storage";
import { generatePlayableLevel } from "../playableLevel";
import { ACCESSORY_LOOKALIKES } from "../../content/accessories";
import { charactersDetails, historyPack } from "../../helpers/characters";
import { isPersonUnlocked } from "../../content/personUnlocks";
import { advanceContract, CONTRACTS, type ContractRun } from "../contracts";
import { crowdVariantAt } from "../crowdVariants";

const goal = historyPack.find(person => !isPersonUnlocked(defaultSave(), person.name))!.name;
const spec = generatePlayableLevel(1, { seed: 42, tier: "normal", pool: charactersDetails });
const run = (id: ContractRun["id"]): ContractRun => ({ id, progress: 0, complete: false, bonus: 0 });
const found = { type: "found", layout: "grid", elapsedMs: 1000 } as const;

beforeEach(() => {
  vi.useFakeTimers();
  useSaveStore.setState({ save: defaultSave(), loaded: true, readOnly: false });
  useGameStore.getState().setClearGameStore();
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); useGameStore.getState().setClearGameStore(); });

describe("contrats de maîtrise", () => {
  it("remet une série à zéro à l'erreur, puis la laisse réussir sur une nouvelle série", () => {
    let state = run("precise-5");
    for (let i = 0; i < 4; i++) state = advanceContract(state, found);
    state = advanceContract(state, { type: "miss" });
    expect(state.progress).toBe(0);
    for (let i = 0; i < 5; i++) state = advanceContract(state, found);
    expect(state).toMatchObject({ complete: true, progress: 5 });
    expect(advanceContract(state, { type: "miss" })).toBe(state);
  });

  it("exige moins de cinq secondes pour chaque recherche rapide et interrompt la série en cas d'erreur", () => {
    let state = advanceContract(run("quick-3"), found);
    for (const elapsedMs of [5000, 6000, null, -1, NaN]) {
      expect(advanceContract(state, { ...found, elapsedMs }).progress).toBe(0);
    }
    expect(advanceContract(state, { type: "miss" }).progress).toBe(0);
    for (let i = 0; i < 2; i++) state = advanceContract(state, { ...found, elapsedMs: 4999 });
    expect(state.complete).toBe(true);
  });

  it("compte seulement les défilements et essaims pour le contrat mobile", () => {
    let state = run("moving-5");
    for (const layout of ["grid", "pile", "scroll", "swarm"] as const) state = advanceContract(state, { ...found, layout });
    expect(state.progress).toBe(2);
    expect(advanceContract(state, { type: "miss" }).progress).toBe(2);
  });

  it("ne verse aucune prime pour un contrat non sélectionné, inconnu ou déjà récompensé", () => {
    const save = defaultSave();
    expect(applyContractReward(save, "precise-5")).toBe(save);
    save.goals.contract = "precise-5";
    const paid = applyContractReward(save, "precise-5");
    expect(paid.wallet.stars).toBe(3);
    expect(paid.goals).toMatchObject({ contract: null, completedContracts: ["precise-5"] });
    expect(applyContractReward(paid, "precise-5")).toBe(paid);
    expect(applyContractReward(save, "unknown" as "precise-5")).toBe(save);
    expect(CONTRACTS.reduce((sum, contract) => sum + contract.reward, 0)).toBe(24);
  });

  it("récompense une seule fois les recherches réussies, pas les doublons de toucher, puis affiche le bon bilan", () => {
    useSaveStore.getState().selectContract("precise-5");
    useGameStore.getState().startRun({ runSeed: 42, tier: "normal", level: 1 });
    useGameStore.setState({ gameState: GameStateEnum.PLAYING });
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().setCurrentSpec({ ...spec, seed: i });
      useGameStore.getState().recordTargetFound(1, true);
      useGameStore.getState().recordTargetFound(1, true);
      useGameStore.getState().recordTargetFound(2, true);
    }
    expect(useSaveStore.getState().save.wallet.stars).toBe(8);
    expect(useGameStore.getState().contractRun).toMatchObject({ complete: true, progress: 5, bonus: 3 });
    useGameStore.getState().submitGameResult();
    useGameStore.getState().submitGameResult();
    expect(useGameStore.getState().gameRecord).toMatchObject({ earnedStars: 8, contract: { bonus: 3 } });
    expect(useSaveStore.getState().save.wallet.stars).toBe(8);
    useSaveStore.getState().selectContract("precise-5");
    expect(useSaveStore.getState().save.goals.contract).toBeNull();
  });

  it("repart à zéro au prochain départ et ne donne rien sans contrat choisi", () => {
    useSaveStore.getState().selectContract("precise-5");
    const config = { runSeed: 42, tier: "normal", level: 1 } as const;
    useGameStore.getState().startRun(config);
    useGameStore.getState().setCurrentSpec(spec);
    useGameStore.getState().recordTargetFound(1, true);
    expect(useGameStore.getState().contractRun?.progress).toBe(1);
    useGameStore.getState().startRun(config);
    expect(useGameStore.getState().contractRun?.progress).toBe(0);
    useSaveStore.getState().selectContract(null);
    useGameStore.getState().startRun(config);
    expect(useGameStore.getState().contractRun).toBeNull();
  });

  it("mesure les recherches rapides à partir de l'ouverture du plateau, et ignore les cibles partielles", () => {
    const clock = vi.spyOn(performance, "now");
    useSaveStore.getState().selectContract("quick-3");
    useGameStore.getState().startRun({ runSeed: 42, tier: "normal", level: 1 });
    for (let i = 0; i < 3; i++) {
      useGameStore.getState().setCurrentSpec({ ...spec, seed: i });
      clock.mockReturnValue(1000 + i * 6000);
      useGameStore.getState().setAnimationLevelLoading(false);
      useGameStore.getState().recordTargetFound(1, false);
      expect(useGameStore.getState().contractRun?.progress).toBe(i);
      clock.mockReturnValue(5500 + i * 6000);
      useGameStore.getState().recordTargetFound(2, true);
    }
    expect(useGameStore.getState().contractRun).toMatchObject({ complete: true, bonus: 3 });
    expect(useSaveStore.getState().save.wallet.stars).toBe(6);
  });
});

describe("objectif de collection et sauvegarde", () => {
  it("conserve les étoiles, achats et captures lors de la migration v8, puis nettoie les objectifs invalides", () => {
    const old = { ...defaultSave(), version: 8, wallet: { stars: 77, onlineRewards: {} }, purchasedPeople: [goal], collection: { chat: 4 } };
    const next = migrate(old);
    expect(next).toMatchObject({ version: 9, wallet: old.wallet, purchasedPeople: old.purchasedPeople, collection: old.collection, goals: defaultSave().goals });
    expect(migrate({ ...next, goals: { person: goal, contract: "precise-5", completedContracts: ["precise-5", "precise-5", "invalid"] } }).goals)
      .toEqual({ person: null, contract: null, completedContracts: ["precise-5"] });
  });

  it("persiste l'objectif et les primes versées ; acheter le personnage retire seulement son objectif", async () => {
    const storage = createMemoryStorage();
    const store = createSaveStore(storage);
    await store.getState().load();
    store.getState().setPersonGoal(goal);
    store.getState().selectContract("precise-5");
    expect(store.getState().completeContract("precise-5")).toBe(3);
    await store.getState().flush();
    const restored = createSaveStore(storage);
    await restored.getState().load();
    expect(restored.getState().save.goals).toMatchObject({ person: goal, completedContracts: ["precise-5"] });
    expect(restored.getState().completeContract("precise-5")).toBe(0);
    restored.getState().recordCollection("chat", 97);
    expect(restored.getState().purchasePerson(goal)).toBe("purchased");
    expect(restored.getState().save.wallet.stars).toBe(0);
    expect(restored.getState().save.goals).toMatchObject({ person: null, completedContracts: ["precise-5"] });
    await restored.getState().flush();
    expect(JSON.parse(storage.data.get(SAVE_KEY)!).purchasedPeople).toContain(goal);
  });

  it("refuse un objectif animal, gratuit ou déjà acheté, ainsi que les changements avant chargement ou en lecture seule", () => {
    const store = useSaveStore.getState();
    for (const id of ["chat", "napoleon-bonaparte", "unknown"]) store.setPersonGoal(id);
    expect(useSaveStore.getState().save.goals.person).toBeNull();
    for (const state of [{ loaded: false, readOnly: false }, { loaded: true, readOnly: true }]) {
      useSaveStore.setState(state);
      store.setPersonGoal(goal);
      store.selectContract("precise-5");
      expect(store.completeContract("precise-5")).toBe(0);
      expect(useSaveStore.getState().save.goals).toEqual(defaultSave().goals);
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
