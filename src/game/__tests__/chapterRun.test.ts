import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameStateEnum, useGameStore } from "../../../store/store";
import { useSaveStore } from "../../save/saveStore";
import { defaultSave } from "../../save/schema";
import { CAMPAIGN_CHAPTERS, chapterTargets } from "../../content/campaign";
import { generateRunLevel, nextRunLevel } from "../levelPreparation";
import { readModeParams } from "../modes";
import { isPortraitUnlocked } from "../../content/portraitUnlocks";
import { generateLevel } from "../../engine";
import { animalsPack } from "../../helpers/characters";

const chapter = CAMPAIGN_CHAPTERS.find(c => c.id === "personnages-cuisine-tv-01")!;
beforeEach(() => {
  vi.useFakeTimers();
  useSaveStore.setState({ save: defaultSave(), loaded: true, readOnly: false });
  useGameStore.getState().setClearGameStore();
});
afterEach(() => { useGameStore.getState().setClearGameStore(); vi.useRealTimers(); });

describe("partie de chapitre", () => {
  it("respecte la cible imposée et refuse une cible absente au lieu de changer silencieusement d’identité", () => {
    expect(generateLevel(1, { seed: 42, tier: "normal", pool: animalsPack, wantedId: "vache" }).wanted.name).toBe("vache");
    expect(() => generateLevel(1, { seed: 42, tier: "normal", pool: animalsPack, wantedId: "absent" })).toThrow();
  });
  it("lit un chapitre et la reprise du Mélange depuis leurs URL", () => {
    expect(readModeParams(`?mode=adventure&chapter=${chapter.id}&level=3`)).toMatchObject({ mode: "adventure", chapterId: chapter.id, level: 3 });
    expect(readModeParams("?mode=adventure&world=melange&step=68")).toMatchObject({ mode: "adventure", mixStep: 68 });
  });
  it("donne réellement les portraits trouvés, suspend le chrono à la révélation et prédit le même avis suivant", () => {
    useSaveStore.getState().enterChapter(chapter.id, 1);
    useGameStore.getState().startRun({ mode: "adventure", chapterId: chapter.id, adventureLevel: 1, runSeed: 42, tier: "normal", level: 1 });
    useGameStore.setState({ gameState: GameStateEnum.PLAYING });
    const state = useGameStore.getState();
    const spec = generateRunLevel(state, useSaveStore.getState().save, "", false);
    const next = generateRunLevel(nextRunLevel(state), useSaveStore.getState().save, "", false);
    state.setCurrentSpec(spec);
    state.recordTargetFound(1, true);
    expect(isPortraitUnlocked(useSaveStore.getState().save, spec.wanted.name)).toBe(true);
    expect(useSaveStore.getState().save.collection[spec.wanted.name]).toBe(1);
    expect(useSaveStore.getState().save.purchasedPeople).toEqual([]);
    expect(useGameStore.getState()).toMatchObject({ gameState: GameStateEnum.PAUSED, pauseTimer: true, missionFound: 1 });
    state.recordTargetFound(1, true);
    expect(useSaveStore.getState().save.collection[spec.wanted.name]).toBe(1);
    state.dismissUnlock();
    expect(generateRunLevel(useGameStore.getState(), useSaveStore.getState().save, "", false)).toEqual(next);
  });
  it("termine dix missions, sauvegarde les cinquante cibles et retourne un résultat de chapitre", () => {
    useSaveStore.getState().enterChapter(chapter.id, 1);
    useGameStore.getState().startRun({ mode: "adventure", chapterId: chapter.id, adventureLevel: 1, runSeed: 42, tier: "normal", level: 1 });
    useGameStore.setState({ gameState: GameStateEnum.PLAYING });
    for (let mission = 1; mission <= 10; mission++) for (let round = 1; round <= 5; round++) {
      const state = useGameStore.getState();
      expect(state.adventureStep).toBe(mission);
      const spec = generateRunLevel(state, useSaveStore.getState().save, "", false);
      expect(spec.wanted.name).toBe(chapterTargets(chapter, mission)[round - 1]);
      state.setCurrentSpec(spec);
      state.recordTargetFound(mission * 10 + round, true);
      state.setScore(1);
      if (useGameStore.getState().unlockQueue.length) state.dismissUnlock();
      else state.advanceLevel();
    }
    expect(useGameStore.getState()).toMatchObject({ gameState: GameStateEnum.FINISH, adventureStep: 10, missionFound: 5 });
    const save = useSaveStore.getState().save;
    expect(Object.values(save.campaign.chapterStars[chapter.id])).toHaveLength(10);
    expect(chapter.cohortIds.every(id => isPortraitUnlocked(save, id))).toBe(true);
    expect(Object.values(save.collection).reduce((sum, count) => sum + count, 0)).toBe(50);
    expect(save.adventure.stars).toEqual({});
    expect(save.campaign.rewardReceipts).toHaveLength(1);
    useGameStore.getState().submitGameResult();
    expect(useGameStore.getState().gameRecord).toMatchObject({ chapterId: chapter.id, chapterComplete: true, score: 50 });
  });
});
