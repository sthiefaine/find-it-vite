import { describe, expect, it } from "vitest";
import { generateLevel } from "../../../../engine/generateLevel";
import type { LevelSpec } from "../../../../engine/types";
import { charactersDetails } from "../../../../helpers/characters";
import { pickCharacterAt } from "../../../../helpers/hitTest";
import { areaOf, placeSwarm, type SwarmCharacter } from "../layouts";
import { advanceMovementClock, createMovementClock, createSwarmMovement, suspendMovementClock, swarmCharacterAt } from "../movements";
import { createScatterRoutes, SCATTER_MAX_SPEED, SCATTER_SPEED_SPREAD, scatterCharacterAt, type ScatterRoute } from "../scatterMovement";

const base = generateLevel(21, { seed: 42, tier: "normal", pool: charactersDetails, allowedRules: ["classic"] });
const makeSpec = (seed = 42, count = 120, speed = .5, index = 24): LevelSpec =>
  ({ ...base, index, seed, layout: "swarm", rule: "classic", params: { movement: "scatter", count, speed, edgeBehavior: "bounce" } });
const routesOf = (spec: LevelSpec, characters: SwarmCharacter[] = placeSwarm(spec)) => createScatterRoutes(spec, characters, areaOf(spec));
const halfOf = (character: SwarmCharacter, size: number) =>
  size * character.look.scale / 2 * (Math.abs(Math.cos(character.look.rotation)) + Math.abs(Math.sin(character.look.rotation)));

describe("foule qui s'éparpille", () => {
  it("est reproductible et branchée sur l'essaim", () => {
    const spec = makeSpec();
    const area = areaOf(spec);
    const characters = placeSwarm(spec);
    const routes = routesOf(spec, characters);
    expect(routesOf(spec, characters)).toEqual(routes);
    expect(createSwarmMovement(spec, characters, area)).toEqual(routes);
    expect(routes).toHaveLength(characters.length);
    for (const route of routes) {
      expect(swarmCharacterAt(route, 7.3, area, "wrap")).toEqual(scatterCharacterAt(route, 7.3, area));
    }
    expect(routesOf({ ...spec, seed: 77 }, characters)).not.toEqual(routes);
    routes.slice(1).forEach((route, index) => expect(route.character.zIndex).toBeGreaterThanOrEqual(routes[index].character.zIndex));
  });

  it("part d'une formation puis explose dans tous les sens au bout de 1 à 2 s", () => {
    for (const seed of [1, 7, 42, 800]) {
      const spec = makeSpec(seed);
      const area = areaOf(spec);
      const routes = routesOf(spec);
      for (const route of routes) {
        expect(route.hold).toBeGreaterThanOrEqual(1);
        expect(route.hold).toBeLessThanOrEqual(2.25);
        const start = scatterCharacterAt(route, 0, area);
        expect(scatterCharacterAt(route, route.hold - .01, area)).toEqual(start);
        expect(start.x).toBe(route.origin.x);
        expect(start.y).toBe(route.origin.y);
      }
      // Grille ou ronde : peu de positions distinctes en x ou en y, ou des distances au centre régulières.
      const later = routes.map((route) => scatterCharacterAt(route, 6, area));
      const moved = later.filter((character, index) => Math.hypot(character.x - routes[index].origin.x, character.y - routes[index].origin.y) > 40);
      expect(moved.length / routes.length).toBeGreaterThan(.8);
      const quadrants = new Set(routes.map((route) => Math.floor(((route.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 2))));
      expect(quadrants.size).toBe(4);
    }
  });

  it("conserve les trajectoires par animal si l'ordre de dessin change, cible comprise", () => {
    const spec = makeSpec();
    const area = areaOf(spec);
    const characters = placeSwarm(spec);
    const reordered = characters.slice().reverse().map((character) => ({
      ...character, zIndex: character.isWanted ? 1000 : -character.zIndex,
    }));
    const routes = routesOf(spec, characters);
    const changed = routesOf(spec, reordered);
    const byId = new Map(changed.map((route) => [route.character.id, route]));
    for (const time of [0, 1.5, 3.7, 31, 89, 300]) for (const route of routes) {
      const before = scatterCharacterAt(route, time, area);
      const after = scatterCharacterAt(byId.get(route.character.id)!, time, area);
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
    }
    expect(changed.at(-1)?.character.isWanted).toBe(true);
  });

  it("garde chaque tête dans le plateau, accessoires et rotations compris", () => {
    for (const seed of [1, 42, 77]) for (const speed of [.2, .6, 3]) {
      const spec = makeSpec(seed, 160, speed);
      const area = areaOf(spec);
      const characters = placeSwarm(spec).map((character, index) => index % 3 ? character
        : { ...character, look: { ...character.look, scale: 1.1, rotation: index % 2 ? .35 : -.2 } });
      const routes = routesOf(spec, characters);
      let outside = 0;
      for (let time = 0; time <= 400; time += .53) for (const route of routes) {
        const character = scatterCharacterAt(route, time, area);
        const half = halfOf(character, area.size) - 1e-9;
        if (!(character.x >= half && character.x <= area.w - half && character.y >= half && character.y <= area.h - half)) outside++;
      }
      expect(outside).toBe(0);
    }
  });

  it("borne les vitesses propres (±40 %) et la vitesse effective, virages et pauses compris", () => {
    for (const speed of [.2, .5, .6, 3]) {
      const spec = makeSpec(42, 140, speed);
      const area = areaOf(spec);
      const routes = routesOf(spec);
      const baseSpeed = Math.min(speed * 60, 40);
      let fastest = 0;
      let paused = false;
      let turned = false;
      for (const route of routes) {
        expect(route.speed).toBeGreaterThanOrEqual(baseSpeed * (1 - SCATTER_SPEED_SPREAD) - 1e-9);
        expect(route.speed).toBeLessThanOrEqual(baseSpeed * (1 + SCATTER_SPEED_SPREAD) + 1e-9);
        const dt = .02;
        let previous = scatterCharacterAt(route, 0, area);
        let previousHeading: number | null = null;
        for (let time = dt; time <= 45; time += dt) {
          const current = scatterCharacterAt(route, time, area);
          const velocity = Math.hypot(current.x - previous.x, current.y - previous.y) / dt;
          // Un rebond replie la trajectoire mais ne l'allonge pas.
          fastest = Math.max(fastest, velocity / route.speed);
          if (time > route.hold + 1 && velocity < route.speed * .05) paused = true;
          if (velocity > route.speed * .9) {
            const heading = Math.atan2(current.y - previous.y, current.x - previous.x);
            if (previousHeading !== null && Math.abs(Math.cos(heading - previousHeading)) < .995 && Math.cos(heading - previousHeading) > 0) turned = true;
            previousHeading = heading;
          }
          previous = current;
        }
      }
      expect(fastest).toBeLessThanOrEqual(1 + 1e-6);
      expect(Math.max(...routes.map((route) => route.speed))).toBeLessThanOrEqual(SCATTER_MAX_SPEED);
      expect(paused).toBe(true);
      expect(turned).toBe(true);
    }
  });

  it("donne à la cible exactement la loi des autres : même trajectoire si un figurant est promu, même distribution de vitesse", () => {
    const spec = makeSpec();
    const area = areaOf(spec);
    const characters = placeSwarm(spec);
    const promoted = characters.find((character) => !character.isWanted)!;
    const routes = routesOf(spec, characters);
    const swapped = routesOf(spec, characters.map((character) => ({ ...character, isWanted: character.id === promoted.id })));
    const byId = new Map(swapped.map((route) => [route.character.id, route]));
    for (const time of [0, 1.5, 9, 60, 300]) for (const route of routes) {
      const before = scatterCharacterAt(route, time, area);
      const after = scatterCharacterAt(byId.get(route.character.id)!, time, area);
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
    }
    // Sur de nombreuses parties, la vitesse de la cible suit la même loi uniforme
    // que celle des figurants : moyenne et quartiles comparables.
    const wanted: number[] = [];
    const decoys: number[] = [];
    for (let seed = 1; seed <= 400; seed++) {
      const level = makeSpec(seed, 40, .5);
      for (const route of routesOf(level)) (route.character.isWanted ? wanted : decoys).push(route.speed / 30);
    }
    const quartiles = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return [.25, .5, .75].map((q) => sorted[Math.floor(q * (sorted.length - 1))]);
    };
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(wanted.length).toBeGreaterThanOrEqual(400);
    expect(Math.abs(mean(wanted) - mean(decoys))).toBeLessThan(.04);
    quartiles(wanted).forEach((value, index) => expect(Math.abs(value - quartiles(decoys)[index])).toBeLessThan(.08));
    expect(Math.min(...wanted)).toBeLessThan(.7);
    expect(Math.max(...wanted)).toBeGreaterThan(1.3);
  });

  it("garde la cible touchable même en partie recouverte et reprend au même endroit après une pause", () => {
    const spec = makeSpec();
    const area = areaOf(spec);
    const routes: ScatterRoute[] = routesOf(spec);
    for (let time = 0; time <= 60; time += .5) {
      const characters = routes.map((route) => scatterCharacterAt(route, time, area));
      const target = characters.find((character) => character.isWanted)!;
      const hits = characters.map((c, z) => ({ id: c.id, cx: c.x, cy: c.y, size: area.size, z, isWanted: c.isWanted }));
      expect(pickCharacterAt(target.x, target.y, hits)?.id).toBe(target.id);
    }
    const reference = routes.map((route) => scatterCharacterAt(route, 12, area));
    for (const fps of [30, 60, 120]) {
      const clock = createMovementClock();
      for (let frame = 0; frame <= fps * 12; frame++) advanceMovementClock(clock, frame * 1000 / fps, true);
      suspendMovementClock(clock);
      advanceMovementClock(clock, 90_000, true);
      routes.forEach((route, index) => {
        const character = scatterCharacterAt(route, clock.elapsed, area);
        expect(character.x).toBeCloseTo(reference[index].x, 7);
        expect(character.y).toBeCloseTo(reference[index].y, 7);
      });
    }
  });
});
