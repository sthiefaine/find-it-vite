// Logique pure d'un niveau en cours : touchers, cibles multiples, bonus, chrono.
import { hasPenalty, levelDoneAfter, targetCount } from "../engine/rules";
import type { LevelSpec } from "../engine/types";

export type Tap = { id: number; isWanted: boolean };

export type TapResult =
  | { kind: "ignored" }
  | {
      kind: "target";
      foundIds: number[];
      points: number;
      timeDelta: number; // secondes ajoutées au chrono
      levelDone: boolean;
      golden: boolean;
    }
  | {
      kind: "miss";
      timeDelta: number; // 0 ou -penaltyS
      countsAsMiss: boolean; // compté dans les stats
      blink: boolean; // clignotement + touchers bloqués un instant
    };

// Le niveau est-il fini après `found` cibles trouvées ?
// goldRush : fini plus tôt si toutes les cibles dorées sont touchées.
export function isLevelComplete(spec: LevelSpec, found: number): boolean {
  if (spec.rule === "goldRush") return found >= targetCount(spec);
  return levelDoneAfter(spec, found);
}

export function resolveTap(
  spec: LevelSpec,
  foundIds: readonly number[],
  tap: Tap,
  { isDiscovery = false }: { isDiscovery?: boolean } = {}
): TapResult {
  const golden = spec.rule === "goldRush";
  if (tap.isWanted) {
    if (foundIds.includes(tap.id)) return { kind: "ignored" };
    const next = [...foundIds, tap.id];
    const levelDone = isLevelComplete(spec, next.length);
    return {
      kind: "target",
      foundIds: next,
      points: 1,
      // pendant un bonus le chrono est en pause : pas de temps gagné
      timeDelta: levelDone && !golden ? spec.rewardS : 0,
      levelDone,
      golden,
    };
  }
  const penalty = hasPenalty(spec);
  return {
    kind: "miss",
    timeDelta: penalty && !isDiscovery ? -spec.penaltyS : 0,
    countsAsMiss: penalty,
    blink: penalty,
  };
}

// Nouvelles mécaniques d'un niveau, par rapport à celles déjà vues
export function newMechanics(mechanics: readonly string[], seen: readonly string[]): string[] {
  const known = new Set(seen);
  return mechanics.filter((m) => !known.has(m));
}

// Plus grand écart pris en compte entre deux ticks : après une mise en veille
// ou un onglet en arrière-plan, le chrono ne saute pas d'un coup.
export const MAX_TICK_DELTA_MS = 250;

// Chrono : accumule le temps écoulé et rend les secondes entières à décompter,
// sans perdre la fraction restante.
export function tickClock(
  accMs: number,
  deltaMs: number,
  maxDeltaMs: number = MAX_TICK_DELTA_MS
): { seconds: number; accMs: number } {
  const total = accMs + Math.min(maxDeltaMs, Math.max(0, deltaMs));
  const seconds = Math.floor(total / 1000);
  return { seconds, accMs: total - seconds * 1000 };
}

// Bonus en pause (app en arrière-plan) : on garde le temps restant…
export function bonusRemainingMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

// … et on recale l'échéance à la reprise
export function resumeBonusAt(remainingMs: number, now: number): number {
  return now + Math.max(0, remainingMs);
}

// Le niveau en cours est-il toujours celui d'avant ? (même partie, même étape)
export function sameLevel(
  a: { runSeed: number; level: number },
  b: { runSeed: number; level: number }
): boolean {
  return a.runSeed === b.runSeed && a.level === b.level;
}
