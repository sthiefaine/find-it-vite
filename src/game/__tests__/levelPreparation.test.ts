import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameStateEnum, useGameStore } from "../../../store/store";
import { useSaveStore } from "../../save/saveStore";
import { defaultSave } from "../../save/schema";
import { LEVELS_PER_WORLD } from "../../content/worlds";
import { WORLD_STEPS } from "../adventureRun";
import { levelAssetUrls } from "../assetReadiness";
import { beginLevelCountdown, countdownAt, generateRunLevel, levelCountdownUntil, LEVEL_COUNTDOWN_MS, nextRunLevel } from "../levelPreparation";

beforeEach(() => {
  useSaveStore.setState({ save: defaultSave(), loaded: true, readOnly: true });
  useGameStore.getState().setClearGameStore();
});
afterEach(() => useGameStore.getState().setClearGameStore());

describe("préparation de l'avis suivant", () => {
  it("prépare exactement le niveau réellement atteint, sans faire progresser la partie", () => {
    const cases = [
      { mode: "endless" as const, adventureStep: 1, missionFound: 0, search: "?theme=ferme&accessory=moustache", level: 13 },
      { mode: "endless" as const, adventureStep: 1, missionFound: 0, search: "?theme=animaux", level: 57 },
      { mode: "endless" as const, adventureStep: 1, missionFound: 0, search: "?variant=same-mixed&accessory=cap", level: 61 },
      { mode: "endless" as const, adventureStep: 1, missionFound: 0, search: "?variant=same-bare", level: 67 },
      { mode: "daily" as const, adventureStep: 1, missionFound: 0, search: "?mode=daily", level: 42 },
      ...[1, LEVELS_PER_WORLD, WORLD_STEPS, WORLD_STEPS + 1].flatMap(adventureStep => [0, 3, 4].map(missionFound => ({
        mode: "adventure" as const, adventureStep, missionFound, search: "?mode=adventure", level: adventureStep * 5 + missionFound,
      }))),
    ];
    for (const sample of cases) {
      useGameStore.getState().setClearGameStore();
      useGameStore.setState({ ...sample, tier: "normal", runSeed: 42, gameState: GameStateEnum.PLAYING });
      const start = useGameStore.getState();
      const current = generateRunLevel(start, useSaveStore.getState().save, sample.search, true);
      start.setCurrentSpec(current);
      const untouched = useGameStore.getState();
      const next = generateRunLevel(nextRunLevel(untouched), useSaveStore.getState().save, sample.search, true);
      expect(useGameStore.getState()).toBe(untouched);
      untouched.recordTargetFound(1, true);
      if (useGameStore.getState().unlockQueue.length) untouched.dismissUnlock();
      else untouched.advanceLevel();
      const actual = generateRunLevel(useGameStore.getState(), useSaveStore.getState().save, sample.search, true);
      expect(next).toEqual(actual);
      expect(levelAssetUrls(next)).toEqual(levelAssetUrls(actual));
    }
  });

  it("garde le thème et les animaux débloqués en Infini", () => {
    const position = { mode: "endless" as const, runSeed: 42, tier: "normal" as const, level: 50, adventureStep: 1, missionFound: 0 };
    const save = defaultSave();
    const next = generateRunLevel(nextRunLevel(position), save, "?theme=animaux", false);
    expect([next.wanted, ...next.decoys].every(animal => ["chat", "chien", "cochon", "mouton", "vache"].includes(animal.name))).toBe(true);
  });

  it("affiche 3, 2, 1 pendant trois secondes puis attend silencieusement les images lentes", () => {
    expect(LEVEL_COUNTDOWN_MS).toBe(3000);
    const start = 1000;
    const until = start + LEVEL_COUNTDOWN_MS;
    expect([0, 999, 1000, 1999, 2000, 2999, 3000, 15_000].map(elapsed => countdownAt(until, start + elapsed)))
      .toEqual([3, 3, 2, 2, 1, 1, 0, 0]);
  });

  it("partage la même échéance entre l'avis et le chargement sans confondre un rejeu", () => {
    const state = useGameStore.getState();
    const save = defaultSave();
    const first = generateRunLevel(state, save, "", false);
    const replay = generateRunLevel(state, save, "", false);
    expect(first).toEqual(replay);
    expect(levelCountdownUntil(first)).toBeUndefined();
    expect(beginLevelCountdown(first, 100)).toBe(3100);
    expect(levelCountdownUntil(first)).toBe(3100);
    expect(levelCountdownUntil(replay)).toBeUndefined();
    beginLevelCountdown(replay, 10_000);
    expect(levelCountdownUntil(first)).toBe(3100);
    expect(levelCountdownUntil(replay)).toBe(13_000);
  });
});
