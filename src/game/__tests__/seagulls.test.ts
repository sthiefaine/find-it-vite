import { describe, expect, it } from "vitest";
import { createRng } from "../../engine/rng";
import { birdPose, GIANT_COOLDOWN_MS, makeFlight, SeagullDirector } from "../seagulls";
import type { Flight } from "../seagulls";
import { BOARD } from "../../engine/types";

function simulate(seed: number, political = false, tier: "easy" | "normal" | "expert" = "normal", level = 40) {
  const director = new SeagullDirector(seed, tier, political);
  const passes: { at: number; flight: Flight }[] = [];
  let previous: Flight | undefined;
  for (let at = 0; at < 600_000; at += 50) {
    const frame = director.advance(50, true, true, level);
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
    for (const kind of Object.keys(counts) as (keyof typeof counts)[]) {
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

describe("foules du thème politique", () => {
  it("renouvelle les tailles, silhouettes et sens avec une graine reproductible", () => {
    const passes = simulate(24, true);
    expect(passes).toEqual(simulate(24, true));
    expect(passes).not.toEqual(simulate(25, true));
    expect(new Set(passes.map(p => p.flight.kind))).toEqual(new Set(["solo", "small", "flock", "horde", "surge"]));
    const counts = passes.map(p => p.flight.birds.length);
    expect(counts.some(count => count >= 15 && count <= 20)).toBe(true);
    expect(counts.some(count => count > 20 && count <= 30)).toBe(true);
    expect(new Set(counts).size).toBeGreaterThan(8);
    for (let i = 1; i < passes.length; i++) expect(passes[i].flight.kind).not.toBe(passes[i - 1].flight.kind);
    const crowd = makeFlight(createRng(28), "horde", true);
    expect(new Set(crowd.birds.map(b => b.sprite))).toEqual(new Set([0, 1, 2]));
    expect(new Set(crowd.birds.map(b => b.direction))).toEqual(new Set([-1, 1]));
    // Assez de membres restent simultanément à l'écran pour former une horde.
    const visible = crowd.birds.map(b => birdPose(b, crowd, 2200)).filter(p => p && p.x >= 0 && p.x <= BOARD.w);
    expect(visible.length).toBeGreaterThanOrEqual(12);
  });

  it("réserve les très grandes foules aux niveaux avancés et limite Enfant", () => {
    for (const seed of [4, 24, 99]) {
      expect(simulate(seed, true, "easy").every(p => p.flight.birds.length <= 8)).toBe(true);
      expect(simulate(seed, true, "normal", 19).every(p => p.flight.birds.length <= 20)).toBe(true);
      expect(simulate(seed, true, "expert", 11).every(p => p.flight.birds.length <= 20)).toBe(true);
    }
    const expertCounts = Array.from({ length: 100 }, (_, seed) => makeFlight(createRng(seed), "surge", true, "expert").birds.length);
    expect(Math.max(...expertCounts)).toBe(36);
    expect(Math.min(...expertCounts)).toBe(21);
  });

  it("suspend une horde en pause et la retire lors d'une transition", () => {
    const director = new SeagullDirector(4, "normal", true);
    director.preview("horde");
    const frame = director.advance(100, true, true, 20);
    expect(frame?.flight.birds.length).toBeGreaterThanOrEqual(15);
    expect(director.advance(60_000, false, true, 20)).toEqual(frame);
    director.cancel();
    expect(director.advance(16, true, false, 20)).toBeNull();
  });
});
