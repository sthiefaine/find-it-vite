import { describe, expect, it } from "vitest";
import {
  generateRound,
  indexForRound,
  initialDuelState,
  LOCK_MS,
  nextRoundState,
  tap,
  winnerOf,
} from "../duelLogic";

describe("generateRound", () => {
  it("est déterministe", () => {
    const a = generateRound(1234, 3);
    const b = generateRound(1234, 3);
    expect(a.spec.wanted.name).toBe(b.spec.wanted.name);
    expect(a.cells.map((c) => c.name)).toEqual(b.cells.map((c) => c.name));
    expect(a.wantedIndex).toBe(b.wantedIndex);
  });

  it("donne toujours une grille avec un seul recherché", () => {
    for (let seed = 1; seed <= 40; seed++) {
      let prev: string | undefined;
      for (let r = 1; r <= 15; r++) {
        const round = generateRound(seed * 7919, r, prev);
        expect(round.spec.layout).toBe("grid");
        expect(round.spec.rule).toBe("classic");
        expect(round.cells).toHaveLength(round.gridSize ** 2);
        expect(round.cells.filter((c) => c.name === round.spec.wanted.name)).toHaveLength(1);
        expect(round.cells[round.wantedIndex].name).toBe(round.spec.wanted.name);
        expect(round.spec.wanted.name).not.toBe(prev);
        prev = round.spec.wanted.name;
      }
    }
  });

  it("monte doucement en difficulté", () => {
    expect(indexForRound(1)).toBe(2);
    expect(indexForRound(5)).toBe(6);
    expect(indexForRound(50)).toBe(12);
    const early = generateRound(42, 1).gridSize;
    const late = generateRound(42, 12).gridSize;
    expect(late).toBeGreaterThanOrEqual(early);
  });
});

describe("points", () => {
  it("le bon perso donne 1 point et ferme la manche", () => {
    const { state, result } = tap(initialDuelState(), "top", 4, 4, 0);
    expect(result).toBe("hit");
    expect(state.score).toEqual({ top: 1, bottom: 0 });
    expect(state.roundWinner).toBe("top");
    // l'autre arrive trop tard
    expect(tap(state, "bottom", 4, 4, 1).result).toBe("ignored");
  });

  it("un mauvais toucher bloque 1 s seulement ce joueur", () => {
    const { state, result } = tap(initialDuelState(), "bottom", 0, 3, 100);
    expect(result).toBe("miss");
    expect(tap(state, "bottom", 3, 3, 100 + LOCK_MS - 1).result).toBe("ignored");
    expect(tap(state, "top", 3, 3, 200).result).toBe("hit");
    expect(tap(state, "bottom", 3, 3, 100 + LOCK_MS).result).toBe("hit");
  });

  it("nouvelle manche : score gardé, blocages levés", () => {
    let s = tap(initialDuelState(), "top", 1, 2, 0).state;
    s = tap(s, "bottom", 2, 2, 10).state;
    const n = nextRoundState(s);
    expect(n.score).toEqual({ top: 0, bottom: 1 });
    expect(n.roundWinner).toBeNull();
    expect(n.lockedUntil).toEqual({ top: 0, bottom: 0 });
  });

  it("fin de partie au nombre de points choisi", () => {
    expect(winnerOf({ top: 4, bottom: 4 }, 5)).toBeNull();
    expect(winnerOf({ top: 5, bottom: 3 }, 5)).toBe("top");
    expect(winnerOf({ top: 9, bottom: 10 }, 10)).toBe("bottom");
  });
});

describe("index sans grille", () => {
  it("reste proche de l'index visé (pas de retour au niveau 2)", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const round of [3, 7, 10]) {
        const r = generateRound(seed, round);
        expect(Math.abs(r.spec.index - indexForRound(round))).toBeLessThanOrEqual(1);
      }
    }
  });
});
