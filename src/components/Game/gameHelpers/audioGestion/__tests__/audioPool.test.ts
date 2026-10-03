import { describe, expect, it } from "vitest";
import { isPlayInterrupted, nextPoolIndex } from "../audioPool";

describe("isPlayInterrupted", () => {
  it("reconnaît AbortError, pas les autres erreurs", () => {
    expect(isPlayInterrupted({ name: "AbortError", message: "play() interrupted" })).toBe(true);
    expect(isPlayInterrupted(new Error("boom"))).toBe(false);
    expect(isPlayInterrupted({ name: "NotAllowedError" })).toBe(false);
    expect(isPlayInterrupted(null)).toBe(false);
  });
});

describe("nextPoolIndex", () => {
  it("prend le premier élément libre à partir du suivant", () => {
    expect(nextPoolIndex([true, true, true], 0)).toBe(0);
    expect(nextPoolIndex([false, true, true], 0)).toBe(1);
    expect(nextPoolIndex([true, false, false], 1)).toBe(0);
  });

  it("tous occupés : réutilise le plus ancien", () => {
    expect(nextPoolIndex([false, false, false], 2)).toBe(2);
    expect(nextPoolIndex([false, false, false], 4)).toBe(1);
  });
});
