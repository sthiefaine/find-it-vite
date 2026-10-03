// Règles communes aux 4 dispositions : cibles, intrus, ruée vers l'or, toucher.
import { useMemo } from "react";
import { useGameStore } from "../../../../store/store";
import { createRng, Rng } from "../../../engine/rng";
import { RULE_INTRO } from "../../../engine/curve";
import { GOLD_TINT, targetCount } from "../../../engine/rules";
import type { LevelSpec } from "../../../engine/types";
import type { CharacterDetails } from "../../../helpers/characters";
import { HitCandidate, isInside, pickCharacterAt } from "../../../helpers/hitTest";

// Apparence d'une tête (l'intrus ou une cible dorée en diffèrent)
export type Look = {
  rotation: number; // radians, autour du centre
  flip: boolean; // miroir horizontal
  scale: number;
  tint: number;
};

export const PLAIN_LOOK: Look = { rotation: 0, flip: false, scale: 1, tint: 0xffffff };

export type Target = {
  character: CharacterDetails;
  look: Look;
  gold: boolean;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Mélange une couleur vers le blanc (t = 0 : intacte, 1 : blanc)
const towardWhite = (color: number, t: number) => {
  const ch = (shift: number) => {
    const c = (color >> shift) & 0xff;
    return Math.round(c + (0xff - c) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
};

// Intrus : une différence tirée au sort, un peu moins marquée avec la difficulté
export function oddLook(spec: LevelSpec): Look {
  const rng = createRng(spec.seed).fork("odd");
  const k = clamp01((spec.index - RULE_INTRO.oddOneOut) / 60);
  switch (rng.int(0, 3)) {
    case 0:
      return { ...PLAIN_LOOK, rotation: Math.PI };
    case 1: {
      const deg = 25 - 8 * k;
      return { ...PLAIN_LOOK, flip: true, rotation: ((rng.chance(0.5) ? 1 : -1) * deg * Math.PI) / 180 };
    }
    case 2:
      return { ...PLAIN_LOOK, scale: 0.75 + 0.08 * k };
    default: {
      const base = rng.chance(0.5) ? 0x5c96ff : 0xff6fa8; // bleuté ou rosé
      return { ...PLAIN_LOOK, tint: towardWhite(base, 0.3 * k) };
    }
  }
}

// Persos « normaux » de la foule
export function crowdPool(spec: LevelSpec): CharacterDetails[] {
  if (spec.rule === "oddOneOut") return [spec.wanted];
  return spec.decoys.filter((c) => c.name !== spec.wanted.name);
}

// Nombre de persos normaux : un peu moins pendant la ruée vers l'or
export const crowdSize = (spec: LevelSpec, n: number) =>
  spec.rule === "goldRush" ? Math.round(n * 0.7) : n;

// Les targetCount(spec) cibles du niveau, dans l'ordre de leurs ids (0..N-1 sauf en grille)
export function planTargets(spec: LevelSpec): Target[] {
  const rng = createRng(spec.seed).fork("targets");
  const count = targetCount(spec);
  if (spec.rule === "goldRush") {
    const pool = crowdPool(spec);
    return Array.from({ length: count }, () => ({
      character: pool.length ? rng.pick(pool) : spec.wanted,
      look: { ...PLAIN_LOOK, tint: GOLD_TINT },
      gold: true,
    }));
  }
  const look = spec.rule === "oddOneOut" ? oddLook(spec) : PLAIN_LOOK;
  return Array.from({ length: count }, () => ({ character: spec.wanted, look, gold: false }));
}

// Centres (px logiques) de n cibles dans la zone, espacés d'au moins `gap` tailles
export function placeTargets(
  rng: Rng,
  n: number,
  { w, h, size }: { w: number; h: number; size: number },
  gap = 1.1
): { x: number; y: number }[] {
  const m = size / 2;
  const spots: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    let best = { x: 0, y: 0 };
    let bestDist = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const p = { x: rng.int(m, w - m), y: rng.int(m, h - m) };
      const d = Math.min(Infinity, ...spots.map((s) => Math.hypot(s.x - p.x, s.y - p.y)));
      if (d > bestDist) {
        best = p;
        bestDist = d;
      }
      if (d >= gap * size) break;
    }
    spots.push(best);
  }
  return spots;
}

// Ids des cibles déjà trouvées dans le niveau (contrat du store, voir useCharacterInteraction)
const NONE: number[] = [];
export function useFoundIds(): Set<number> {
  const ids = useGameStore((s) =>
    "foundIds" in s ? ((s.foundIds as number[] | undefined) ?? NONE) : NONE
  );
  return useMemo(() => new Set(ids), [ids]);
}

// Toucher : comme pickCharacterAt, mais une cible déjà trouvée absorbe le toucher
// (pas de pénalité sur le perso qui serait dessous).
export function pickTap<T extends HitCandidate>(
  x: number,
  y: number,
  candidates: readonly T[],
  foundSpots: readonly HitCandidate[]
): T | null {
  const hit = pickCharacterAt(x, y, candidates);
  if (!hit || hit.isWanted) return hit;
  if (foundSpots.some((f) => f.z >= hit.z && isInside(x, y, f))) return null;
  return hit;
}

// Nom Pixi des cibles, lu par devFindIt
export const targetName = (id: number) => `target:${id}`;
