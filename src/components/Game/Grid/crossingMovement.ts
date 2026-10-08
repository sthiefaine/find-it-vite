import { createRng } from "../../../engine/rng";
import type { LevelSpec } from "../../../engine/types";
import type { Area, SwarmCharacter } from "./layouts";

type CrossingCurve = readonly [number, number, number, number];

export type CrossingRoute = {
  kind: "crossing";
  character: SwarmCharacter;
  group: number;
  direction: 1 | -1;
  duration: number;
  phase: number;
  clearance: number;
  curves: CrossingCurve[];
};

const CURVE_COUNT = 8;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Chaque vague garde sa cadence, mais revient par un autre chemin. Les huit
// traversées sont préparées une seule fois : ni tirage ni intégration par frame.
export function createCrossingRoutes(spec: LevelSpec, characters: SwarmCharacter[], area: Area): CrossingRoute[] {
  if (!characters.length) return [];
  const rng = createRng(spec.seed).fork("crossing-movement");
  const groupCount = Math.min(characters.length, clamp(Math.ceil(characters.length / 11), 6, 12));
  // Même marge et même loi pour les cibles et les figurants, accessoires compris.
  const radius = Math.max(area.size / 2, ...characters.map(({ look }) =>
    area.size * look.scale / 2 * (Math.abs(Math.cos(look.rotation)) + Math.abs(Math.sin(look.rotation)))));
  const clearance = radius + 2;
  const distance = area.w + 2 * clearance;
  // Une tête entièrement sortie redevient entièrement visible en moins de 3 s.
  const minimumSpeed = 2 * (clearance + radius) / 2.8;
  const speed = clamp((spec.params.speed ?? .4) * 60, minimumSpeed / .93, 56);
  // Chaque membre a une place dans une petite formation. Le tirage de quelques
  // pixels autour d'un centre commun empilait auparavant jusqu'à 12 portraits.
  const spacing = Math.max(area.size * 1.12, radius * 2 + 3);
  const phaseOrder = rng.shuffle(Array.from({ length: groupCount }, (_, index) => index));
  const groups = Array.from({ length: groupCount }, (_, group) => {
    const groupRng = rng.fork(group);
    const members = Math.ceil((characters.length - group) / groupCount);
    const rows = Math.ceil(Math.sqrt(members));
    const columns = Math.ceil(members / rows);
    const halfHeight = (rows - 1) * spacing / 2;
    const halfWidth = (columns - 1) * spacing / 2;
    const minY = radius + halfHeight;
    const maxY = area.h - minY;
    const curves = Array.from({ length: CURVE_COUNT }, (_, cycle): CrossingCurve => {
      const curveRng = groupRng.fork(cycle);
      // Répartition en hauteur, renouvelée à chaque passage ; les quatre points
      // dessinent une traversée courbe plutôt qu'une rangée qui ondule sur place.
      const band = ((group + .5) / groupCount + cycle * .381966 + (curveRng.next() - .5) * .18) % 1;
      const center = minY + (.1 + .8 * band) * (maxY - minY);
      const tilt = (curveRng.next() - .5) * area.h * .28;
      const bend = (curveRng.next() - .5) * area.h * .30;
      const fit = (y: number) => clamp(y, minY, maxY);
      return [fit(center - tilt), fit(center + bend), fit(center - bend), fit(center + tilt)];
    });
    const phaseMargin = (clearance + radius + halfWidth + 2) / distance;
    return {
      rows, columns,
      direction: (group % 2 === 0 ? 1 : -1) as 1 | -1,
      duration: distance / (speed * (.93 + groupRng.next() * .14)),
      phase: phaseMargin + (1 - 2 * phaseMargin) * (phaseOrder[group] + .5) / groupCount,
      curves,
    };
  });

  // L'ordre de dessin peut protéger un accessoire : il ne change pas le groupe
  // ni la trajectoire attribués à un animal donné.
  const routes: CrossingRoute[] = rng.shuffle(characters.slice().sort((a, b) => a.id - b.id)).map((character, index) => {
    const group = index % groupCount;
    const wave = groups[group];
    const memberRng = rng.fork(`member:${character.id}`);
    const member = Math.floor(index / groupCount);
    const column = Math.floor(member / wave.rows);
    const row = member % wave.rows;
    const offset = (row - (wave.rows - 1) / 2) * spacing;
    const curves = wave.curves.map((curve): CrossingCurve => {
      // La courbe commune conserve l'écart vertical, même dans les virages.
      const adjust = (y: number) => y + offset;
      return [adjust(curve[0]), adjust(curve[1]), adjust(curve[2]), adjust(curve[3])];
    });
    return {
      kind: "crossing",
      character,
      group,
      direction: wave.direction,
      duration: wave.duration,
      // Tous démarrent dans le plateau ; la cible n'a aucun traitement à part.
      phase: wave.phase + (column - (wave.columns - 1) / 2) * spacing / distance
        + (memberRng.next() - .5) * .002,
      clearance,
      curves,
    };
  });
  return routes.sort((a, b) => Number(a.character.isWanted) - Number(b.character.isWanted) || a.character.zIndex - b.character.zIndex);
}

export function crossingCharacterAt(route: CrossingRoute, time: number, area: Area): SwarmCharacter {
  const elapsed = Math.max(0, time) / route.duration + route.phase;
  const cycle = Math.floor(elapsed);
  const progress = elapsed - cycle;
  const reverse = 1 - progress;
  const [start, first, second, end] = route.curves[cycle % route.curves.length];
  const main = -route.clearance + progress * (area.w + 2 * route.clearance);
  return {
    ...route.character,
    // Le raccord entre deux courbes se fait lorsque toute la tête est hors
    // écran. Aucun retour au milieu du plateau, même après plusieurs minutes.
    x: route.direction === 1 ? main : area.w - main,
    y: reverse ** 3 * start + 3 * reverse ** 2 * progress * first
      + 3 * reverse * progress ** 2 * second + progress ** 3 * end,
  };
}
