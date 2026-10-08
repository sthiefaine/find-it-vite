import { describe, expect, it } from "vitest";
import { generateLevel } from "../../../../engine/generateLevel";
import { BOARD, type LevelSpec } from "../../../../engine/types";
import { charactersDetails } from "../../../../helpers/characters";
import { areaOf, layoutScroll, placeSwarm } from "../layouts";
import {
  advanceMovementClock, createMovementClock, createScrollMovement, createSwarmMovement,
  MAX_MOVEMENT_FRAME_S, scrollCrossAt, scrollOffsetAt, stopGoTime, surgeTime, suspendMovementClock, swarmCharacterAt,
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

  it("varie les ondulations avancées entre rangées sans saut aux bords ni débordement", () => {
    for (const scrollDirection of ["horizontal", "vertical"] as const) {
      const spec = { ...specWith({ movement: "wave", speed: 1.4, scrollDirection, edgeRows: true, extraLines: 3 }), index: 37 };
      const layout = layoutScroll(spec);
      const motion = createScrollMovement(spec, layout);
      const shorterWave = layout.slots.find((slot) => slot.line === 3)!;
      const longerWave = layout.slots.find((slot) => slot.line === 4)!;
      const at = (slot: typeof shorterWave, main: number) => scrollCrossAt(motion, slot, main, layout.period, layout.size);
      for (const main of [0, 17, 55, 101]) {
        expect(at(shorterWave, main + layout.period / 2)).toBeCloseTo(at(shorterWave, main), 8);
      }
      const longDifferences = [0, 17, 55, 101].map((main) => Math.abs(at(longerWave, main + layout.period / 2) - at(longerWave, main)));
      expect(Math.max(...longDifferences)).toBeGreaterThan(3);
      for (const slot of layout.slots) {
        // La vague rejoint sa copie sans saut, même lors d'une marche arrière.
        expect(Math.abs(at(slot, layout.period - .001) - at(slot, .001))).toBeLessThan(.01);
        for (let time = 0; time <= 40; time += .2) {
          const main = slot.main + scrollOffsetAt(motion, slot.line, layout.speeds[slot.line], time);
          const cross = at(slot, main);
          if (slot.cross === 0 || slot.cross === motion.crossLength) expect(cross).toBe(slot.cross);
          else {
            expect(cross).toBeGreaterThanOrEqual(layout.size / 2);
            expect(cross).toBeLessThanOrEqual(motion.crossLength - layout.size / 2);
          }
        }
      }
      expect(createScrollMovement(spec, layout)).toEqual(motion);
    }
  });

  it("conserve les vagues simples lors de leur découverte et sous le plafond Enfant", () => {
    for (const [index, speed] of [[7, .7], [20, 1.4], [200, 1]]) {
      const spec = { ...specWith({ movement: "wave", speed }), index };
      const layout = layoutScroll(spec);
      const motion = createScrollMovement(spec, layout);
      const slot = layout.slots.find((candidate) => candidate.line === 3)!;
      for (const main of [0, 50, 180]) {
        const expected = slot.cross + motion.waveAmplitude * Math.sin(2 * Math.PI * main / layout.period + motion.lines[slot.line].wavePhase);
        expect(scrollCrossAt(motion, slot, main, layout.period, layout.size)).toBeCloseTo(expected, 8);
      }
    }
  });
});

describe("rangées qui se désorganisent après l'étape 30", () => {
  const fast = (index: number, speed = 1.4, movement: "linear" | "wave" | "stopGo" = "linear") =>
    ({ ...specWith({ movement, speed, scrollDirection: "horizontal", alternateDirection: true, extraLines: 2 }), index });

  it("ne touche ni les premières étapes, ni les arrêts, ni les défilements lents", () => {
    for (const spec of [fast(30), fast(45, 1.4, "stopGo"), fast(45, .9)]) {
      const layout = layoutScroll(spec);
      expect(createScrollMovement(spec, layout).lines.every((line) => !line.surge)).toBe(true);
    }
  });

  it("fait accélérer ou repartir en arrière certaines rangées, en douceur et à vitesse bornée", () => {
    let reversed = false;
    let accelerated = false;
    for (const seed of [1, 7, 42, 800, 1234]) for (const movement of ["linear", "wave"] as const) {
      const spec = { ...fast(45, 1.5, movement), seed };
      const layout = layoutScroll(spec);
      const motion = createScrollMovement(spec, layout);
      expect(createScrollMovement(spec, layout)).toEqual(motion);
      const surging = motion.lines.filter((line) => line.surge);
      expect(surging.length).toBeGreaterThan(0);
      expect(surging.length).toBeLessThan(motion.lines.length + 1);
      layout.speeds.forEach((speed, line) => {
        const step = .05;
        let previous = scrollOffsetAt(motion, line, speed, 0);
        for (let time = step; time < 40; time += step) {
          const offset = scrollOffsetAt(motion, line, speed, time);
          const velocity = (offset - previous) / step / 60;
          expect(Math.abs(velocity)).toBeLessThanOrEqual(Math.max(2, Math.abs(speed)) + 1e-6);
          if (Math.sign(velocity) === -Math.sign(speed) && Math.abs(velocity) > .1) reversed = true;
          if (Math.abs(velocity) > Math.abs(speed) * 1.2) accelerated = true;
          previous = offset;
        }
      });
    }
    expect(reversed).toBe(true);
    expect(accelerated).toBe(true);
  });

  it("intègre exactement chaque bouffée, à toute cadence", () => {
    const surge = { period: 10, duration: 3, phase: 4, factor: -.8 };
    expect(surgeTime(0, surge)).toBe(0);
    for (const time of [0, 2.5, 7, 31]) expect(surgeTime(time + 10, surge) - surgeTime(time, surge)).toBeCloseTo(10 - 1.8 * 1.5, 9);
    let sum = 0;
    for (let i = 0; i < 1200; i++) sum += (surgeTime((i + 1) / 120, surge) - surgeTime(i / 120, surge));
    expect(sum).toBeCloseTo(surgeTime(10, surge), 9);
  });
});

describe("essaim par groupes", () => {
  it("conserve l'essaim historique si aucun motif n'est demandé", () => {
    const spec = specWith({ speed: 0.4 });
    expect(createSwarmMovement(spec, placeSwarm(spec), areaOf(spec))).toBeNull();
  });

  it("conserve les cadences par animal si l'ordre de dessin change, cible comprise", () => {
    const spec = specWith({ movement: "stopGo", speed: .6, count: 90 });
    const area = areaOf(spec);
    const characters = placeSwarm(spec);
    const reordered = characters.slice().reverse().map((character) => ({
      ...character, zIndex: character.isWanted ? 1000 : -character.zIndex,
    }));
    const routes = createSwarmMovement(spec, characters, area)!;
    const changed = createSwarmMovement(spec, reordered, area)!;
    const byId = new Map(changed.map((route) => [route.character.id, route]));
    for (const time of [0, .3, 3.7, 31, 89]) for (const route of routes) {
      const before = swarmCharacterAt(route, time, area, "bounce");
      const after = swarmCharacterAt(byId.get(route.character.id)!, time, area, "bounce");
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
    }
    // Le moteur conserve l'ordre de rendu demandé par la foule.
    expect(changed.map((route) => route.character.id)).toEqual(reordered.map((character) => character.id));
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
