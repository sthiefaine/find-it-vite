import type { SoundCue } from "../audio/cues";
import type { LastResult, PlayerPhase } from "./protocol";

export type MatchSoundSnapshot = {
  matchId: string | null;
  connectionEpoch: number;
  sequence: number;
  result: LastResult | null;
  phase: PlayerPhase | null;
  nonce: string | null;
  countdown: number | null;
  finished: boolean;
  outcome: "win" | "lose" | "draw";
  connected: boolean;
};
export const emptyMatchSoundSnapshot = (): MatchSoundSnapshot => ({ matchId: null, connectionEpoch: 0, sequence: 0, result: null, phase: null, nonce: null, countdown: null, finished: false, outcome: "draw", connected: false });

// Only confirmed, new server events produce sound. Reconnection never replays a point.
export function matchSoundEvents(previous: MatchSoundSnapshot, next: MatchSoundSnapshot): SoundCue[] {
  if (!next.matchId || !next.connected) return [];
  const sameMatch = previous.matchId === next.matchId;
  const sameConnection = sameMatch && previous.connectionEpoch === next.connectionEpoch;
  if (next.finished) return sameConnection && !previous.finished ? [next.outcome] : [];
  const cues: SoundCue[] = [];
  if (sameConnection && next.sequence > previous.sequence) {
    if (next.result === "correct") cues.push("found");
    else if (next.result === "wrong" || next.result === "timeout") cues.push("miss");
  }
  if (next.phase === "countdown" && next.countdown !== null && next.countdown >= 1 && next.countdown <= 3 &&
      (!sameMatch || next.nonce !== previous.nonce || next.countdown !== previous.countdown)) cues.push("countdown");
  if (next.phase === "playing" && (!sameMatch || (sameConnection && (next.nonce !== previous.nonce || previous.phase !== "playing")))) cues.push("start");
  return cues;
}
