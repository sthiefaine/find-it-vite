import { createRng, type Rng } from "../../../engine/rng";
import type { LevelSpec } from "../../../engine/types";
import type { Area, SwarmCharacter } from "./layouts";

const TAU = 2 * Math.PI;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const positiveModulo = (value: number, period: number) => ((value % period) + period) % period;

// Vitesse de base plafonnée, puis ±40 % propres à chaque tête.
export const SCATTER_BASE_SPEED_MAX = 40;
export const SCATTER_SPEED_SPREAD = .4;
export const SCATTER_MAX_SPEED = SCATTER_BASE_SPEED_MAX * (1 + SCATTER_SPEED_SPREAD);
const RAMP_S = .6;
const HEADINGS = 10;

// cruise : cap fixe ; turn : cap qui tourne régulièrement ; pause : ralentit
// jusqu'à l'arrêt puis repart dans le même cap.
type SegmentKind = "cruise" | "turn" | "pause";
export type ScatterSegment = { kind: SegmentKind; start: number; duration: number; from: number; to: number; x: number; y: number };

export type ScatterRoute = {
  kind: "scatter";
  character: SwarmCharacter;
  origin: { x: number; y: number }; // place dans la formation de départ
  hold: number; // durée en formation avant l'explosion
  speed: number; // px/s
  heading: number; // cap de départ, vers l'extérieur de la formation
  // Cycle de caps répété après l'élan : l'écart par cycle donne une forme fermée.
  segments: ScatterSegment[];
  period: number;
  shift: { x: number; y: number };
  margin: number;
};

// Déplacement d'un segment au bout de `elapsed` secondes, à vitesse `speed`.
function segmentTravel(segment: Pick<ScatterSegment, "kind" | "duration" | "from" | "to">, elapsed: number, speed: number): { x: number; y: number } {
  const time = clamp(elapsed, 0, segment.duration);
  if (segment.kind === "pause") {
    // v(u) = speed × (½ + ½ cos(2πu/D)) : arrêt complet au milieu, sans à-coup.
    const distance = speed * (time / 2 + segment.duration / (2 * TAU) * Math.sin(TAU * time / segment.duration));
    return { x: distance * Math.cos(segment.from), y: distance * Math.sin(segment.from) };
  }
  if (segment.kind === "cruise" || Math.abs(segment.to - segment.from) < 1e-9) {
    return { x: speed * time * Math.cos(segment.from), y: speed * time * Math.sin(segment.from) };
  }
  // Cap linéaire : intégrale exacte de (cos, sin).
  const rate = (segment.to - segment.from) / segment.duration;
  const heading = segment.from + rate * time;
  return {
    x: speed * (Math.sin(heading) - Math.sin(segment.from)) / rate,
    y: speed * (Math.cos(segment.from) - Math.cos(heading)) / rate,
  };
}

// Distance parcourue pendant l'élan (smoothstep de 0 à la vitesse propre).
const rampDistance = (elapsed: number, speed: number) => {
  const x = clamp(elapsed / RAMP_S, 0, 1);
  return speed * RAMP_S * (x ** 3 - x ** 4 / 2);
};

const shortestTurn = (from: number, to: number) => positiveModulo(to - from + Math.PI, TAU) - Math.PI;

// Formation de départ : grille ou ronde, places tirées sans regarder qui est la cible.
function formationSpots(rng: Rng, count: number, area: Area, margin: number): { x: number; y: number }[] {
  const width = area.w - 2 * margin;
  const height = area.h - 2 * margin;
  if (rng.chance(.5)) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(count * width / Math.max(1, height))));
    const rows = Math.max(1, Math.ceil(count / columns));
    const step = columns === 1 ? 0 : width / (columns - 1);
    return Array.from({ length: count }, (_, index) => {
      const row = Math.floor(index / columns);
      // La dernière rangée incomplète est centrée.
      const inRow = Math.min(columns, count - row * columns);
      return {
        x: area.w / 2 + ((index % columns) - (inRow - 1) / 2) * step,
        y: margin + (rows === 1 ? height / 2 : height * row / (rows - 1)),
      };
    });
  }
  const rings = clamp(Math.round(Math.sqrt(count / 6)), 1, 6);
  const fractions = Array.from({ length: rings }, (_, ring) => (ring + 1) / rings);
  const total = fractions.reduce((sum, fraction) => sum + fraction, 0);
  const counts = fractions.map((fraction) => Math.floor(count * fraction / total));
  counts[rings - 1] += count - counts.reduce((sum, n) => sum + n, 0);
  return fractions.flatMap((fraction, ring) => {
    const start = rng.next() * TAU;
    return Array.from({ length: counts[ring] }, (_, index) => {
      const angle = start + TAU * index / Math.max(1, counts[ring]);
      return { x: area.w / 2 + width / 2 * fraction * Math.cos(angle), y: area.h / 2 + height / 2 * fraction * Math.sin(angle) };
    });
  });
}

export function createScatterRoutes(spec: LevelSpec, characters: SwarmCharacter[], area: Area): ScatterRoute[] {
  if (!characters.length) return [];
  const rng = createRng(spec.seed).fork("scatter-movement");
  const base = clamp((spec.params.speed ?? .4) * 60, 0, SCATTER_BASE_SPEED_MAX);
  // Même marge pour tous, accessoires et rotations compris.
  const margin = Math.max(area.size / 2, ...characters.map(({ look }) =>
    area.size * look.scale / 2 * (Math.abs(Math.cos(look.rotation)) + Math.abs(Math.sin(look.rotation)))));
  const spots = formationSpots(rng, characters.length, area, margin);
  // « Au bout d'un moment » : la formation tient 1 à 2 s puis explose.
  const hold = 1 + rng.next();
  // Les virages se resserrent un peu avec la progression.
  const busy = clamp((spec.index - 15) / 40, 0, 1);
  const routes = rng.shuffle(characters).map((character, slot): ScatterRoute => {
    const memberRng = rng.fork(`scatter-member:${character.id}`);
    const speed = base * (1 - SCATTER_SPEED_SPREAD + 2 * SCATTER_SPEED_SPREAD * memberRng.next());
    const origin = spots[slot];
    const away = Math.hypot(origin.x - area.w / 2, origin.y - area.h / 2) > 1
      ? Math.atan2(origin.y - area.h / 2, origin.x - area.w / 2) : memberRng.next() * TAU;
    const heading = away + (memberRng.next() - .5) * 1.2;
    const headings = [heading];
    for (let index = 1; index < HEADINGS; index++) {
      const swing = (Math.PI / 5 + memberRng.next() * Math.PI * .6) * (memberRng.chance(.5) ? 1 : -1);
      headings.push(headings[index - 1] + swing);
    }
    const segments: ScatterSegment[] = [];
    let period = 0;
    let x = 0;
    let y = 0;
    const push = (kind: SegmentKind, duration: number, from: number, to: number) => {
      const segment = { kind, start: period, duration, from, to, x, y };
      const travel = segmentTravel(segment, duration, speed);
      segments.push(segment);
      period += duration;
      x += travel.x;
      y += travel.y;
    };
    headings.forEach((current, index) => {
      push("cruise", (.9 + memberRng.next() * 1.4) * (1 - .35 * busy), current, current);
      if (memberRng.chance(.25)) push("pause", .6 + memberRng.next() * .4, current, current);
      // Le dernier virage revient au premier cap : le cycle se raccorde sans saut.
      const next = index + 1 < headings.length ? headings[index + 1] : current + shortestTurn(current, heading);
      push("turn", Math.max(.5, Math.abs(next - current) / 2.2) * (.8 + memberRng.next() * .4), current, next);
    });
    return {
      kind: "scatter", character, origin,
      hold: hold + memberRng.next() * .25,
      speed, heading, segments, period, shift: { x, y }, margin,
    };
  });
  // Ordre de dessin de la foule seule : dans une formation serrée, une cible
  // toujours au-dessus serait la seule tête entière. Le toucher reste prioritaire
  // sur la cible (pickCharacterAt), même en partie recouverte.
  return routes.sort((a, b) => a.character.zIndex - b.character.zIndex || a.character.id - b.character.id);
}

// Rebond sur les bords : repliement du trajet déplié.
function fold(value: number, length: number, margin: number): number {
  const span = length - 2 * margin;
  if (span <= 0) return length / 2;
  const reflected = positiveModulo(value - margin, span * 2);
  return margin + (reflected <= span ? reflected : span * 2 - reflected);
}

export function scatterCharacterAt(route: ScatterRoute, time: number, area: Area): SwarmCharacter {
  const elapsed = Math.max(0, time) - route.hold;
  // Formation de départ, tenue à l'identique jusqu'à l'explosion.
  if (elapsed <= 0) return { ...route.character, x: route.origin.x, y: route.origin.y };
  const launch = rampDistance(Math.min(elapsed, RAMP_S), route.speed);
  let x = route.origin.x + launch * Math.cos(route.heading);
  let y = route.origin.y + launch * Math.sin(route.heading);
  const free = elapsed - RAMP_S;
  if (free > 0 && route.period > 0) {
    const cycles = Math.floor(free / route.period);
    const within = free - cycles * route.period;
    let low = 0;
    let high = route.segments.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (route.segments[middle].start <= within) low = middle;
      else high = middle - 1;
    }
    const segment = route.segments[low];
    const travel = segmentTravel(segment, within - segment.start, route.speed);
    x += cycles * route.shift.x + segment.x + travel.x;
    y += cycles * route.shift.y + segment.y + travel.y;
  }
  return { ...route.character, x: fold(x, area.w, route.margin), y: fold(y, area.h, route.margin) };
}
