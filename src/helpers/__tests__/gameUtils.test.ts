import { describe, expect, it } from "vitest";
import { getLevelConfig, MAX_PILE_COUNT, MAX_SCROLL_SPEED } from "../gameUtils";
import { pickCharacterAt } from "../hitTest";

describe("getLevelConfig", () => {
  it("reste plafonné même très loin", () => {
    for (let level = 1; level <= 1000; level++) {
      const c = getLevelConfig(level, 13);
      if (c.speed !== undefined) expect(c.speed).toBeLessThanOrEqual(MAX_SCROLL_SPEED);
      if (c.characterCount !== undefined) expect(c.characterCount).toBeLessThanOrEqual(MAX_PILE_COUNT);
      expect(c.size).toBeLessThanOrEqual(13);
    }
  });
});

describe("pickCharacterAt", () => {
  const a = { id: 1, cx: 50, cy: 50, size: 45, z: 1, isWanted: false };
  const wanted = { id: 2, cx: 70, cy: 50, size: 45, z: 0, isWanted: true };

  it("donne la priorité au perso recherché, même dessous", () => {
    expect(pickCharacterAt(62, 50, [wanted, a])?.id).toBe(2);
  });
  it("ignore les coins transparents et le vide", () => {
    expect(pickCharacterAt(50 + 22, 50 + 22, [a])).toBeNull();
    expect(pickCharacterAt(300, 300, [a, wanted])).toBeNull();
  });
});
