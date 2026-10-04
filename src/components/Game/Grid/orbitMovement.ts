import type { Rng } from "../../../engine/rng";
import type { LevelSpec } from "../../../engine/types";
import type { Area, SwarmCharacter } from "./layouts";

const TAU = 2 * Math.PI;

export type OrbitRoute = {
  kind: "orbit";
  character: SwarmCharacter;
  radiusX: number;
  radiusY: number;
  angle: number;
  angularSpeed: number;
  rounded?: { cornerRadius: number; perimeter: number };
  weave?: {
    centerX: number;
    centerY: number;
    driftX: number;
    driftY: number;
    frequency: number;
    phase: number;
    angleAmplitude: number;
  };
};

// Les rondes se recoupent au lieu de former des rails concentriques. Une boucle
// extérieure conserve les coins remplis ; les autres traversent la foule.
const DENSE_LOOPS = [
  { x: 0, y: 0, rx: .97, ry: .97, weight: .30 },
  { x: 0, y: -.40, rx: .92, ry: .53, weight: .15 },
  { x: 0, y: .40, rx: .92, ry: .53, weight: .15 },
  { x: -.40, y: 0, rx: .53, ry: .92, weight: .15 },
  { x: .40, y: 0, rx: .53, ry: .92, weight: .15 },
  { x: 0, y: 0, rx: .18, ry: .18, weight: .10 },
];

export function createOrbitRoutes(spec: LevelSpec, characters: SwarmCharacter[], area: Area, rng: Rng): OrbitRoute[] {
  if (!characters.length) return [];
  const shuffled = rng.shuffle(characters);
  const direction = rng.chance(.5) ? 1 : -1;
  const speed = Math.max(0, spec.params.speed ?? .4) * 60;
  const dense = characters.length > 60;
  const radii = [.28, .62, .95];
  const totalRadius = radii.reduce((sum, radius) => sum + radius, 0);
  // Une éventuelle rotation/échelle reste entièrement dans le plateau, sans
  // réserver une marge ou une trajectoire particulière à la cible.
  const margin = dense ? Math.max(area.size / 2, ...characters.map(({ look }) =>
    area.size * look.scale / 2 * (Math.abs(Math.cos(look.rotation)) + Math.abs(Math.sin(look.rotation))))) : area.size / 2;
  const halfWidth = Math.max(0, area.w / 2 - margin);
  const halfHeight = Math.max(0, area.h / 2 - margin);
  const loops = dense ? DENSE_LOOPS : radii.map((radius) => ({ x: 0, y: 0, rx: radius, ry: radius, weight: radius / totalRadius }));
  const routes: OrbitRoute[] = [];
  let used = 0;
  loops.forEach((loop, ring) => {
    const count = ring === loops.length - 1 ? shuffled.length - used : Math.round(shuffled.length * loop.weight);
    const radiusX = halfWidth * loop.rx;
    const radiusY = halfHeight * loop.ry;
    const start = rng.next() * TAU;
    const cornerRadius = Math.min(radiusX, radiusY) * (ring === 0 ? .20 : .38);
    const rounded = dense ? {
      cornerRadius,
      perimeter: 4 * (radiusX + radiusY - 2 * cornerRadius) + TAU * cornerRadius,
    } : undefined;
    // Même les réglages de debug rapides restent tranquilles. La vitesse
    // tangentielle est ≤ 63 px/s ; les modulations ajoutent au maximum 9 px/s.
    const loopSpeed = dense ? Math.min(60, speed) * (.88 + rng.next() * .16) : speed;
    const angularSpeed = (ring % 2 === 0 ? direction : -direction) * loopSpeed
      * (rounded ? TAU / rounded.perimeter : 1 / Math.max(radiusX, radiusY));
    for (let index = 0; index < count; index++) {
      const character = shuffled[used++];
      const memberRng = rng.fork(`orbit-member:${character.id}`);
      const weave = dense ? {
        centerX: halfWidth * loop.x,
        centerY: halfHeight * loop.y,
        driftX: Math.min(14, halfWidth * (1 - Math.abs(loop.x) - loop.rx) * .8),
        driftY: Math.min(14, halfHeight * (1 - Math.abs(loop.y) - loop.ry) * .8),
        frequency: (.17 + memberRng.next() * .11) * Math.min(1, speed / 12),
        phase: memberRng.next() * TAU,
        angleAmplitude: (6 + memberRng.next() * 3) * TAU / rounded!.perimeter,
      } : undefined;
      routes.push({ kind: "orbit", character, radiusX, radiusY, angle: start + TAU * index / count, angularSpeed,
        ...(rounded ? { rounded } : {}), ...(weave ? { weave } : {}) });
    }
  });
  // La cible partage la loi de la foule ; seul l'ordre de dessin la protège
  // d'une occultation permanente au croisement de deux rondes.
  return routes.sort((a, b) => Number(a.character.isWanted) - Number(b.character.isWanted) || a.character.zIndex - b.character.zIndex);
}

function roundedOrbitPosition(route: OrbitRoute, angle: number): { x: number; y: number } {
  const { cornerRadius: radius, perimeter } = route.rounded!;
  const halfWidth = route.radiusX - radius;
  const halfHeight = route.radiusY - radius;
  const horizontal = halfWidth * 2;
  const vertical = halfHeight * 2;
  const arc = Math.PI / 2 * radius;
  let distance = ((angle % TAU + TAU) % TAU) / TAU * perimeter;
  const onCorner = (x: number, y: number, start: number) => ({
    x: x + radius * Math.cos(start + distance / radius),
    y: y + radius * Math.sin(start + distance / radius),
  });
  if (distance <= horizontal) return { x: -halfWidth + distance, y: -route.radiusY };
  distance -= horizontal;
  if (distance <= arc) return onCorner(halfWidth, -halfHeight, -Math.PI / 2);
  distance -= arc;
  if (distance <= vertical) return { x: route.radiusX, y: -halfHeight + distance };
  distance -= vertical;
  if (distance <= arc) return onCorner(halfWidth, halfHeight, 0);
  distance -= arc;
  if (distance <= horizontal) return { x: halfWidth - distance, y: route.radiusY };
  distance -= horizontal;
  if (distance <= arc) return onCorner(-halfWidth, halfHeight, Math.PI / 2);
  distance -= arc;
  if (distance <= vertical) return { x: -route.radiusX, y: halfHeight - distance };
  distance -= vertical;
  return onCorner(-halfWidth, -halfHeight, Math.PI);
}

export function orbitCharacterAt(route: OrbitRoute, time: number, area: Area): SwarmCharacter {
  const wave = route.weave;
  const phase = wave ? Math.max(0, time) * wave.frequency + wave.phase : 0;
  const angle = route.angle + route.angularSpeed * Math.max(0, time) + (wave ? wave.angleAmplitude * Math.sin(phase) : 0);
  const offset = route.rounded ? roundedOrbitPosition(route, angle)
    : { x: route.radiusX * Math.cos(angle), y: route.radiusY * Math.sin(angle) };
  return {
    ...route.character,
    x: area.w / 2 + offset.x + (wave ? wave.centerX + wave.driftX * Math.sin(phase * .83) : 0),
    y: area.h / 2 + offset.y + (wave ? wave.centerY + wave.driftY * Math.sin(phase + 1.3) : 0),
  };
}
