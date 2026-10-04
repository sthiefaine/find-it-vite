// Trajectoires en coordonnées logiques. Les cadences sont tirées une fois, puis
// évaluées au temps actif : un arrêt ne dépend jamais du nombre d'images rendues.
import { createRng, type Rng } from "../../../engine/rng";
import { BOARD, type LayoutParams, type LevelSpec } from "../../../engine/types";
import type { Area, ScrollLayout, ScrollSlot, SwarmCharacter } from "./layouts";
import { createCrossingRoutes, crossingCharacterAt, type CrossingRoute } from "./crossingMovement";
import { createOrbitRoutes, orbitCharacterAt, type OrbitRoute } from "./orbitMovement";

const TAU = 2 * Math.PI;
export const MAX_MOVEMENT_FRAME_S = 0.1;
const positiveModulo = (value: number, period: number) => ((value % period) + period) % period;

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

export type ScrollMovement = {
  pattern: LayoutParams["movement"];
  lines: { cadence: StopGoCadence; wavePhase: number }[];
  waveAmplitude: number;
  crossLength: number;
};

export function createScrollMovement(spec: LevelSpec, layout: ScrollLayout): ScrollMovement {
  const rng = createRng(spec.seed).fork("scroll-movement");
  const crossLength = layout.horizontal ? BOARD.h : BOARD.w;
  return {
    pattern: spec.params.movement,
    lines: layout.speeds.map(() => ({ cadence: makeCadence(rng), wavePhase: rng.next() * TAU })),
    waveAmplitude: Math.min(layout.size * 0.22, crossLength / layout.speeds.length * 0.2),
    crossLength,
  };
}

export function scrollOffsetAt(movement: ScrollMovement, line: number, speed: number, time: number): number {
  const movingTime = movement.pattern === "stopGo" ? stopGoTime(time, movement.lines[line].cadence) : time;
  return speed * movingTime * 60;
}

// La phase varie le long du couloir : les animaux ne se déplacent pas en bloc.
// Les copies de bord reçoivent le même cross, donc la boucle reste continue.
export function scrollCrossAt(movement: ScrollMovement, slot: ScrollSlot, main: number, period: number, size: number): number {
  if (movement.pattern !== "wave" || slot.cross <= 1e-6 || slot.cross >= movement.crossLength - 1e-6) return slot.cross;
  const half = size / 2;
  const baseline = Math.max(half, Math.min(movement.crossLength - half, slot.cross));
  const amplitude = Math.max(0, Math.min(movement.waveAmplitude, baseline - half, movement.crossLength - half - baseline));
  return baseline + amplitude * Math.sin(TAU * main / period + movement.lines[slot.line].wavePhase);
}

type StopGoRoute = { kind: "stopGo"; character: SwarmCharacter; cadence: StopGoCadence };
export type SwarmRoute = OrbitRoute | StopGoRoute | CrossingRoute;

export function createSwarmMovement(spec: LevelSpec, characters: SwarmCharacter[], area: Area): SwarmRoute[] | null {
  const pattern = spec.params.movement;
  if (pattern === "crossing") return createCrossingRoutes(spec, characters, area);
  if (pattern !== "orbit" && pattern !== "stopGo") return null;
  const rng = createRng(spec.seed).fork("swarm-movement");
  if (pattern === "stopGo") {
    // Petits groupes asynchrones, sans singulariser la cible.
    const cadences = Array.from({ length: 5 }, () => makeCadence(rng));
    return characters.map((character) => ({ kind: "stopGo", character, cadence: rng.pick(cadences) }));
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
  const character = route.character;
  if (route.kind === "orbit") return orbitCharacterAt(route, time, area);
  const travel = stopGoTime(time, route.cadence) * 60;
  return {
    ...character,
    x: positionOnAxis(character.x, character.velocityX * travel, area.w, area.size, edge),
    y: positionOnAxis(character.y, character.velocityY * travel, area.h, area.size, edge),
  };
}
