import { describe, expect, it } from "vitest";
import { formatSeconds, scoreMessage } from "../resultsHelpers";

describe("formatSeconds", () => {
  it("affiche des secondes à la française", () => {
    expect(formatSeconds(830)).toBe("0,8 s");
    expect(formatSeconds(2000)).toBe("2,0 s");
    expect(formatSeconds(null)).toBe("–");
  });
});

describe("scoreMessage", () => {
  it("a toujours un message, même à 0", () => {
    expect(scoreMessage(0)).toBeTruthy();
    expect(scoreMessage(25)).toBe("Incroyable !");
  });
});
