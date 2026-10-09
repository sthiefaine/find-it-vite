import type { SoundCue, SoundOptions } from "../audio/cues";
import { CLEAN_TARGET, QUICK_TARGET, type Streaks } from "./streaks";

export type CaptureFeedback = {
  cue: SoundCue;
  options: SoundOptions;
  celebration: "combo" | "reward" | "step" | null;
  count: number;
};

// A capture has one main sound. Actual rewards take precedence over the hit.
export function captureFeedbackFor({ golden, levelDone, streaks, bonusStars, stepStars }: {
  golden: boolean;
  levelDone: boolean;
  streaks: Streaks;
  bonusStars: number;
  stepStars: number | null;
}): CaptureFeedback {
  if (bonusStars > 0) return { cue: "reward", options: { stars: bonusStars }, celebration: "reward", count: bonusStars };
  if (stepStars !== null) return { cue: "step", options: { stars: stepStars }, celebration: "step", count: stepStars };
  if (golden) return { cue: "golden", options: {}, celebration: null, count: 0 };
  const intensity = levelDone ? Math.min(Math.max(streaks.quick / QUICK_TARGET, streaks.clean / CLEAN_TARGET), 1) : 0;
  const combo = levelDone && streaks.quick >= 3 && (streaks.quick === 3 || streaks.quick % 5 === 0);
  return { cue: combo ? "combo" : "found", options: { intensity }, celebration: combo ? "combo" : null, count: combo ? streaks.quick : 0 };
}
