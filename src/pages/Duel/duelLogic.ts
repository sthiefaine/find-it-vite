// Logique pure du Duel : génération des manches, points, fin de partie.
import { createRng, generateLevel, hash32 } from "../../engine";
import type { GenContext, LevelSpec } from "../../engine";
import type { CharacterDetails } from "../../helpers/characters";
import { charactersDetails } from "../../helpers/characters";

export type Player = "top" | "bottom";
export const PLAYERS: Player[] = ["top", "bottom"];
export type DuelTarget = 5 | 10;

export const LOCK_MS = 1000; // blocage après un mauvais toucher
export const PAUSE_MS = 1000; // pause entre deux manches
export const MIN_INDEX = 2;
export const MAX_INDEX = 12;
const MAX_ATTEMPTS = 40;

export interface DuelRound {
  number: number; // numéro de manche, à partir de 1
  spec: LevelSpec;
  gridSize: number;
  cells: CharacterDetails[]; // gridSize² persos, ligne par ligne
  wantedIndex: number; // case du recherché
}

// Index de niveau utilisé pour la manche : la difficulté monte doucement
export const indexForRound = (round: number) => Math.min(MAX_INDEX, Math.max(MIN_INDEX, round + 1));

const ctxFor = (seed: number, pool: CharacterDetails[]): GenContext => ({
  seed,
  tier: "normal",
  pool,
  allowedRules: ["classic"],
  allowedModifiers: ["lookalikes"],
});

// Disposition des cases, tirée avec la graine du niveau
export function buildCells(spec: LevelSpec): Pick<DuelRound, "gridSize" | "cells" | "wantedIndex"> {
  const gridSize = spec.params.gridSize ?? 3;
  const total = gridSize * gridSize;
  const rng = createRng(spec.seed);
  const wantedIndex = rng.int(0, total - 1);
  const decoys = spec.decoys.filter((c) => c.name !== spec.wanted.name);
  const cells: CharacterDetails[] = [];
  for (let i = 0; i < total; i++) cells.push(i === wantedIndex ? spec.wanted : rng.pick(decoys));
  return { gridSize, cells, wantedIndex };
}

// Manche déterministe : même (graine, numéro, précédent) → même manche
export function generateRound(
  seed: number,
  round: number,
  previousWanted?: string,
  pool: CharacterDetails[] = charactersDetails,
): DuelRound {
  const index = indexForRound(round);
  // Certains index imposent une autre disposition (4, 8, 11) : on essaie aussi les voisins
  const candidates = [index, Math.max(MIN_INDEX, index - 1), index + 1];
  let spec: LevelSpec | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !spec; attempt++) {
    const i = candidates[attempt % candidates.length];
    const s = generateLevel(i, ctxFor(hash32(seed, "duel", round, attempt), pool));
    if (s.layout === "grid" && s.rule === "classic" && s.wanted.name !== previousWanted) spec = s;
  }
  // Secours : les premiers niveaux sont toujours en grille
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !spec; attempt++) {
    const s = generateLevel(MIN_INDEX, ctxFor(hash32(seed, "duel", round, "fallback", attempt), pool));
    if (s.wanted.name !== previousWanted || attempt === MAX_ATTEMPTS - 1) spec = s;
  }
  if (!spec) throw new Error("generateRound : aucune manche possible");
  return { number: round, spec, ...buildCells(spec) };
}

// ─── Points ───
export type Score = Record<Player, number>;

export interface DuelState {
  score: Score;
  lockedUntil: Record<Player, number>;
  roundWinner: Player | null;
}

export type TapResult = "hit" | "miss" | "ignored";

export const initialDuelState = (): DuelState => ({
  score: { top: 0, bottom: 0 },
  lockedUntil: { top: 0, bottom: 0 },
  roundWinner: null,
});

export const isLocked = (state: DuelState, player: Player, now: number) => now < state.lockedUntil[player];

export function tap(
  state: DuelState,
  player: Player,
  cellIndex: number,
  wantedIndex: number,
  now: number,
): { state: DuelState; result: TapResult } {
  if (state.roundWinner || isLocked(state, player, now)) return { state, result: "ignored" };
  if (cellIndex === wantedIndex) {
    return {
      state: { ...state, roundWinner: player, score: { ...state.score, [player]: state.score[player] + 1 } },
      result: "hit",
    };
  }
  return { state: { ...state, lockedUntil: { ...state.lockedUntil, [player]: now + LOCK_MS } }, result: "miss" };
}

// Nouvelle manche : on garde le score, on lève les blocages
export const nextRoundState = (state: DuelState): DuelState => ({
  score: state.score,
  lockedUntil: { top: 0, bottom: 0 },
  roundWinner: null,
});

export function winnerOf(score: Score, target: number): Player | null {
  if (score.top >= target) return "top";
  if (score.bottom >= target) return "bottom";
  return null;
}

export const other = (p: Player): Player => (p === "top" ? "bottom" : "top");
