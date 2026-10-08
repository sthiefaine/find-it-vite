import { describe, expect, it } from "vitest";
import { generateLevel } from "../../../../engine/generateLevel";
import type { LevelSpec } from "../../../../engine/types";
import { charactersDetails } from "../../../../helpers/characters";
import { pickCharacterAt } from "../../../../helpers/hitTest";
import { generatePlayableLevel } from "../../../../game/playableLevel";
import { areaOf, placeSwarm, type SwarmCharacter } from "../layouts";
import { advanceMovementClock, createMovementClock, createSwarmMovement, suspendMovementClock, swarmCharacterAt } from "../movements";
import { ORBIT_MAX_SPEED, orbitDifficulty, type OrbitRoute } from "../orbitMovement";

const base = generateLevel(11, { seed: 42, tier: "normal", pool: charactersDetails, allowedRules: ["classic"] });
const makeSpec = (index: number, count: number, speed: number, seed = 42): LevelSpec =>
  ({ ...base, index, seed, layout: "swarm", rule: "classic", params: { movement: "orbit", count, speed, edgeBehavior: "bounce" } });
const orbitRoutes = (spec: LevelSpec, characters: SwarmCharacter[] = placeSwarm(spec)) =>
  createSwarmMovement(spec, characters, areaOf(spec)) as OrbitRoute[];
const halfOf = (character: SwarmCharacter, size: number) =>
  size * character.look.scale / 2 * (Math.abs(Math.cos(character.look.rotation)) + Math.abs(Math.sin(character.look.rotation)));

// Enfant (≤ 60 têtes, vitesse ≤ 0,35), première ronde Normal, ronde avancée, Expert.
const GENTLE = makeSpec(20, 45, .35);
const MEDIUM = makeSpec(16, 62, .37);
const HARD = makeSpec(47, 150, .6);

describe("rondes concentriques", () => {
  it("monte la difficulté avec l'étape, la foule et la vitesse, en gardant l'Enfant adouci", () => {
    expect(orbitDifficulty(GENTLE).gentle).toBe(true);
    expect(orbitDifficulty(GENTLE).level).toBeLessThanOrEqual(.25);
    expect(orbitDifficulty(MEDIUM).gentle).toBe(false);
    expect(orbitDifficulty(makeSpec(20, 110, .45)).level).toBeGreaterThan(orbitDifficulty(MEDIUM).level);
    expect(orbitDifficulty(HARD).level).toBeGreaterThan(.9);
    expect(orbitDifficulty(makeSpec(90, 160, .6)).level).toBe(1);
  });

  it("garde en Enfant trois anneaux opposés qui respirent doucement, sans changement d'anneau", () => {
    for (const seed of [1, 42, 77]) {
      const spec = { ...GENTLE, seed };
      const routes = orbitRoutes(spec);
      expect(orbitRoutes(spec)).toEqual(routes);
      const { formation } = routes[0];
      expect(formation.rings).toHaveLength(3);
      expect(formation.rings.every((ring) => ring.shape === "ellipse" && ring.breath.amplitude > 0 && ring.breath.amplitude < .1)).toBe(true);
      expect(new Set(formation.rings.map((ring) => Math.sign(ring.omega)))).toEqual(new Set([-1, 1]));
      expect(formation.sway.amplitude).toBe(0);
      expect(formation.drift.x + formation.drift.y).toBe(0);
      expect(routes.every((route) => route.legs === null)).toBe(true);
      expect(routes.every((route) => route.flow.rate === 1 && route.flow.amplitude === 0)).toBe(true);
    }
  });

  it("mélange déjà la première ronde Normal, sans durcir les introductions Enfant", () => {
    for (const seed of [1, 42, 77]) {
      const first = generatePlayableLevel(11, { seed, tier: "normal", pool: charactersDetails });
      const area = areaOf(first);
      const routes = orbitRoutes(first);
      expect(orbitDifficulty(first).gentle).toBe(false);
      expect(orbitRoutes(first)).toEqual(routes);
      // Un échange modifie réellement le rayon dès la première observation,
      // au lieu de laisser toute la foule tourner sur ses rails pendant 14 s.
      const movingAcross = routes.filter((route) => {
        const radiusAt = (time: number) => {
          const character = swarmCharacterAt(route, time, area, "bounce");
          return Math.hypot((character.x - area.w / 2) / (area.w / 2), (character.y - area.h / 2) / (area.h / 2));
        };
        return Math.abs(radiusAt(8) - radiusAt(0)) > .12;
      });
      expect(movingAcross.length / routes.length).toBeGreaterThan(.15);
      const steady = routes.filter((route) => route.legs === null);
      let separationChange = 0;
      const angleAt = (route: OrbitRoute, time: number) => {
        const character = swarmCharacterAt(route, time, area, "bounce");
        const ring = route.formation.rings[route.ring];
        return Math.atan2((character.y - area.h / 2) / ring.radiusY, (character.x - area.w / 2) / ring.radiusX);
      };
      for (const a of steady) for (const b of steady) if (a.ring === b.ring) {
        const delta = angleAt(a, 15) - angleAt(b, 15) - angleAt(a, 0) + angleAt(b, 0);
        separationChange = Math.max(separationChange, Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))));
      }
      // Même sans changer d'anneau, les voisins cessent de tourner en bloc.
      expect(separationChange).toBeGreaterThan(.2);
      for (const index of [11, 16, 20, 47]) {
        const easy = generatePlayableLevel(index, { seed, tier: "easy", pool: charactersDetails });
        expect(orbitDifficulty(easy).gentle).toBe(true);
        expect(orbitRoutes(easy).every((route) => route.legs === null && route.flow.amplitude === 0)).toBe(true);
      }
    }
  });

  it("varie les rythmes individuels et traverse plusieurs couronnes, avec des circuits seedés", () => {
    const routes = orbitRoutes(HARD);
    const traversing = routes.filter((route) => route.legs && new Set(route.legs.map((leg) => leg.ring)).size >= 3);
    expect(traversing.length / routes.length).toBeGreaterThan(.4);
    expect(new Set(routes.filter((route) => route.legs).map((route) => route.legs!.map((leg) => leg.ring).join(","))).size).toBeGreaterThan(12);
    const area = areaOf(HARD);
    const steady = routes.filter((route) => route.legs === null);
    const changingPace = steady.filter((route) => {
      const speeds = Array.from({ length: 60 }, (_, i) => {
        const current = swarmCharacterAt(route, i / 2, area, "bounce");
        const next = swarmCharacterAt(route, i / 2 + .01, area, "bounce");
        return Math.hypot(next.x - current.x, next.y - current.y) / .01;
      });
      return Math.max(...speeds) - Math.min(...speeds) > 6;
    });
    // Même ceux qui restent sur une couronne n'ont plus une cadence uniforme.
    expect(changingPace.length / steady.length).toBeGreaterThan(.7);
    const replay = orbitRoutes(HARD);
    const other = orbitRoutes({ ...HARD, seed: 77 });
    expect(replay).toEqual(routes);
    expect(other.map((route) => route.flow)).not.toEqual(routes.map((route) => route.flow));
  });

  it("superpose à haut niveau plus d'anneaux, à vitesses différentes, qui se balancent et se décalent", () => {
    const medium = orbitRoutes(MEDIUM);
    const hard = orbitRoutes(HARD);
    const { formation } = hard[0];
    expect(formation.rings.length).toBeGreaterThan(medium[0].formation.rings.length);
    expect(formation.rings.filter((ring) => ring.shape === "ellipse")).toHaveLength(5);
    expect(formation.rings.at(-1)?.shape).toBe("frame");
    const ellipses = formation.rings.filter((ring) => ring.shape === "ellipse");
    // Sens alternés d'un anneau au suivant, vitesses tangentielles propres.
    ellipses.slice(1).forEach((ring, index) => expect(Math.sign(ring.omega)).toBe(-Math.sign(ellipses[index].omega)));
    const tangential = ellipses.map((ring) => Math.abs(ring.omega) * Math.max(ring.radiusX, ring.radiusY));
    expect(new Set(tangential.map((speed) => speed.toFixed(3))).size).toBe(ellipses.length);
    // Anneaux voisins en opposition de phase : ils se resserrent puis s'écartent.
    expect(Math.cos(ellipses[1].breath.phase - ellipses[0].breath.phase)).toBeLessThan(-.8);
    expect(ellipses[0].breath.amplitude).toBeGreaterThan(.15);
    expect(formation.sway.amplitude).toBeGreaterThan(.4);
    expect(formation.drift.y).toBeGreaterThan(10);
    expect(formation.drift.x).toBeGreaterThan(5);
    expect(medium[0].formation.sway.amplitude).toBe(0);
    const wanderers = (routes: OrbitRoute[]) => routes.filter((route) => route.legs).length / routes.length;
    expect(wanderers(hard)).toBeGreaterThan(.6);
    expect(wanderers(medium)).toBeGreaterThan(.2);
    expect(wanderers(hard)).toBeGreaterThan(wanderers(medium));
  });

  it("fait glisser les vagabonds d'un anneau à l'autre, sans téléportation", () => {
    for (const spec of [MEDIUM, HARD]) {
      const area = areaOf(spec);
      const routes = orbitRoutes(spec).filter((route) => route.legs).slice(0, 12);
      for (const route of routes) {
        const distances: number[] = [];
        const dt = .02;
        let previous = swarmCharacterAt(route, 0, area, "bounce");
        // Dépasser la fermeture du circuit, y compris pour un animal plus lent.
        for (let time = dt; time <= route.period / (route.flow.rate * route.formation.pace) + 15; time += dt) {
          const current = swarmCharacterAt(route, time, area, "bounce");
          expect(Math.hypot(current.x - previous.x, current.y - previous.y)).toBeLessThanOrEqual(ORBIT_MAX_SPEED * dt);
          distances.push(Math.hypot(current.x - area.w / 2, current.y - area.h / 2));
          previous = current;
        }
        // Il passe réellement par plusieurs rayons.
        expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThan(20);
      }
    }
  });

  it("garde chaque tête dans le plateau, à vitesse plafonnée, et la cible visible et touchable", () => {
    const specs = [GENTLE, MEDIUM, HARD, makeSpec(27, 102, .4), makeSpec(90, 160, .6), makeSpec(90, 160, 3), makeSpec(11, 50, .3)];
    for (const seed of [1, 42, 77]) for (const template of specs) {
      const spec = { ...template, seed };
      const area = areaOf(spec);
      const characters = placeSwarm(spec).map((character, index) => index % 3 ? character
        : { ...character, look: { ...character.look, scale: 1.1, rotation: index % 2 ? .35 : -.2 } });
      const routes = orbitRoutes(spec, characters);
      let visible = 0;
      let samples = 0;
      let outside = 0;
      let fastest = 0;
      for (let time = 0; time <= 150; time += .41) {
        const current = routes.map((route) => swarmCharacterAt(route, time, area, "bounce"));
        current.forEach((character, index) => {
          const half = halfOf(character, area.size) - 1e-9;
          if (character.x < half || character.x > area.w - half || character.y < half || character.y > area.h - half) outside++;
          const next = swarmCharacterAt(routes[index], time + .01, area, "bounce");
          fastest = Math.max(fastest, Math.hypot(next.x - character.x, next.y - character.y) / .01);
        });
        const hits = current.map((c, z) => ({ id: c.id, cx: c.x, cy: c.y, size: area.size, z, isWanted: c.isWanted }));
        const target = current.find((character) => character.isWanted)!;
        samples++;
        // Dessinée au-dessus, entière dans le plateau : visible et touchable.
        if (current.at(-1)?.isWanted && pickCharacterAt(target.x, target.y, hits)?.id === target.id) visible++;
      }
      expect(outside).toBe(0);
      expect(fastest).toBeLessThanOrEqual(ORBIT_MAX_SPEED);
      expect(visible / samples).toBeGreaterThanOrEqual(.9);
    }
  });

  it("garde la même trajectoire quand un figurant devient la cible", () => {
    for (const spec of [MEDIUM, HARD]) {
      const area = areaOf(spec);
      const initial = placeSwarm(spec);
      const promoted = initial.find((character) => !character.isWanted)!;
      const routes = orbitRoutes(spec, initial);
      const swapped = orbitRoutes(spec, initial.map((character) => ({ ...character, isWanted: character.id === promoted.id })));
      const byId = new Map(swapped.map((route) => [route.character.id, route]));
      for (const time of [0, 1, 15, 300]) for (const route of routes) {
        const before = swarmCharacterAt(route, time, area, "bounce");
        const after = swarmCharacterAt(byId.get(route.character.id)!, time, area, "bounce");
        expect(after.x).toBe(before.x);
        expect(after.y).toBe(before.y);
      }
      expect(swapped.at(-1)?.character.id).toBe(promoted.id);
    }
  });

  it("conserve les trajectoires lorsque les accessoires imposent un autre ordre de dessin", () => {
    for (const spec of [MEDIUM, HARD]) {
      const area = areaOf(spec);
      const initial = placeSwarm(spec);
      const original = orbitRoutes(spec, initial);
      const reordered = orbitRoutes(spec, initial.slice().reverse().map((character) => ({
        ...character,
        zIndex: character.isWanted ? 1000 : character.id % 5,
      })));
      const byId = new Map(reordered.map((route) => [route.character.id, route]));
      for (const time of [0, 8, 30, 200]) for (const route of original) {
        const before = swarmCharacterAt(route, time, area, "bounce");
        const after = swarmCharacterAt(byId.get(route.character.id)!, time, area, "bounce");
        expect(after.x).toBe(before.x);
        expect(after.y).toBe(before.y);
      }
    }
  });

  it("fige tout à vitesse nulle et reprend au même endroit après une pause, à toute cadence", () => {
    const still = makeSpec(47, 150, 0);
    const area = areaOf(still);
    for (const route of orbitRoutes(still)) expect(swarmCharacterAt(route, 37, area, "bounce")).toEqual(swarmCharacterAt(route, 0, area, "bounce"));
    const routes = orbitRoutes(HARD);
    const reference = routes.map((route) => swarmCharacterAt(route, 12, area, "bounce"));
    for (const fps of [30, 60, 120]) {
      const clock = createMovementClock();
      for (let frame = 0; frame <= fps * 12; frame++) advanceMovementClock(clock, frame * 1000 / fps, true);
      suspendMovementClock(clock);
      advanceMovementClock(clock, 90_000, true);
      routes.forEach((route, index) => {
        const character = swarmCharacterAt(route, clock.elapsed, area, "bounce");
        expect(character.x).toBeCloseTo(reference[index].x, 7);
        expect(character.y).toBeCloseTo(reference[index].y, 7);
      });
    }
  });

  it("remplit le centre et les coins des grandes rondes", () => {
    const area = areaOf(HARD);
    const routes = orbitRoutes(HARD);
    const margin = area.size / 2;
    const corners = [[margin, margin], [area.w - margin, margin], [margin, area.h - margin], [area.w - margin, area.h - margin]];
    for (const time of [0, 3, 40, 200]) {
      const characters = routes.map((route) => swarmCharacterAt(route, time, area, "bounce"));
      expect(Math.min(...characters.map((c) => Math.hypot(c.x - area.w / 2, c.y - area.h / 2)))).toBeLessThan(area.size * 1.2);
      for (const [x, y] of corners) expect(Math.min(...characters.map((c) => Math.hypot(c.x - x, c.y - y)))).toBeLessThan(area.size * 1.6);
    }
  });
});
