import { describe, expect, it } from "vitest";
import { generateLevel } from "../../../../engine/generateLevel";
import type { LevelSpec } from "../../../../engine/types";
import { charactersDetails } from "../../../../helpers/characters";
import { pickCharacterAt } from "../../../../helpers/hitTest";
import { createCrossingRoutes, crossingCharacterAt } from "../crossingMovement";
import { areaOf, placeSwarm } from "../layouts";
import { advanceMovementClock, createMovementClock, createSwarmMovement, suspendMovementClock, swarmCharacterAt } from "../movements";

const base = generateLevel(11, { seed: 42, tier: "normal", pool: charactersDetails, allowedRules: ["classic"] });
const makeSpec = (seed = 42, count = 140, speed = .5): LevelSpec => ({
  ...base, seed, layout: "swarm", rule: "classic", params: { movement: "crossing", count, speed },
});

describe("vagues qui traversent le plateau", () => {
  it("prépare des groupes opposés et asynchrones, des courbes variées et un tirage reproductible", () => {
    const spec = makeSpec();
    const area = areaOf(spec);
    const characters = placeSwarm(spec);
    const routes = createCrossingRoutes(spec, characters, area);
    expect(createCrossingRoutes(spec, characters, area)).toEqual(routes);
    expect(createSwarmMovement(spec, characters, area)).toEqual(routes);
    expect(routes).toHaveLength(140);
    expect(new Set(routes.map((route) => route.direction))).toEqual(new Set([-1, 1]));
    expect(new Set(routes.map((route) => route.group)).size).toBe(12);
    expect(new Set(routes.map((route) => route.duration)).size).toBe(12);
    expect(new Set(routes.map((route) => route.phase)).size).toBe(140);
    for (const route of routes) {
      expect(new Set(route.curves.map((curve) => JSON.stringify(curve))).size).toBe(8);
      expect(swarmCharacterAt(route, 2, area, "bounce")).toEqual(crossingCharacterAt(route, 2, area));
      const before = crossingCharacterAt(route, 0, area);
      const after = crossingCharacterAt(route, .01, area);
      expect(Math.sign(after.x - before.x)).toBe(route.direction);
    }
    expect(createCrossingRoutes({ ...spec, seed: 77 }, characters, area)).not.toEqual(routes);
  });

  it("commence avec toutes les têtes visibles et ne cache jamais une tête complète plus de 3 secondes", () => {
    for (const seed of [1, 7, 42, 800]) for (const count of [60, 100, 140, 160]) {
      const spec = makeSpec(seed, count, .2);
      const area = areaOf(spec);
      const routes = createCrossingRoutes(spec, placeSwarm(spec), area);
      let largestAbsence = 0;
      for (const route of routes) {
        const first = crossingCharacterAt(route, 0, area);
        expect(first.x).toBeGreaterThanOrEqual(area.size / 2);
        expect(first.x).toBeLessThanOrEqual(area.w - area.size / 2);
        let absence = 0;
        // Le passage de deux frontières inclut deux retours par des courbes différentes.
        for (let time = 0; time <= route.duration * 2.1; time += .05) {
          const point = crossingCharacterAt(route, time, area);
          const visible = point.x >= area.size / 2 && point.x <= area.w - area.size / 2;
          absence = visible ? 0 : absence + .05;
          largestAbsence = Math.max(largestAbsence, absence);
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
            || point.x < -route.clearance || point.x > area.w + route.clearance
            || point.y < area.size / 2 - 1e-8 || point.y > area.h - area.size / 2 + 1e-8) {
            throw new Error(`Position invalide pour ${seed}, ${route.character.id}, ${time}`);
          }
        }
      }
      expect(largestAbsence).toBeLessThan(3);
    }
  });

  it("ne raccorde les traversées qu'une fois la tête entièrement sortie et garde une vitesse lisible", () => {
    const spec = makeSpec();
    const area = areaOf(spec);
    const routes = createCrossingRoutes(spec, placeSwarm(spec), area);
    const dt = .00001;
    let largestSpeed = 0;
    for (const route of routes) {
      for (let cycle = 1; cycle <= 9; cycle++) {
        const resetAt = (cycle - route.phase) * route.duration;
        const before = crossingCharacterAt(route, resetAt - dt, area);
        const after = crossingCharacterAt(route, resetAt + dt, area);
        for (const position of [before, after]) {
          expect(position.x < -area.size / 2 || position.x > area.w + area.size / 2).toBe(true);
        }
        for (let progress = .05; progress < .95; progress += .1) {
          const time = (cycle + progress - route.phase) * route.duration;
          const a = crossingCharacterAt(route, time, area);
          const b = crossingCharacterAt(route, time + dt, area);
          largestSpeed = Math.max(largestSpeed, Math.hypot(b.x - a.x, b.y - a.y) / dt);
        }
      }
    }
    expect(largestSpeed).toBeLessThan(80);
  });

  it("conserve la même loi après promotion d'un figurant en cible et son accessoire", () => {
    const spec = makeSpec();
    const area = areaOf(spec);
    const characters = placeSwarm(spec).map((character) => ({ ...character, look: { ...character.look, accessoryId: "moustache" as const } }));
    const promoted = characters.find((character) => !character.isWanted)!;
    const routes = createCrossingRoutes(spec, characters, area);
    const swapped = createCrossingRoutes(spec, characters.map((character) => ({ ...character, isWanted: character.id === promoted.id })), area);
    const byId = new Map(swapped.map((route) => [route.character.id, route]));
    expect(swapped.at(-1)?.character.id).toBe(promoted.id);
    for (const time of [0, 1, 9, 30, 75]) for (const route of routes) {
      const before = crossingCharacterAt(route, time, area);
      const after = crossingCharacterAt(byId.get(route.character.id)!, time, area);
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
      expect(after.look.accessoryId).toBe("moustache");
    }
  });

  it("rend la cible touchable à sa position effective au-dessus des vagues", () => {
    const spec = makeSpec();
    const area = areaOf(spec);
    const routes = createCrossingRoutes(spec, placeSwarm(spec), area);
    expect(routes.at(-1)?.character.isWanted).toBe(true);
    for (let time = 0; time <= 60; time += .25) {
      const characters = routes.map((route) => crossingCharacterAt(route, time, area));
      const target = characters.find((character) => character.isWanted)!;
      if (target.x < 0 || target.x > area.w) continue;
      const hits = characters.map((character, z) => ({ id: character.id, cx: character.x, cy: character.y, size: area.size, z, isWanted: character.isWanted }));
      expect(pickCharacterAt(target.x, target.y, hits)?.id).toBe(target.id);
    }
  });

  it("évalue les mêmes positions à 30/60/120 fps et ne rattrape pas une pause", () => {
    const spec = makeSpec();
    const area = areaOf(spec);
    const route = createCrossingRoutes(spec, placeSwarm(spec), area)[0];
    const expected = crossingCharacterAt(route, 4, area);
    for (const fps of [30, 60, 120]) {
      const clock = createMovementClock();
      for (let frame = 0; frame <= fps * 4; frame++) advanceMovementClock(clock, frame * 1000 / fps, true);
      suspendMovementClock(clock);
      advanceMovementClock(clock, 90_000, true);
      const actual = crossingCharacterAt(route, clock.elapsed, area);
      expect(actual.x).toBeCloseTo(expected.x, 7);
      expect(actual.y).toBeCloseTo(expected.y, 7);
    }
  });
});
