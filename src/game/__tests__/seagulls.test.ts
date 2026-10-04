import { describe, expect, it } from "vitest";
import { createRng } from "../../engine/rng";
import { birdPose, GIANT_COOLDOWN_MS, makeFlight, SeagullDirector } from "../seagulls";
import type { Flight, FlightKind } from "../seagulls";
import { BOARD } from "../../engine/types";

function simulate(seed: number) {
  const director = new SeagullDirector(seed, "normal");
  const passes: { at: number; flight: Flight }[] = [];
  let previous: Flight | undefined;
  for (let at = 0; at < 600_000; at += 50) {
    const frame = director.advance(50, true, true);
    if (frame && previous !== frame.flight) passes.push({ at, flight: frame.flight });
    previous = frame?.flight;
  }
  return passes;
}

describe("passages de goélands", () => {
  it("rejoue les mêmes formations avec la même graine, et varie entre parties", () => {
    expect(simulate(24)).toEqual(simulate(24));
    expect(simulate(24)).not.toEqual(simulate(25));
  });

  it("varie les groupes sans répétition immédiate et espace les géants", () => {
    const passes = simulate(24);
    expect(new Set(passes.map(p => p.flight.kind)).size).toBe(4);
    let lastGiant = -Infinity;
    for (let i = 0; i < passes.length; i++) {
      const pass = passes[i];
      expect(pass.flight.kind).not.toBe(passes[i - 1]?.flight.kind);
      if (pass.flight.kind === "giant") {
        expect(i).toBeGreaterThanOrEqual(2);
        expect(pass.at - lastGiant).toBeGreaterThanOrEqual(GIANT_COOLDOWN_MS);
        lastGiant = pass.at;
      }
      if (i > 0) expect(pass.at - passes[i - 1].at - passes[i - 1].flight.durationMs).toBeGreaterThanOrEqual(5_950);
    }
  });

  it("respecte les tailles de groupes et entre/sort entièrement du plateau", () => {
    const counts = { solo: [1], small: [2, 3], flock: [7, 8], giant: [1] };
    for (const kind of Object.keys(counts) as FlightKind[]) {
      const flight = makeFlight(createRng(28), kind);
      expect(counts[kind]).toContain(flight.birds.length);
      for (const bird of flight.birds) {
        expect(birdPose(bird, flight, bird.delayMs - 1)).toBeNull();
        const start = birdPose(bird, flight, bird.delayMs)!;
        const end = birdPose(bird, flight, bird.delayMs + bird.durationMs)!;
        expect(Math.min(start.x, end.x) + bird.width * 0.6).toBeLessThan(0);
        expect(Math.max(start.x, end.x) - bird.width * 0.6).toBeGreaterThan(BOARD.w);
      }
    }
  });

  it("suspend délai et vol pendant une pause, puis reprend sans saut", () => {
    const director = new SeagullDirector(4, "normal");
    for (let i = 0; i < 1000; i++) expect(director.advance(100, false, true)).toBeNull();
    director.preview("small");
    director.advance(16, true, true);
    const before = director.advance(100, true, true);
    expect(director.advance(60_000, false, true)).toEqual(before);
    expect(director.advance(16, true, true)?.ageMs).toBe(before!.ageMs + 16);
  });

  it("ne déclenche rien dans un niveau inéligible et annule le masque à la transition", () => {
    const director = new SeagullDirector(4, "easy");
    for (let i = 0; i < 1000; i++) expect(director.advance(100, true, false)).toBeNull();
    director.preview("giant");
    expect(director.advance(16, true, true)?.flight.kind).toBe("giant");
    director.cancel();
    expect(director.advance(16, true, true)).toBeNull();
  });
});
