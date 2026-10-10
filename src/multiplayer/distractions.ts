import { createRng, hash32 } from "../engine/rng";
import { BOARD, type LevelSpec } from "../engine/types";

export type Distraction = {
  kind: "passer" | "leaves" | "mist";
  imageSrc?: string;
  x: number; y: number; width: number; rotation: number; opacity: number;
};
const image = (id: string) => `/assets/images/obstacles/${id}.png`;

export function matchObstacleAssets(spec: LevelSpec): string[] {
  if (spec.index < 3) return [];
  if (spec.wanted.serie === "flags") return [];
  return spec.wanted.serie === "politics"
    ? [image("politics-crs"), image("politics-police"), image("politics-yellow-vest")]
    : [image("seagull"), ...(spec.index >= 5 ? [image("foliage")] : [])];
}

// Même graine ET même horloge serveur : les deux joueurs voient exactement les
// mêmes obstacles. Aucune frame locale ni préférence de mouvement ne change le défi.
export function createMatchDistractions(spec: LevelSpec): (elapsedS: number) => Distraction[] {
  if (spec.index < 3) return () => [];
  const rng = createRng(hash32(spec.seed, "online-distractions-v1"));
  const political = spec.wanted.serie === "politics";
  const flags = spec.wanted.serie === "flags";
  const assets = matchObstacleAssets(spec);
  const period = spec.index >= 12 ? 7 : spec.index >= 6 ? 8 : 10;
  const events = Array.from({ length: 16 }, (_, cycle) => {
    const kind: Distraction["kind"] = flags || cycle % 3 === 2 ? "mist"
      : !political && spec.index >= 5 && cycle % 3 === 1 ? "leaves" : "passer";
    const count = kind === "mist" ? 2 : kind === "leaves" ? 2 : spec.index >= 10 ? 5 : spec.index >= 6 ? 3 : 2;
    return {
      start: 3.5 + cycle * period, duration: kind === "mist" ? 2.8 : 3.4,
      direction: rng.chance(.5) ? 1 : -1,
      items: Array.from({ length: count }, (_, i) => ({
        kind, y: rng.int(70, BOARD.h - 70), width: kind === "mist" ? 138 : kind === "leaves" ? 120 : rng.int(80, 108),
        imageSrc: kind === "mist" ? undefined : kind === "leaves" ? image("foliage") : assets[i % assets.length],
        drift: rng.int(-30, 30), rotation: rng.int(-14, 14) * Math.PI / 180,
        offset: i * .23,
      })),
    };
  });
  return elapsedS => events.flatMap(event => event.items.flatMap(item => {
    const progress = (elapsedS - event.start - item.offset) / event.duration;
    if (progress <= 0 || progress >= 1) return [];
    const x = -item.width + progress * (BOARD.w + 2 * item.width);
    return [{ kind: item.kind, imageSrc: item.imageSrc,
      x: event.direction === 1 ? x : BOARD.w - x,
      y: item.y + item.drift * Math.sin(progress * Math.PI), width: item.width,
      rotation: item.rotation + Math.sin(progress * Math.PI * 2) * .06,
      opacity: Math.min(1, progress * 5, (1 - progress) * 5) * (item.kind === "mist" ? .78 : .92),
    }];
  }));
}

// Les obstacles passent vite et masquent seulement une partie du plateau.
// Toucher un obstacle reste neutre : aucun clic n'est transformé en erreur.
export function distractionAt(point: { x: number; y: number }, items: Distraction[]): boolean {
  return items.some(item => {
    if (item.opacity < .3) return false;
    const dx = (point.x - item.x) / (item.width * .4);
    const dy = (point.y - item.y) / (item.width * (item.kind === "mist" ? .27 : .35));
    return dx * dx + dy * dy < 1;
  });
}
