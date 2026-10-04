import { createRng, hash32, weightedPick } from "../engine/rng";
import type { Rng } from "../engine/rng";
import { BOARD } from "../engine/types";
import type { Tier } from "../engine/types";

export type FlightKind = "solo" | "small" | "flock" | "giant";
export type Bird = {
  width: number;
  y: number;
  drift: number;
  delayMs: number;
  durationMs: number;
  bank: number;
};
export type Flight = {
  kind: FlightKind;
  direction: 1 | -1;
  birds: Bird[];
  durationMs: number;
};
export type FlightFrame = { flight: Flight; ageMs: number };
export const GIANT_COOLDOWN_MS = 45_000;

export function makeFlight(rng: Rng, kind: FlightKind): Flight {
  const giant = kind === "giant";
  const count = kind === "solo" || giant ? 1 : kind === "small" ? rng.int(2, 3) : rng.int(7, 8);
  const direction = rng.chance(0.5) ? 1 : -1;
  const duration = giant ? 3_200 : rng.int(2_800, 4_000);
  const baseline = rng.int(100, BOARD.h - 100);
  const birds: Bird[] = Array.from({ length: count }, (_, i) => ({
    width: giant ? BOARD.w * 9 : rng.int(86, kind === "flock" ? 132 : 160),
    y: giant ? BOARD.h / 2 : Math.max(55, Math.min(BOARD.h - 55, baseline + rng.int(-150, 150))),
    drift: giant ? 0 : rng.int(-45, 45),
    delayMs: i * rng.int(80, 180),
    durationMs: duration + (giant ? 0 : rng.int(-250, 250)),
    bank: giant ? 0 : rng.int(-8, 8) * Math.PI / 180,
  }));
  return { kind, direction, birds, durationMs: Math.max(...birds.map(b => b.delayMs + b.durationMs)) };
}

// Le point d'ancrage suit la poitrine du sprite, pour que le gros goéland
// remplisse réellement le plateau au milieu de son passage.
export function birdPose(bird: Bird, flight: Flight, ageMs: number) {
  const progress = (ageMs - bird.delayMs) / bird.durationMs;
  if (progress < 0 || progress > 1) return null;
  const margin = bird.width * 0.65;
  const t = progress * 2 - 1;
  const across = flight.kind === "giant"
    ? BOARD.w / 2 + Math.sign(t) * t * t * (BOARD.w / 2 + margin)
    : -margin + progress * (BOARD.w + 2 * margin);
  return {
    x: flight.direction === 1 ? across : BOARD.w - across,
    y: bird.y + bird.drift * Math.sin(Math.PI * progress),
    bank: bird.bank + (flight.kind === "giant" ? 0 : Math.sin(progress * Math.PI * 2) * 0.035),
  };
}

// Horloge de jeu actif : ni les pauses, ni les transitions, ni les onglets cachés
// ne consomment les délais. Elle survit aux changements d'animal d'une partie.
export class SeagullDirector {
  private rng: Rng;
  private elapsedMs = 0;
  private nextAt: number;
  private startedAt = 0;
  private flight: Flight | null = null;
  private previous: FlightKind | null = null;
  private passCount = 0;
  private lastGiantAt = -Infinity;
  private requested: FlightKind | null = null;

  constructor(seed: number, private tier: Tier) {
    this.rng = createRng(hash32(seed, "seagulls-v1"));
    this.nextAt = this.rng.int(5_000, 8_000);
  }

  preview(kind: FlightKind) { this.requested = kind; }

  cancel() {
    if (!this.flight) return;
    this.flight = null;
    this.nextAt = this.elapsedMs + this.rng.int(4_000, 7_000);
  }

  advance(deltaMs: number, active: boolean, canStart: boolean): FlightFrame | null {
    if (active) this.elapsedMs += Math.max(0, Math.min(deltaMs, 100));
    if (this.flight && this.elapsedMs - this.startedAt >= this.flight.durationMs) {
      this.flight = null;
      this.nextAt = this.elapsedMs + this.rng.int(this.tier === "easy" ? 9_000 : 6_000, 13_000);
    }
    if (active && (this.requested || (canStart && !this.flight && this.elapsedMs >= this.nextAt))) {
      const kinds: [FlightKind, number][] = [
        ["solo", 3], ["small", 4], ["flock", this.passCount >= 1 ? 2 : 0],
        ["giant", this.passCount >= 2 && this.elapsedMs - this.lastGiantAt >= GIANT_COOLDOWN_MS ? 1.5 : 0],
      ];
      const kind = this.requested ?? weightedPick(this.rng, kinds.map(([k, w]) => [k, k === this.previous ? 0 : w] as const))!;
      this.requested = null;
      this.flight = makeFlight(this.rng, kind);
      this.startedAt = this.elapsedMs;
      this.previous = kind;
      this.passCount++;
      if (kind === "giant") this.lastGiantAt = this.elapsedMs;
    }
    return this.flight ? { flight: this.flight, ageMs: this.elapsedMs - this.startedAt } : null;
  }
}
