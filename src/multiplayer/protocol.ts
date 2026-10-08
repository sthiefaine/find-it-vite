import type { LevelSpec } from "../engine/types";

export const MULTIPLAYER_PATH = "/ws";
export const MULTIPLAYER_PROTOCOL_VERSION = 2;
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
export type MultiplayerTheme = "animaux" | "ferme" | "foret" | "savane" | "ocean" | "politique";
export type RoomStatus = "waiting" | "countdown" | "playing" | "finished";
export type PlayerPhase = "waiting" | "preparing" | "countdown" | "playing" | "eliminated";
export type LastResult = "correct" | "wrong" | "timeout" | "disconnected" | "left" | "assets-timeout";

export type MatchRules = {
  lives: number;
  initialTimeMs: number;
  correctBonusMs: number;
  maxTimeMs: number;
  countdownMs: number;
  preparationTimeoutMs: number;
  disconnectGraceMs: number;
  maxMatchMs: number;
};

export const DEFAULT_MATCH_RULES: Readonly<MatchRules> = {
  lives: 3,
  initialTimeMs: 60_000,
  correctBonusMs: 5_000,
  maxTimeMs: 60_000,
  countdownMs: 3_000,
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
};

export type RoomSnapshot = {
  code: string;
  status: RoomStatus;
  theme: MultiplayerTheme;
  players: PublicPlayer[];
  rules: MatchRules;
  winnerIds: string[];
  finishReason: "lives" | "timeout" | "abandoned" | "time-limit" | null;
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
  | { type: "create"; name: string; theme: MultiplayerTheme }
  | { type: "join"; code: string; name: string }
  | { type: "resume"; code: string; token: string }
  | { type: "ready"; ready: boolean }
  | { type: "assetsReady"; levelNonce: string }
  | { type: "tap"; levelNonce: string; characterId: number }
  | { type: "leave" }
  | { type: "ping"; clientTime: number }
) & { protocolVersion?: number };

export type ServerMessage =
  | { type: "session"; protocolVersion: number; playerId: string; token: string; code: string }
  | { type: "state"; protocolVersion: number; serverNow: number; room: RoomSnapshot; self: SelfSnapshot }
  | { type: "pong"; clientTime: number; serverNow: number }
  | { type: "left" }
  | { type: "error"; code: string; message: string };
