// Trajectoires en coordonnées logiques. Les cadences sont tirées une fois, puis
// évaluées au temps actif : un arrêt ne dépend jamais du nombre d'images rendues.
import { createRng, type Rng } from "../../../engine/rng";
import { BOARD, type LayoutParams, type LevelSpec } from "../../../engine/types";
import type { Area, ScrollLayout, ScrollSlot, SwarmCharacter } from "./layouts";
import { createCrossingRoutes, crossingCharacterAt, type CrossingRoute } from "./crossingMovement";
import { createOrbitRoutes, orbitCharacterAt, type OrbitRoute } from "./orbitMovement";
import { createScatterRoutes, scatterCharacterAt, type ScatterRoute } from "./scatterMovement";

const TAU = 2 * Math.PI;
export const MAX_MOVEMENT_FRAME_S = 0.1;
const positiveModulo = (value: number, period: number) => ((value % period) + period) % period;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type MovementClock = { elapsed: number; last: number | null; running: boolean };
export const createMovementClock = (): MovementClock => ({ elapsed: 0, last: null, running: false });

// Le premier frame après une pause ne rattrape aucun temps masqué.
export function advanceMovementClock(clock: MovementClock, timestamp: number, active: boolean): number {
  if (!Number.isFinite(timestamp)) return 0;
  const dt = active && clock.running && clock.last !== null
    ? Math.min(MAX_MOVEMENT_FRAME_S, Math.max(0, (timestamp - clock.last) / 1000))
    : 0;
  clock.last = timestamp;
  clock.running = active;
  clock.elapsed += dt;
  return dt;
}

export function suspendMovementClock(clock: MovementClock): void {
  clock.last = null;
  clock.running = false;
}

export type StopGoCadence = { moving: number; stopped: number; phase: number };

const makeCadence = (rng: Rng): StopGoCadence => {
  const moving = 0.9 + rng.next() * 0.9;
  const stopped = 0.25 + rng.next() * 0.35;
  return { moving, stopped, phase: rng.next() * (moving + stopped) };
};

// Intégrale exacte d'une cadence marche/arrêt, y compris si un frame traverse
// plusieurs frontières : pas de dérive avec 30, 60 ou 120 images par seconde.
export function stopGoTime(time: number, cadence: StopGoCadence): number {
  const period = cadence.moving + cadence.stopped;
  const integral = (t: number) => Math.floor(t / period) * cadence.moving + Math.min(t % period, cadence.moving);
  return integral(Math.max(0, time) + cadence.phase) - integral(cadence.phase);
}

// Rangée qui se désorganise par moments : accélère ou repart en sens inverse,
// en douceur, puis retrouve sa vitesse. Cycle périodique : intégrale exacte.
export type ScrollSurge = { period: number; duration: number; phase: number; factor: number };

// Temps de défilement équivalent : t + (facteur − 1) × ∫ bosse(u) du.
export function surgeTime(time: number, surge: ScrollSurge): number {
  const bump = (t: number) => {
    const cycles = Math.floor(t / surge.period);
    const within = Math.min(t - cycles * surge.period, surge.duration);
    const area = within / 2 - surge.duration / (2 * TAU) * Math.sin(TAU * within / surge.duration);
    return cycles * surge.duration / 2 + area;
  };
  const start = Math.max(0, time);
  return start + (surge.factor - 1) * (bump(start + surge.phase) - bump(surge.phase));
}

// Au-delà de l'étape 30, en défilement rapide (jamais au plafond Enfant).
export const SURGE_FROM_LEVEL = 31;
const SURGE_MIN_SPEED = 1.0;
// Vitesse maximale pendant une accélération, en px par frame à 60 fps.
const SURGE_SPEED_CAP = 2.0;

export type ScrollMovement = {
  pattern: LayoutParams["movement"];
  lines: { cadence: StopGoCadence; wavePhase: number; waveCycles: number; waveBlend: number; surge?: ScrollSurge }[];
  waveAmplitude: number;
  crossLength: number;
};

export function createScrollMovement(spec: LevelSpec, layout: ScrollLayout): ScrollMovement {
  const rng = createRng(spec.seed).fork("scroll-movement");
  const crossLength = layout.horizontal ? BOARD.h : BOARD.w;
  const pattern = spec.params.movement;
  const evolvedWaves = pattern === "wave" && spec.index > 20 && (spec.params.speed ?? 0) > 1;
  const lines = layout.speeds.map((_, index) => {
    const cadence = makeCadence(rng);
    const wavePhase = rng.next() * TAU;
    // Harmoniques entières : même déplacement pour les deux copies de bord.
    // Les premières vagues et le plafond Enfant restent sur la sinusoïde simple.
    return {
      cadence, wavePhase,
      waveCycles: evolvedWaves ? 1 + index % 2 : 1,
      waveBlend: evolvedWaves ? .18 + createRng(spec.seed).fork(`scroll-wave:${index}`).next() * .1 : 0,
    };
  });
  const surging = spec.index >= SURGE_FROM_LEVEL && pattern !== "stopGo"
    && Math.max(0, ...layout.speeds.map(Math.abs)) > SURGE_MIN_SPEED;
  // Au moins une rangée se désorganise ; environ une sur deux en tout.
  const forced = createRng(spec.seed).fork("scroll-surge").int(0, layout.speeds.length - 1);
  return {
    pattern,
    lines: surging ? lines.map((line, index) => {
      // Tirages à part : les cadences et vagues restent celles d'avant.
      const surgeRng = createRng(spec.seed).fork(`scroll-surge:${index}`);
      if (!surgeRng.chance(.5) && index !== forced) return line;
      const speed = Math.abs(layout.speeds[index]) || 1;
      const reverse = surgeRng.chance(.4);
      const period = 9 + surgeRng.next() * 7;
      return { ...line, surge: {
        period,
        duration: 2.2 + surgeRng.next() * 1.2,
        phase: surgeRng.next() * period,
        factor: reverse ? -.8 : clamp(SURGE_SPEED_CAP / speed, 1.25, 1.7),
      } };
    }) : lines,
    waveAmplitude: Math.min(layout.size * 0.22, crossLength / layout.speeds.length * 0.2),
    crossLength,
  };
}

export function scrollOffsetAt(movement: ScrollMovement, line: number, speed: number, time: number): number {
  const { cadence, surge } = movement.lines[line];
  const movingTime = movement.pattern === "stopGo" ? stopGoTime(time, cadence) : surge ? surgeTime(time, surge) : time;
  return speed * movingTime * 60;
}

// La phase varie le long du couloir : les animaux ne se déplacent pas en bloc.
// Les copies de bord reçoivent le même cross, donc la boucle reste continue.
export function scrollCrossAt(movement: ScrollMovement, slot: ScrollSlot, main: number, period: number, size: number): number {
  if (movement.pattern !== "wave" || slot.cross <= 1e-6 || slot.cross >= movement.crossLength - 1e-6) return slot.cross;
  const half = size / 2;
  const baseline = Math.max(half, Math.min(movement.crossLength - half, slot.cross));
  const amplitude = Math.max(0, Math.min(movement.waveAmplitude, baseline - half, movement.crossLength - half - baseline));
  const { wavePhase, waveCycles, waveBlend } = movement.lines[slot.line];
  const phase = TAU * waveCycles * main / period + wavePhase;
  // Mélange borné à [-1, 1] : on enrichit la vague sans rapprocher davantage
  // les rangées ni réduire la zone visible des portraits et accessoires.
  const wave = (1 - waveBlend) * Math.sin(phase) + waveBlend * Math.sin(2 * phase + wavePhase);
  return baseline + amplitude * wave;
}

type StopGoRoute = { kind: "stopGo"; character: SwarmCharacter; cadence: StopGoCadence };
export type SwarmRoute = OrbitRoute | StopGoRoute | CrossingRoute | ScatterRoute;

export function createSwarmMovement(spec: LevelSpec, characters: SwarmCharacter[], area: Area): SwarmRoute[] | null {
  const pattern = spec.params.movement;
  if (pattern === "crossing") return createCrossingRoutes(spec, characters, area);
  if (pattern === "scatter") return createScatterRoutes(spec, characters, area);
  if (pattern !== "orbit" && pattern !== "stopGo") return null;
  const rng = createRng(spec.seed).fork("swarm-movement");
  if (pattern === "stopGo") {
    // Petits groupes asynchrones, sans singulariser la cible.
    const cadences = Array.from({ length: 5 }, () => makeCadence(rng));
    // Attribuer par id pour qu'un tri visuel protégeant un accessoire ne change
    // pas le rythme de l'animal ; restituer ensuite l'ordre de dessin demandé.
    const byId = new Map(characters.slice().sort((a, b) => a.id - b.id).map((character) => [character.id, rng.pick(cadences)]));
    return characters.map((character) => ({ kind: "stopGo", character, cadence: byId.get(character.id)! }));
  }

  return createOrbitRoutes(spec, characters, area, rng);
}

function positionOnAxis(initial: number, distance: number, length: number, size: number, edge: NonNullable<LayoutParams["edgeBehavior"]>): number {
  const half = size / 2;
  if (edge === "wrap") return positiveModulo(initial + distance + half, length + size) - half;
  const span = length - size;
  const reflected = positiveModulo(initial - half + distance, span * 2);
  return half + (reflected <= span ? reflected : span * 2 - reflected);
}

export function swarmCharacterAt(route: SwarmRoute, time: number, area: Area, edge: NonNullable<LayoutParams["edgeBehavior"]>): SwarmCharacter {
  if (route.kind === "crossing") return crossingCharacterAt(route, time, area);
  if (route.kind === "scatter") return scatterCharacterAt(route, time, area);
  const character = route.character;
  if (route.kind === "orbit") return orbitCharacterAt(route, time, area);
  const travel = stopGoTime(time, route.cadence) * 60;
  return {
    ...character,
    x: positionOnAxis(character.x, character.velocityX * travel, area.w, area.size, edge),
    y: positionOnAxis(character.y, character.velocityY * travel, area.h, area.size, edge),
  };
}
