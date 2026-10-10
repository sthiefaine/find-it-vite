import type { LevelSpec } from "../engine/types";
import type { PlayThemeId } from "../content/playThemes";

export const MULTIPLAYER_PATH = "/ws";
export const MULTIPLAYER_PROTOCOL_VERSION = 3;
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
export type MultiplayerTheme = PlayThemeId;
export type RoomStatus = "waiting" | "countdown" | "playing" | "revealing" | "finished";
export type PlayerPhase = "waiting" | "preparing" | "countdown" | "playing" | "revealing" | "eliminated";
export type LastResult = "correct" | "wrong" | "timeout" | "disconnected" | "left" | "assets-timeout";

export type MatchRules = {
  lives: number;
  initialTimeMs: number;
  correctBonusMs: number;
  maxTimeMs: number;
  countdownMs: number;
  revealMs: number;
  preparationTimeoutMs: number;
  disconnectGraceMs: number;
  maxMatchMs: number;
};

export const DEFAULT_MATCH_RULES: Readonly<MatchRules> = {
  lives: 3,
  initialTimeMs: 60_000,
  correctBonusMs: 2_000,
  maxTimeMs: 60_000,
  countdownMs: 3_000,
  revealMs: 1_800,
  preparationTimeoutMs: 15_000,
  disconnectGraceMs: 20_000,
  maxMatchMs: 0, // no time limit while both players remain in the match
};

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  score: number;
  lives: number;
  level: number;
  phase: PlayerPhase;
  remainingMs: number;
  deadline: number | null;
  mistakes: number;
  bestResponseMs: number | null;
};

export type TapPoint = { x: number; y: number };
export type MatchTap = TapPoint & {
  sequence: number;
  playerId: string;
  levelNonce: string;
  at: number;
  result: "correct" | "wrong" | "empty";
};
export type MatchReveal = {
  levelNonce: string;
  at: number;
  until: number;
  elapsedMs: number;
  winnerId: string | null;
};

export type RoomSnapshot = {
  code: string;
  status: RoomStatus;
  theme: MultiplayerTheme;
  players: PublicPlayer[];
  rules: MatchRules;
  winnerIds: string[];
  finishReason: "lives" | "timeout" | "abandoned" | "time-limit" | null;
  matchNumber: number;
  taps: MatchTap[];
  reveal: MatchReveal | null;
};

export type SelfSnapshot = {
  playerId: string;
  phase: PlayerPhase;
  levelNonce: string | null;
  spec: LevelSpec | null;
  startsAt: number | null;
  deadline: number | null;
  prepareDeadline: number | null;
  lastResult: LastResult | null;
  resultSequence: number;
  remainingMs: number;
};

export type ClientMessage = (
  | { type: "create"; name: string; theme: MultiplayerTheme; purchasedPeople?: string[] }
  | { type: "join"; code: string; name: string; purchasedPeople?: string[] }
  | { type: "resume"; code: string; token: string }
  | { type: "ready"; ready: boolean }
  | { type: "assetsReady"; levelNonce: string }
  | { type: "tap"; levelNonce: string; characterId: number | null; point?: TapPoint }
  | { type: "rematch"; ready: boolean }
  | { type: "leave" }
  | { type: "ping"; clientTime: number }
) & { protocolVersion?: number };

export type ServerMessage =
  | { type: "session"; protocolVersion: number; playerId: string; token: string; code: string }
  | { type: "state"; protocolVersion: number; serverNow: number; room: RoomSnapshot; self: SelfSnapshot }
  | { type: "pong"; clientTime: number; serverNow: number }
  | { type: "left" }
  | { type: "error"; code: string; message: string };
