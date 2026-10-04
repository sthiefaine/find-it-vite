import type { Rng } from "../../../engine/rng";
import type { LevelSpec } from "../../../engine/types";
import type { Area, SwarmCharacter } from "./layouts";

const TAU = 2 * Math.PI;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Plafond de vitesse d'une tête de ronde, toutes composantes comprises (px/s).
export const ORBIT_MAX_SPEED = 80;
// Vitesse tangentielle de base, avant les écarts propres à chaque anneau.
const ORBIT_BASE_SPEED_MAX = 38;
// Vitesse radiale maximale d'un changement d'anneau et d'une respiration.
const SWITCH_RADIAL_SPEED = 22;
const BREATH_RADIAL_SPEED = 9;
// Vitesse maximale apportée par le balancement de l'ensemble.
const SWAY_SPEED = 16;

export type OrbitRing = {
  shape: "ellipse" | "frame";
  radiusX: number; // demi-axes au plus large (respiration au repos)
  radiusY: number;
  omega: number; // rad par unité d'horloge, signe = sens de rotation
  breath: { amplitude: number; frequency: number; phase: number };
  rounded?: { cornerRadius: number; perimeter: number };
};

// Mouvement d'ensemble : les ellipses intérieures se balancent et se décalent ;
// le cadre extérieur (coins et bords) reste centré.
export type OrbitFormation = {
  pace: number; // horloge interne = temps actif × pace ; 0 = tout est figé
  rings: OrbitRing[];
  // Balancement de l'ensemble des ellipses : tilt(t) = amplitude × sin(f t + phase).
  sway: { amplitude: number; frequency: number; phase: number };
  drift: { x: number; y: number; frequencyX: number; frequencyY: number; phaseX: number; phaseY: number };
};

// Une étape : séjour sur `ring`, puis glissement en douceur vers `next`.
export type OrbitLeg = { start: number; ring: number; next: number; dwell: number; transition: number; angle: number };

export type OrbitRoute = {
  kind: "orbit";
  character: SwarmCharacter;
  formation: OrbitFormation;
  ring: number;
  angle: number;
  wobble: { amplitude: number; frequency: number; phase: number };
  // Cycle d'étapes répété : l'angle accumulé par cycle (`turn`) donne une forme fermée.
  legs: OrbitLeg[] | null;
  period: number;
  turn: number;
};

// Difficulté 0..1 tirée de la place du niveau, de la taille de la foule et de
// la vitesse. Les foules Enfant (≤ 60 têtes, vitesse ≤ 0,35) restent adoucies.
export function orbitDifficulty(spec: LevelSpec): { level: number; gentle: boolean } {
  const count = spec.params.count ?? 40;
  const speed = spec.params.speed ?? .4;
  const level = clamp(.5 * clamp((spec.index - 10) / 30, 0, 1) + .3 * clamp((count - 40) / 110, 0, 1)
    + .2 * clamp((speed - .2) / .4, 0, 1), 0, 1);
  const gentle = count <= 60 && speed <= .35;
  return { level: gentle ? Math.min(level, .25) : level, gentle };
}

// Distance radiale maximale entre deux anneaux, pour borner un changement.
// Échantillonnée sur les angles et les orientations, dérive comprise.
function ringGap(formation: OrbitFormation, a: OrbitRing, b: OrbitRing): number {
  let gap = 0;
  const tilts = formation.sway.amplitude ? [-1, -.5, 0, .5, 1].map((share) => share * formation.sway.amplitude) : [0];
  for (let step = 0; step < 72; step++) for (const tilt of tilts) {
    const angle = TAU * step / 72;
    const first = shapePoint(a, angle, tilt, 1, 0);
    const second = shapePoint(b, angle, tilt, 1, 0);
    gap = Math.max(gap, Math.hypot(first.x - second.x, first.y - second.y));
  }
  const drifting = (a.shape === "frame") !== (b.shape === "frame");
  return gap + (drifting ? Math.hypot(formation.drift.x, formation.drift.y) : 0);
}

// Intégrale de smoothstep(3x² − 2x³) entre 0 et x.
const smoothIntegral = (x: number) => x ** 3 - x ** 4 / 2;
const smooth = (x: number) => x * x * (3 - 2 * x);

export function createOrbitRoutes(spec: LevelSpec, characters: SwarmCharacter[], area: Area, rng: Rng): OrbitRoute[] {
  if (!characters.length) return [];
  const { level, gentle } = orbitDifficulty(spec);
  const dense = characters.length > 60;
  const shuffled = rng.shuffle(characters);
  const direction = rng.chance(.5) ? 1 : -1;
  const baseSpeed = clamp((spec.params.speed ?? .4) * 60, 0, ORBIT_BASE_SPEED_MAX);
  // Toutes les horloges (respiration, dérive, changements) ralentissent avec la
  // foule ; une vitesse nulle fige tout le plateau.
  const pace = Math.min(1, baseSpeed / 12);
  // Même marge pour tous, accessoires et rotations compris : aucune piste réservée.
  const margin = Math.max(area.size / 2, ...characters.map(({ look }) =>
    area.size * look.scale / 2 * (Math.abs(Math.cos(look.rotation)) + Math.abs(Math.sin(look.rotation)))));
  const halfWidth = Math.max(0, area.w / 2 - margin);
  const halfHeight = Math.max(0, area.h / 2 - margin);

  const swaying = !gentle && level >= .45;
  const wobbleAmplitude = gentle ? 0 : Math.min(8, 3 + 5 * level, halfWidth * .05);
  const driftX = swaying ? Math.min(14 * level, halfWidth * .08) : 0;
  const driftY = swaying ? Math.min(30 * level, halfHeight * .1) : 0;
  const swayAmplitude = swaying ? .25 + .25 * level : 0;
  // Ellipses inscrites dans le plateau à toute inclinaison du balancement,
  // dérive et oscillations individuelles comprises.
  const availX = Math.max(0, halfWidth - wobbleAmplitude - driftX);
  const availY = Math.max(0, halfHeight - wobbleAmplitude - driftY);
  const cosSway = Math.cos(swayAmplitude);
  const sinSway = Math.sin(swayAmplitude);
  const fit = Math.min(1,
    availX / Math.max(1e-9, Math.hypot(availX * cosSway, availY * sinSway)),
    availY / Math.max(1e-9, Math.hypot(availX * sinSway, availY * cosSway)));
  const innerX = availX * fit;
  const innerY = availY * fit;

  const innerCount = gentle ? 3 : 3 + Math.round(2 * level);
  const innerFractions = Array.from({ length: innerCount }, (_, ring) =>
    gentle ? [.28, .62, .95][ring] : lerp(dense ? .14 : .24, dense ? .9 : .97, ring / (innerCount - 1)));
  const breathAmplitude = gentle ? .07 : .06 + .14 * level;
  const firstPhase = rng.next() * TAU;
  const makeRing = (shape: OrbitRing["shape"], radiusX: number, radiusY: number, ring: number, amplitude: number): OrbitRing => {
    const rounded = shape === "frame" ? (() => {
      const cornerRadius = Math.min(radiusX, radiusY) * .16;
      return { cornerRadius, perimeter: 4 * (radiusX + radiusY - 2 * cornerRadius) + TAU * cornerRadius };
    })() : undefined;
    const factor = gentle ? .88 + rng.next() * .24 : .72 + rng.next() * .43;
    const speed = baseSpeed * factor;
    const reach = Math.max(radiusX, radiusY, 1);
    const omega = pace > 0 ? (ring % 2 === 0 ? direction : -direction) * speed
      * (rounded ? TAU / rounded.perimeter : 1 / reach) / pace : 0;
    return {
      shape, radiusX, radiusY, omega,
      // Anneaux voisins en opposition de phase : ils se resserrent puis s'écartent.
      breath: {
        amplitude,
        frequency: Math.min(TAU / (6 + rng.next() * 3), 2 * BREATH_RADIAL_SPEED / Math.max(1, amplitude * reach)),
        phase: firstPhase + ring * Math.PI + (rng.next() - .5) * .6,
      },
      ...(rounded ? { rounded } : {}),
    };
  };
  const rings = innerFractions.map((fraction, ring) => makeRing("ellipse", innerX * fraction, innerY * fraction, ring, breathAmplitude));
  // Les grandes foules gardent un cadre arrondi qui remplit les coins.
  if (dense) rings.push(makeRing("frame", halfWidth - wobbleAmplitude, halfHeight - wobbleAmplitude, rings.length, breathAmplitude * .25));

  const formation: OrbitFormation = {
    pace,
    rings,
    sway: {
      amplitude: swayAmplitude,
      frequency: swayAmplitude ? Math.min(.35, SWAY_SPEED / (swayAmplitude * Math.max(innerX, innerY, 1))) : 0,
      phase: rng.next() * TAU,
    },
    drift: {
      x: driftX, y: driftY,
      frequencyX: driftX ? Math.min(.21, 5 / driftX) : 0,
      frequencyY: driftY ? Math.min(.16, 5 / driftY) : 0,
      phaseX: rng.next() * TAU, phaseY: rng.next() * TAU,
    },
  };

  // Population proportionnelle au périmètre : densité égale sur chaque anneau.
  const weights = rings.map((ring) => ring.radiusX + ring.radiusY + 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const counts = weights.map((weight) => Math.floor(shuffled.length * weight / total));
  for (let extra = shuffled.length - counts.reduce((a, b) => a + b, 0), ring = rings.length - 1; extra > 0; extra--, ring = (ring - 1 + rings.length) % rings.length) counts[ring]++;

  // Les vagabonds changent d'anneau de temps en temps, cible comprise s'il le faut.
  const wanderShare = gentle ? 0 : .35 + .5 * level;
  const dwellBase = lerp(14, 5, level);
  const routes: OrbitRoute[] = [];
  const gaps = new Map<string, number>();
  let used = 0;
  rings.forEach((ring, ringIndex) => {
    const start = rng.next() * TAU;
    for (let index = 0; index < counts[ringIndex]; index++) {
      const character = shuffled[used++];
      const memberRng = rng.fork(`orbit-member:${character.id}`);
      const wobble = {
        amplitude: wobbleAmplitude * (.5 + .5 * memberRng.next()),
        frequency: .4 + memberRng.next() * .4,
        phase: memberRng.next() * TAU,
      };
      let legs: OrbitLeg[] | null = null;
      let period = 0;
      let turn = 0;
      if (rings.length > 1 && memberRng.chance(wanderShare)) {
        const neighbour = () => {
          if (ringIndex === 0) return 1;
          if (ringIndex === rings.length - 1) return ringIndex - 1;
          return ringIndex + (memberRng.chance(.5) ? 1 : -1);
        };
        const path = [ringIndex, neighbour(), ringIndex, neighbour()];
        legs = path.map((from, step) => {
          const to = path[(step + 1) % path.length];
          const gap = gaps.get(`${Math.min(from, to)}:${Math.max(from, to)}`) ?? ringGap(formation, rings[from], rings[to]);
          gaps.set(`${Math.min(from, to)}:${Math.max(from, to)}`, gap);
          return {
            start: 0, ring: from, next: to, angle: 0,
            dwell: dwellBase * (.7 + memberRng.next() * .6),
            transition: Math.max(1.8, 1.5 * gap / SWITCH_RADIAL_SPEED),
          };
        });
        for (const leg of legs) {
          leg.start = period;
          leg.angle = turn;
          period += leg.dwell + leg.transition;
          turn += legAngle(rings, leg, leg.dwell + leg.transition);
        }
      }
      routes.push({ kind: "orbit", character, formation, ring: ringIndex,
        angle: start + TAU * index / Math.max(1, counts[ringIndex]) + (memberRng.next() - .5) * .08,
        wobble, legs, period, turn });
    }
  });
  // La cible partage la loi de la foule ; seul l'ordre de dessin la garde visible
  // au croisement de deux anneaux.
  return routes.sort((a, b) => Number(a.character.isWanted) - Number(b.character.isWanted) || a.character.zIndex - b.character.zIndex);
}

// Angle parcouru depuis le début d'une étape (vitesse angulaire fondue pendant le glissement).
function legAngle(rings: OrbitRing[], leg: OrbitLeg, elapsed: number): number {
  const from = rings[leg.ring].omega;
  const dwell = Math.min(elapsed, leg.dwell);
  const x = clamp((elapsed - leg.dwell) / leg.transition, 0, 1);
  const to = rings[leg.next].omega;
  return from * dwell + leg.transition * (from * x + (to - from) * smoothIntegral(x));
}

function roundedPosition(ring: OrbitRing, angle: number): { x: number; y: number } {
  const { cornerRadius: radius, perimeter } = ring.rounded!;
  const halfWidth = ring.radiusX - radius;
  const halfHeight = ring.radiusY - radius;
  const horizontal = halfWidth * 2;
  const vertical = halfHeight * 2;
  const arc = Math.PI / 2 * radius;
  // L'angle 0 est au milieu du bord droit, comme sur les ellipses : un changement
  // d'anneau reste un glissement radial.
  const offset = horizontal + arc + halfHeight;
  let distance = (((angle % TAU + TAU) % TAU) / TAU * perimeter + offset) % perimeter;
  const onCorner = (x: number, y: number, start: number) => ({
    x: x + radius * Math.cos(start + distance / radius),
    y: y + radius * Math.sin(start + distance / radius),
  });
  if (distance <= horizontal) return { x: -halfWidth + distance, y: -ring.radiusY };
  distance -= horizontal;
  if (distance <= arc) return onCorner(halfWidth, -halfHeight, -Math.PI / 2);
  distance -= arc;
  if (distance <= vertical) return { x: ring.radiusX, y: -halfHeight + distance };
  distance -= vertical;
  if (distance <= arc) return onCorner(halfWidth, halfHeight, 0);
  distance -= arc;
  if (distance <= horizontal) return { x: halfWidth - distance, y: ring.radiusY };
  distance -= horizontal;
  if (distance <= arc) return onCorner(-halfWidth, halfHeight, Math.PI / 2);
  distance -= arc;
  if (distance <= vertical) return { x: -ring.radiusX, y: halfHeight - distance };
  distance -= vertical;
  return onCorner(-halfWidth, -halfHeight, Math.PI);
}

// Point d'un anneau (sans dérive), relatif au centre du plateau. Le cadre garde
// sa forme mais sa population suit la rotation d'ensemble.
function shapePoint(ring: OrbitRing, angle: number, tilt: number, scale: number, wobble: number): { x: number; y: number } {
  if (ring.rounded) {
    const turned = angle + tilt;
    const point = roundedPosition(ring, turned);
    return { x: point.x * scale + wobble * Math.cos(turned), y: point.y * scale + wobble * Math.sin(turned) };
  }
  const localX = (ring.radiusX * scale + wobble) * Math.cos(angle);
  const localY = (ring.radiusY * scale + wobble) * Math.sin(angle);
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  return { x: localX * cos - localY * sin, y: localX * sin + localY * cos };
}

// Position relative au centre du plateau d'une tête d'angle `angle` sur l'anneau.
function ringPosition(formation: OrbitFormation, ring: OrbitRing, angle: number, clock: number, wobble: number): { x: number; y: number } {
  const { breath } = ring;
  const scale = 1 - breath.amplitude * (.5 + .5 * Math.sin(breath.frequency * clock + breath.phase));
  const { sway } = formation;
  const tilt = sway.amplitude ? sway.amplitude * Math.sin(sway.frequency * clock + sway.phase) : 0;
  const point = shapePoint(ring, angle, tilt, scale, wobble);
  if (ring.rounded) return point;
  const { drift } = formation;
  return {
    x: point.x + drift.x * Math.sin(drift.frequencyX * clock + drift.phaseX),
    y: point.y + drift.y * Math.sin(drift.frequencyY * clock + drift.phaseY),
  };
}

export function orbitCharacterAt(route: OrbitRoute, time: number, area: Area): SwarmCharacter {
  const { formation } = route;
  const clock = Math.max(0, time) * formation.pace;
  const wobble = route.wobble.amplitude * Math.sin(route.wobble.frequency * clock + route.wobble.phase);
  let from = route.ring;
  let to = route.ring;
  let blend = 0;
  let angle = route.angle;
  if (route.legs && route.period > 0) {
    const cycles = Math.floor(clock / route.period);
    const within = clock - cycles * route.period;
    let leg = route.legs[0];
    for (const candidate of route.legs) if (candidate.start <= within) leg = candidate;
    const elapsed = within - leg.start;
    angle += cycles * route.turn + leg.angle + legAngle(formation.rings, leg, elapsed);
    from = leg.ring;
    to = leg.next;
    blend = smooth(clamp((elapsed - leg.dwell) / leg.transition, 0, 1));
  } else {
    angle += formation.rings[from].omega * clock;
  }
  const start = ringPosition(formation, formation.rings[from], angle, clock, wobble);
  // Le glissement est une moyenne de deux points du plateau : il y reste.
  const end = blend > 0 ? ringPosition(formation, formation.rings[to], angle, clock, wobble) : start;
  return {
    ...route.character,
    x: area.w / 2 + lerp(start.x, end.x, blend),
    y: area.h / 2 + lerp(start.y, end.y, blend),
  };
}
