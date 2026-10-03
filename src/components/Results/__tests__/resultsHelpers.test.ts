import { describe, expect, it } from "vitest";
import { formatSeconds, frenchSpacing, resultsTitle, retryMessage, scoreMessage } from "../resultsHelpers";

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

describe("retryMessage", () => {
  it("encourage selon les avis trouvés", () => {
    expect(retryMessage(0, 5)).toBe("Tu vas y arriver !");
    expect(retryMessage(1, 5)).toBe("1/5 avis · continue !");
    expect(retryMessage(4, 5)).toBe("4/5 avis · tu y es presque !");
  });
});

describe("frenchSpacing / resultsTitle", () => {
  const NBSP = " ";

  it("met une espace insécable avant la ponctuation haute", () => {
    expect(frenchSpacing("Encore un essai !")).toBe(`Encore un essai${NBSP}!`);
    expect(frenchSpacing("Record : 3")).toBe(`Record${NBSP}: 3`);
    expect(frenchSpacing("Super")).toBe("Super");
  });

  it("aucun titre n'a d'espace ordinaire avant « ! »", () => {
    const titles = [
      resultsTitle("adventure", { won: true, score: 5, dailyLabel: "" }),
      resultsTitle("adventure", { won: false, score: 0, dailyLabel: "" }),
      resultsTitle("endless", { won: false, score: 12, dailyLabel: "" }),
      resultsTitle("endless", { won: false, score: 0, dailyLabel: "" }),
      resultsTitle("daily", { won: false, score: 0, dailyLabel: "Défi du 03/10" }),
    ];
    for (const t of titles) expect(t).not.toMatch(/ [!?:;]/);
    expect(titles[1]).toBe(`Encore un essai${NBSP}!`);
  });

  it("Infini à 0 : pas de « Bravo », mais toujours encourageant", () => {
    expect(resultsTitle("endless", { won: false, score: 0, dailyLabel: "" })).toBe(`Presque${NBSP}!`);
    expect(resultsTitle("endless", { won: false, score: 3, dailyLabel: "" })).toBe(`Bravo${NBSP}!`);
  });
});
