import { describe, expect, it } from "vitest";
import { emptyMatchSoundSnapshot, matchSoundEvents, type MatchSoundSnapshot } from "../audioFeedback";

const playing: MatchSoundSnapshot = { ...emptyMatchSoundSnapshot(), matchId: "ROOM:self", connected: true, phase: "playing", nonce: "level1" };

describe("confirmed multiplayer audio", () => {
  it("sounds a confirmed point or error once, never from a tap", () => {
    const correct = { ...playing, sequence: 1, result: "correct" as const };
    expect(matchSoundEvents(playing, correct)).toEqual(["found"]);
    expect(matchSoundEvents(correct, correct)).toEqual([]);
    expect(matchSoundEvents(correct, { ...correct, sequence: 2, result: "wrong" })).toEqual(["miss"]);
    expect(matchSoundEvents(correct, { ...correct, sequence: 2, result: "timeout" })).toEqual(["miss"]);
  });
  it("does not replay historical results on first load or while disconnected", () => {
    const historical = { ...playing, sequence: 4, result: "correct" as const };
    expect(matchSoundEvents(emptyMatchSoundSnapshot(), historical)).toEqual(["start"]);
    const offline = { ...historical, connected: false, sequence: 5 };
    expect(matchSoundEvents(historical, offline)).toEqual([]);
    expect(matchSoundEvents(offline, { ...offline, connected: true })).toEqual([]);
  });
  it("ticks each countdown value and starts once per board", () => {
    const three = { ...playing, phase: "countdown" as const, countdown: 3 };
    expect(matchSoundEvents(emptyMatchSoundSnapshot(), three)).toEqual(["countdown"]);
    expect(matchSoundEvents(three, three)).toEqual([]);
    expect(matchSoundEvents(three, { ...three, countdown: 2 })).toEqual(["countdown"]);
    expect(matchSoundEvents(three, playing)).toEqual(["start"]);
    expect(matchSoundEvents(playing, playing)).toEqual([]);
  });
  it("absorbs the first resumed snapshot even when the socket opens before it arrives", () => {
    const before = { ...playing, connectionEpoch: 1, sequence: 4, result: "correct" as const };
    const reopening = { ...before, connected: true };
    expect(matchSoundEvents({ ...before, connected: false }, reopening)).toEqual([]);
    const resumed = { ...before, connectionEpoch: 2, sequence: 6, nonce: "level6" };
    expect(matchSoundEvents(reopening, resumed)).toEqual([]);
    expect(matchSoundEvents(resumed, { ...resumed, sequence: 7 })).toEqual(["found"]);
    expect(matchSoundEvents(reopening, { ...resumed, finished: true, outcome: "win" })).toEqual([]);
  });
  it("gives the final outcome priority over the last point and ignores repeated snapshots", () => {
    for (const outcome of ["win", "lose", "draw"] as const) {
      const finished = { ...playing, sequence: 1, result: "correct" as const, finished: true, outcome };
      expect(matchSoundEvents(playing, finished)).toEqual([outcome]);
      expect(matchSoundEvents(finished, finished)).toEqual([]);
    }
  });
});
