import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameStateEnum, useGameStore } from "../../../store/store";
import { defaultSave } from "../../save/schema";
import { useSaveStore } from "../../save/saveStore";
import { animalsPack } from "../../helpers/characters";
import { generateLevel } from "../../engine";
import { emptyStreaks } from "../streaks";
import { DAILY_REWARD_TARGET } from "../dailyReward";
import { isPortraitUnlocked } from "../../content/portraitUnlocks";

const portrait = animalsPack.find(animal => animal.name === "dauphin")!;
const spec = generateLevel(1, { seed: 7, tier: "normal", pool: animalsPack });
const config = { runSeed: 7, tier: "normal", level: 1 } as const;

beforeEach(() => {
  vi.useFakeTimers();
  useSaveStore.setState({ save: defaultSave(), loaded: true, readOnly: false });
  useGameStore.getState().setClearGameStore();
  useGameStore.getState().startRun(config);
  useGameStore.setState({ gameState: GameStateEnum.PLAYING });
});
afterEach(() => { vi.useRealTimers(); useGameStore.getState().setClearGameStore(); });

function capture() {
  useGameStore.getState().setCurrentSpec({ ...spec, wanted: portrait });
  useGameStore.getState().recordTargetFound(1, true);
}

describe("pause de révélation", () => {
  it("suspend le chrono jusqu’à Continuer et reprend un seul niveau", () => {
    useGameStore.getState().setTimeLeftValue(23);
    capture();
    expect(useGameStore.getState()).toMatchObject({ gameState: GameStateEnum.PAUSED, pauseTimer: true, unlockQueue: [portrait], level: 1 });
    useGameStore.getState().setTimeLeft(-10);
    useGameStore.getState().advanceLevel(); // ancien délai d’animation
    useGameStore.getState().recordTargetFound(1, true);
    expect(useGameStore.getState().timeLeft).toBe(23);
    expect(useSaveStore.getState().save.collection.dauphin).toBe(1);
    useGameStore.getState().dismissUnlock();
    useGameStore.getState().dismissUnlock(); // double clic
    expect(useGameStore.getState()).toMatchObject({ gameState: GameStateEnum.PLAYING, pauseTimer: false, unlockQueue: [], level: 2, timeLeft: 23 });
  });
  it("révèle uniquement le personnage récompense à 40, sans débloquer la cible du défi", () => {
    expect(DAILY_REWARD_TARGET).toBe(40);
    useGameStore.getState().startRun({ ...config, mode: "daily", dailyDate: "2026-10-09" });
    const person = useGameStore.getState().dailyReward!.person!;
    useGameStore.setState({ streaks: { ...emptyStreaks(), found: 39 } });
    capture();
    expect(isPortraitUnlocked(useSaveStore.getState().save, portrait.name)).toBe(false);
    expect(useSaveStore.getState().save.collection[portrait.name]).toBeUndefined();
    expect(isPortraitUnlocked(useSaveStore.getState().save, person.name)).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ gameState: GameStateEnum.PAUSED, unlockQueue: [person], level: 1 });
    useGameStore.getState().dismissUnlock();
    expect(useGameStore.getState()).toMatchObject({ gameState: GameStateEnum.PLAYING, unlockQueue: [], level: 2 });
    expect(useSaveStore.getState().save.dailyRewards).toEqual({ "2026-10-09": person.name });
  });
  it("garde les nouvelles cibles verrouillées pendant le défi et au rejeu, avec les étoiles et bonus", () => {
    for (let run = 0; run < 2; run++) {
      useGameStore.getState().startRun({ ...config, mode: "daily", dailyDate: "2026-10-09" });
      for (let index = 0; index < 39; index++) {
        capture();
        useGameStore.getState().recordTargetFound(1, true); // doublon de toucher
        expect(useGameStore.getState().unlockQueue).toEqual([]);
      }
      expect(useGameStore.getState()).toMatchObject({ gameState: GameStateEnum.PLAYING, newCharacters: [], runStars: 44, streaks: { found: 39, cleanBonuses: 1 } });
    }
    expect(useSaveStore.getState().save.wallet.stars).toBe(88);
    expect(isPortraitUnlocked(useSaveStore.getState().save, portrait.name)).toBe(false);
    expect(useSaveStore.getState().save.dailyRewards).toEqual({});
    expect(useSaveStore.getState().save.collection).toEqual({});
  });
  it("ne répète pas la révélation d’un portrait déjà acheté, capturé ou disponible au départ", () => {
    for (const save of [
      { ...defaultSave(), purchasedAnimals: [portrait.name] },
      { ...defaultSave(), collection: { [portrait.name]: 1 } },
    ]) {
      useSaveStore.setState({ save });
      useGameStore.getState().startRun(config);
      capture();
      expect(useGameStore.getState().unlockQueue).toEqual([]);
    }
    useGameStore.getState().setCurrentSpec({ ...spec, seed: 99, wanted: animalsPack.find(animal => animal.name === "vache")! });
    useGameStore.getState().recordTargetFound(2, true);
    expect(useGameStore.getState().unlockQueue).toEqual([]);
  });
});
