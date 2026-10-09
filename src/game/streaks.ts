export const STREAK_REWARD = 5;
export const CLEAN_TARGET = 30;
export const QUICK_TARGET = 10;
export const QUICK_LIMIT_MS = 10_000;

export type Streaks = { clean: number; quick: number; cleanBonuses: number; quickBonuses: number; found: number };
export type StreakEvent = { type: "miss" } | { type: "found"; elapsedMs: number | null };
export const emptyStreaks = (): Streaks => ({ clean: 0, quick: 0, cleanBonuses: 0, quickBonuses: 0, found: 0 });

// Every full series earns a bonus. Mistakes reset both series, slow finds only speed.
export function advanceStreaks(state: Streaks, event: StreakEvent): { streaks: Streaks; reward: number } {
  if (event.type === "miss") return { streaks: { ...state, clean: 0, quick: 0 }, reward: 0 };
  const clean = state.clean + 1;
  const quick = event.elapsedMs !== null && Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0 && event.elapsedMs < QUICK_LIMIT_MS
    ? state.quick + 1 : 0;
  const cleanBonus = clean % CLEAN_TARGET === 0 ? 1 : 0;
  const quickBonus = quick > 0 && quick % QUICK_TARGET === 0 ? 1 : 0;
  return {
    streaks: { clean, quick, cleanBonuses: state.cleanBonuses + cleanBonus, quickBonuses: state.quickBonuses + quickBonus, found: state.found + 1 },
    reward: (cleanBonus + quickBonus) * STREAK_REWARD,
  };
}
