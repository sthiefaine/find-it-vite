import { describe, expect, it } from "vitest";
import { generateLevel } from "../../../../engine/generateLevel";
import { BOARD, type LevelSpec } from "../../../../engine/types";
import { charactersDetails } from "../../../../helpers/characters";
import { pickCharacterAt } from "../../../../helpers/hitTest";
import { areaOf, layoutScroll, placeSwarm } from "../layouts";
import {
  advanceMovementClock, createMovementClock, createScrollMovement, createSwarmMovement,
  MAX_MOVEMENT_FRAME_S, scrollCrossAt, scrollOffsetAt, stopGoTime, suspendMovementClock, swarmCharacterAt,
} from "../movements";

const base = generateLevel(11, { seed: 42, tier: "normal", pool: charactersDetails, allowedRules: ["classic"] });
const specWith = (params: LevelSpec["params"], seed = 42): LevelSpec => ({ ...base, seed, rule: "classic", params });

describe("horloge du mouvement", () => {
  it("produit le même temps actif à 30, 60 et 120 fps", () => {
    for (const fps of [30, 60, 120]) {
      const clock = createMovementClock();
      for (let frame = 0; frame <= fps * 10; frame++) advanceMovementClock(clock, frame * 1000 / fps, true);
      expect(clock.elapsed).toBeCloseTo(10, 8);
    }
  });

  it("ne rattrape ni la pause ni un onglet masqué et borne un frame lent", () => {
    const clock = createMovementClock();
    advanceMovementClock(clock, 0, true);
    advanceMovementClock(clock, 50, true);
    advanceMovementClock(clock, 100, false);
    advanceMovementClock(clock, 50_000, true);
    expect(clock.elapsed).toBeCloseTo(0.05);
    expect(advanceMovementClock(clock, 51_000, true)).toBe(MAX_MOVEMENT_FRAME_S);
    suspendMovementClock(clock);
    expect(advanceMovementClock(clock, 90_000, true)).toBe(0);
    expect(advanceMovementClock(clock, 90_020, true)).toBeCloseTo(0.02);
    expect(advanceMovementClock(clock, 89_000, true)).toBe(0);
    expect(advanceMovementClock(clock, Number.NaN, true)).toBe(0);
  });
});

describe("couloirs ondulants et marche-arrêt", () => {
  it("préserve exactement le défilement précédent sans nouveau mouvement", () => {
    const spec = specWith({ speed: 0.6, alternateDirection: true });
    const layout = layoutScroll(spec);
    const movement = createScrollMovement(spec, layout);
    for (const slot of layout.slots) {
      expect(scrollOffsetAt(movement, slot.line, layout.speeds[slot.line], 2.7)).toBeCloseTo(layout.speeds[slot.line] * 2.7 * 60);
      expect(scrollCrossAt(movement, slot, 22, layout.period, layout.size)).toBe(slot.cross);
    }
  });

  it("garde les vagues continues aux copies de bord, bornées et individuelles", () => {
    for (const scrollDirection of ["horizontal", "vertical"] as const) {
      for (const seed of [1, 42, 800]) {
        const spec = specWith({ movement: "wave", speed: 0.7, scrollDirection, extraLines: 2 }, seed);
        const layout = layoutScroll(spec);
        const movement = createScrollMovement(spec, layout);
        expect(createScrollMovement(spec, layout)).toEqual(movement);
        const centerLine = layout.slots.filter((slot) => slot.line === 3);
        const crosses = centerLine.map((slot) => scrollCrossAt(movement, slot, slot.main, layout.period, layout.size));
        expect(new Set(crosses).size).toBeGreaterThan(3);
        for (const time of [0, 1.25, 20, 300]) {
          for (const slot of layout.slots) {
            const main = slot.main + scrollOffsetAt(movement, slot.line, layout.speeds[slot.line], time);
            const cross = scrollCrossAt(movement, slot, main, layout.period, layout.size);
            expect(cross).toBeGreaterThanOrEqual(layout.size / 2);
            expect(cross).toBeLessThanOrEqual(movement.crossLength - layout.size / 2);
            expect(scrollCrossAt(movement, slot, main + layout.period, layout.period, layout.size)).toBeCloseTo(cross, 8);
          }
        }
      }
    }
  });

  it("intègre les arrêts exactement, sans accélération ni arrêt simultané obligatoire", () => {
    const cadence = { moving: 1, stopped: 0.4, phase: 0 };
    expect(stopGoTime(0, cadence)).toBe(0);
    expect(stopGoTime(1.1, cadence)).toBe(stopGoTime(1.3, cadence));
    expect(stopGoTime(1.6, cadence)).toBeCloseTo(1.2);
    const spec = specWith({ movement: "stopGo", speed: 0.8 });
    const layout = layoutScroll(spec);
    const movement = createScrollMovement(spec, layout);
    const velocities: number[] = [];
    for (let line = 0; line < layout.speeds.length; line++) {
      const { cadence: c } = movement.lines[line];
      const period = c.moving + c.stopped;
      expect(stopGoTime(3.1 + period, c) - stopGoTime(3.1, c)).toBeCloseTo(c.moving);
      for (let time = 0; time < 5; time += 0.05) {
        const delta = Math.abs(scrollOffsetAt(movement, line, layout.speeds[line], time + 0.02) - scrollOffsetAt(movement, line, layout.speeds[line], time));
        expect(delta).toBeLessThanOrEqual(Math.abs(layout.speeds[line]) * 60 * 0.02 + 1e-9);
      }
      velocities.push(scrollOffsetAt(movement, line, layout.speeds[line], 1.1) - scrollOffsetAt(movement, line, layout.speeds[line], 1));
    }
    expect(velocities.some((v) => Math.abs(v) < 1e-9)).toBe(true);
    expect(velocities.some((v) => Math.abs(v) > 0.1)).toBe(true);
  });
});

describe("rondes et essaim par groupes", () => {
  it("conserve l'essaim historique si aucun motif n'est demandé", () => {
    const spec = specWith({ speed: 0.4 });
    expect(createSwarmMovement(spec, placeSwarm(spec), areaOf(spec))).toBeNull();
  });

  it("préserve les trois ellipses des petites foules, à vitesse bornée, sans masquer la cible", () => {
    for (const seed of [1, 42, 77]) {
      const spec = specWith({ movement: "orbit", count: 50, speed: 0.5 }, seed);
      const area = areaOf(spec);
      const initial = placeSwarm(spec);
      const routes = createSwarmMovement(spec, initial, area)!;
      expect(createSwarmMovement(spec, initial, area)).toEqual(routes);
      expect(routes).toHaveLength(initial.length);
      expect(new Set(routes.filter((route) => route.kind === "orbit").map((route) => route.radiusX)).size).toBe(3);
      expect(new Set(routes.filter((route) => route.kind === "orbit").map((route) => Math.sign(route.angularSpeed)))).toEqual(new Set([-1, 1]));
      expect(routes[routes.length - 1].character.isWanted).toBe(true);
      for (const time of [0, 0.3, 3, 40, 200]) {
        const characters = routes.map((route) => swarmCharacterAt(route, time, area, "bounce"));
        const candidates = characters.map((c, z) => ({ id: c.id, cx: c.x, cy: c.y, size: spec.spriteSize, z, isWanted: c.isWanted }));
        characters.forEach((character, index) => {
          expect(character.x).toBeGreaterThanOrEqual(spec.spriteSize / 2);
          expect(character.x).toBeLessThanOrEqual(BOARD.w - spec.spriteSize / 2);
          expect(character.y).toBeGreaterThanOrEqual(spec.spriteSize / 2);
          expect(character.y).toBeLessThanOrEqual(BOARD.h - spec.spriteSize / 2);
          const next = swarmCharacterAt(routes[index], time + 0.01, area, "bounce");
          expect(Math.hypot(next.x - character.x, next.y - character.y)).toBeLessThanOrEqual(0.5 * 60 * 0.01 + 1e-9);
          if (character.isWanted) expect(pickCharacterAt(character.x, character.y, candidates)?.id).toBe(character.id);
        });
      }
      const route = routes[0];
      if (route.kind !== "orbit") throw new Error("Ronde attendue");
      const first = swarmCharacterAt(route, 0, area, "bounce");
      const loop = swarmCharacterAt(route, 2 * Math.PI / Math.abs(route.angularSpeed), area, "bounce");
      expect(loop.x).toBeCloseTo(first.x, 8);
      expect(loop.y).toBeCloseTo(first.y, 8);
    }
  });

  it("remplit le centre et les coins des rondes denses sans accélérer ni rendre la cible inaccessible", () => {
    for (const seed of [1, 42, 77]) for (const count of [80, 100, 120]) {
      const spec = specWith({ movement: "orbit", count, speed: 0.6 }, seed);
      const area = areaOf(spec);
      const initial = placeSwarm(spec);
      const routes = createSwarmMovement(spec, initial, area)!;
      expect(routes).toHaveLength(count);
      expect(createSwarmMovement(spec, initial, area)).toEqual(routes);
      const orbits = routes.filter((route) => route.kind === "orbit");
      expect(orbits).toHaveLength(count);
      expect(new Set(orbits.map((route) => route.radiusX)).size).toBe(5);
      expect(orbits.every((route) => route.rounded)).toBe(true);
      expect(new Set(orbits.map((route) => Math.sign(route.angularSpeed)))).toEqual(new Set([-1, 1]));
      expect(routes[routes.length - 1].character.isWanted).toBe(true);
      const margin = area.size / 2;
      const corners = [[margin, margin], [area.w - margin, margin], [margin, area.h - margin], [area.w - margin, area.h - margin]];
      for (const time of [0, 0.3, 3, 40, 200]) {
        const characters = routes.map((route) => swarmCharacterAt(route, time, area, "bounce"));
        const candidates = characters.map((c, z) => ({ id: c.id, cx: c.x, cy: c.y, size: spec.spriteSize, z, isWanted: c.isWanted }));
        expect(characters.filter((character) => character.isWanted)).toHaveLength(1);
        expect(Math.min(...characters.map((c) => Math.hypot(c.x - area.w / 2, c.y - area.h / 2)))).toBeLessThan(area.size * .8);
        for (const [x, y] of corners) expect(Math.min(...characters.map((c) => Math.hypot(c.x - x, c.y - y)))).toBeLessThan(area.size * 1.3);
        characters.forEach((character, index) => {
          expect(character.x).toBeGreaterThanOrEqual(margin);
          expect(character.x).toBeLessThanOrEqual(area.w - margin);
          expect(character.y).toBeGreaterThanOrEqual(margin);
          expect(character.y).toBeLessThanOrEqual(area.h - margin);
          const next = swarmCharacterAt(routes[index], time + .01, area, "bounce");
          expect(Math.hypot(next.x - character.x, next.y - character.y)).toBeLessThanOrEqual(.6 * 60 * .01 + 1e-8);
          if (character.isWanted) expect(pickCharacterAt(character.x, character.y, candidates)?.id).toBe(character.id);
        });
      }
      for (const route of orbits) {
        const period = 2 * Math.PI / Math.abs(route.angularSpeed);
        const first = swarmCharacterAt(route, 0, area, "bounce");
        const loop = swarmCharacterAt(route, period, area, "bounce");
        expect(loop.x).toBeCloseTo(first.x, 8);
        expect(loop.y).toBeCloseTo(first.y, 8);
      }
    }
  });

  it("garde une trajectoire identique quand un figurant devient la cible d'une ronde dense", () => {
    const spec = specWith({ movement: "orbit", count: 120, speed: .5 });
    const area = areaOf(spec);
    const initial = placeSwarm(spec);
    const promoted = initial.find((character) => !character.isWanted)!;
    const routes = createSwarmMovement(spec, initial, area)!;
    const swapped = createSwarmMovement(spec, initial.map((character) => ({ ...character, isWanted: character.id === promoted.id })), area)!;
    const swappedById = new Map(swapped.map((route) => [route.character.id, route]));
    for (const time of [0, 1, 15, 300]) for (const route of routes) {
      const before = swarmCharacterAt(route, time, area, "bounce");
      const after = swarmCharacterAt(swappedById.get(route.character.id)!, time, area, "bounce");
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
    }
    expect(swapped[swapped.length - 1].character.id).toBe(promoted.id);
  });

  it("raccorde les lignes et les coins arrondis sans saut ni ralentissement", () => {
    const spec = specWith({ movement: "orbit", count: 100, speed: .5 });
    const area = areaOf(spec);
    const routes = createSwarmMovement(spec, placeSwarm(spec), area)!;
    const speed = .5 * 60;
    const epsilon = .0001;
    const seen = new Set<number>();
    for (const route of routes) {
      if (route.kind !== "orbit" || !route.rounded || seen.has(route.radiusX)) continue;
      seen.add(route.radiusX);
      const { cornerRadius, perimeter } = route.rounded;
      const horizontal = 2 * (route.radiusX - cornerRadius);
      const vertical = 2 * (route.radiusY - cornerRadius);
      const arc = Math.PI / 2 * cornerRadius;
      const uniform = { ...route, angle: 0, angularSpeed: Math.abs(route.angularSpeed) };
      let distance = 0;
      for (const segment of [0, horizontal, arc, vertical, arc, horizontal, arc, vertical, arc]) {
        distance += segment;
        const time = (perimeter + distance) / speed;
        const before = swarmCharacterAt(uniform, time - epsilon, area, "bounce");
        const after = swarmCharacterAt(uniform, time + epsilon, area, "bounce");
        const travel = Math.hypot(after.x - before.x, after.y - before.y);
        expect(travel).toBeGreaterThan(speed * epsilon * 1.99);
        expect(travel).toBeLessThan(speed * epsilon * 2.01);
      }
    }
    expect(seen.size).toBe(5);
  });

  it("les arrêts de groupe rebondissent sans dérive de timestep ni sortie du plateau", () => {
    const spec = specWith({ movement: "stopGo", speed: 0.8, count: 45 });
    const area = areaOf(spec);
    const routes = createSwarmMovement(spec, placeSwarm(spec), area)!;
    const reference = routes.map((route) => swarmCharacterAt(route, 12, area, "bounce"));
    for (const fps of [30, 60, 120]) {
      const clock = createMovementClock();
      for (let frame = 0; frame <= fps * 12; frame++) advanceMovementClock(clock, frame * 1000 / fps, true);
      routes.forEach((route, index) => {
        const character = swarmCharacterAt(route, clock.elapsed, area, "bounce");
        expect(character.x).toBeCloseTo(reference[index].x, 7);
        expect(character.y).toBeCloseTo(reference[index].y, 7);
      });
    }
    for (let time = 0; time <= 120; time += 0.5) {
      for (const route of routes) {
        const character = swarmCharacterAt(route, time, area, "bounce");
        expect(character.x).toBeGreaterThanOrEqual(spec.spriteSize / 2);
        expect(character.x).toBeLessThanOrEqual(BOARD.w - spec.spriteSize / 2);
        expect(character.y).toBeGreaterThanOrEqual(spec.spriteSize / 2);
        expect(character.y).toBeLessThanOrEqual(BOARD.h - spec.spriteSize / 2);
      }
    }
  });
});
