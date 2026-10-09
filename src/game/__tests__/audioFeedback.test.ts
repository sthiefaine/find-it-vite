import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureFeedbackFor } from "../audioFeedback";
import { emptyStreaks } from "../streaks";
import { GameStateEnum, useGameStore } from "../../../store/store";
import { useSaveStore } from "../../save/saveStore";
import { defaultSave } from "../../save/schema";
import { generateLevel } from "../../engine";
import { charactersDetails } from "../../helpers/characters";
import { playSound, playLegacySound } from "../../audio/engine";

vi.mock("../../audio/engine", () => ({ playSound: vi.fn(), playLegacySound: vi.fn(), unlockAudio: vi.fn() }));
const input = { golden: false, levelDone: true, streaks: emptyStreaks(), bonusStars: 0, stepStars: null };

describe("capture audio hierarchy", () => {
  it("rewards only actual stars, prioritizing them over a simultaneous step and combo", () => {
    expect(captureFeedbackFor({ ...input, bonusStars: 10, stepStars: 3 }).cue).toBe("reward");
    expect(captureFeedbackFor({ ...input, stepStars: 2 })).toMatchObject({ cue: "step", options: { stars: 2 } });
    expect(captureFeedbackFor({ ...input, golden: true }).cue).toBe("golden");
  });
  it("celebrates selected rapid milestones and caps pitch intensity", () => {
    for (const quick of [3, 5, 15]) expect(captureFeedbackFor({ ...input, streaks: { ...emptyStreaks(), quick } }).cue).toBe("combo");
    for (const quick of [0, 1, 2, 4, 6, 31]) expect(captureFeedbackFor({ ...input, streaks: { ...emptyStreaks(), quick } }).cue).toBe("found");
    expect(captureFeedbackFor({ ...input, streaks: { ...emptyStreaks(), quick: 80 } }).options.intensity).toBe(1);
    expect(captureFeedbackFor({ ...input, streaks: { ...emptyStreaks(), clean: 15 } }).options.intensity).toBe(.5);
    expect(captureFeedbackFor({ ...input, levelDone: false, streaks: { ...emptyStreaks(), quick: 5 } })).toMatchObject({ cue: "found", options: { intensity: 0 }, celebration: null });
  });
});

describe("capture events in the game store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSaveStore.setState({ save: defaultSave(), loaded: true, readOnly: false });
    useGameStore.getState().setClearGameStore();
    useGameStore.setState({ gameState: GameStateEnum.PLAYING });
    useGameStore.getState().setCurrentSpec(generateLevel(1, { seed: 7, tier: "normal", pool: charactersDetails }));
    useGameStore.getState().setAnimationLevelLoading(false);
  });
  it("plays repeated same cues immediately without leaving a latent request", () => {
    useGameStore.getState().setSoundSrc("countdown");
    useGameStore.getState().setSoundSrc("countdown");
    expect(playLegacySound).toHaveBeenCalledTimes(2);
    expect(useGameStore.getState().soundSrc).toBe("");
    useGameStore.getState().setSound(false);
    useGameStore.getState().setSoundSrc("found");
    expect(playLegacySound).toHaveBeenCalledTimes(2);
  });
  it("pays and sounds a completed rapid series once even with duplicate taps", () => {
    useGameStore.setState({ streaks: { ...emptyStreaks(), quick: 9, clean: 9 } });
    useGameStore.getState().recordTargetFound(1, true);
    useGameStore.getState().recordTargetFound(1, true);
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("reward", { stars: 5 });
    expect(useSaveStore.getState().save.wallet.stars).toBe(6);
  });
  it("does not celebrate an unpaid bonus from a read-only save", () => {
    useSaveStore.setState({ readOnly: true });
    useGameStore.setState({ streaks: { ...emptyStreaks(), quick: 9, clean: 9 } });
    useGameStore.getState().recordTargetFound(1, true);
    expect(playSound).not.toHaveBeenCalledWith("reward", expect.anything());
    expect(useGameStore.getState().bonusToast).toBeNull();
  });
});
