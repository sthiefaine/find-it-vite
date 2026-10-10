import { afterEach, describe, expect, it, vi } from "vitest";
import { boardWithin, getBoard } from "../board";

afterEach(() => vi.unstubAllGlobals());

describe("plateau et zones sûres", () => {
  it.each([[320, 740], [390, 844], [390, 700], [1280, 720]])(
    "garde les commandes visibles en %i×%i avec les séries et les avis d'aventure",
    (width, height) => {
      const navigation = 56;
      const headerWithStreaks = 178;
      const actions = 70;
      const gapsAndBoardPadding = 20;
      const availableHeight = height - navigation - headerWithStreaks - actions - gapsAndBoardPadding;
      const board = boardWithin(width - 8, availableHeight);
      expect(board.height + navigation + headerWithStreaks + actions + gapsAndBoardPadding).toBeLessThanOrEqual(height);
      expect(board.width).toBeLessThanOrEqual(Math.min(width - 8, 450));
      expect(board.width / board.height).toBeCloseTo(390 / 520);
    },
  );

  it("s'adapte à un en-tête plus haut et à un viewport réduit sans changer les coordonnées logiques", () => {
    const initial = boardWithin(382, 520);
    const resized = boardWithin(382, 376);
    const withLongNameAndSafeArea = boardWithin(355, 250);
    expect(resized.height).toBe(376);
    expect(resized.scale).toBeLessThan(initial.scale);
    expect(withLongNameAndSafeArea.height).toBe(250);
    for (const board of [initial, resized, withLongNameAndSafeArea]) {
      expect(board.width / board.scale).toBeCloseTo(390);
      expect(board.height / board.scale).toBeCloseTo(520);
    }
  });

  it("réserve les insets CSS résolus sur les deux axes, avec un repli à zéro", () => {
    const root = {};
    const viewport = { innerWidth: 375, innerHeight: 667 };
    const insets: Record<string, string> = {
      "--safe-top": "44px", "--safe-bottom": "34px",
      "--safe-left": "8px", "--safe-right": "12px",
    };
    const computedStyle = vi.fn(() => ({ getPropertyValue: (name: string) => insets[name] ?? "" }));
    vi.stubGlobal("document", { documentElement: root });
    vi.stubGlobal("window", viewport);
    vi.stubGlobal("getComputedStyle", computedStyle);

    // Écran court : le plateau laisse la place aux commandes et aux deux insets verticaux.
    expect(getBoard().height).toBeCloseTo(303);
    expect(computedStyle).toHaveBeenCalledWith(root);

    // Écran haut : les deux marges latérales bornent cette fois la largeur.
    viewport.innerHeight = 1000;
    expect(getBoard().width).toBeCloseTo(355);

    // Pas de variables de zones sûres, comme dans un document sans la feuille globale.
    for (const name of Object.keys(insets)) delete insets[name];
    viewport.innerHeight = 667;
    expect(getBoard().height).toBeCloseTo(381);
  });
});
