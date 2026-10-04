import { afterEach, describe, expect, it, vi } from "vitest";
import { getBoard } from "../board";

afterEach(() => vi.unstubAllGlobals());

describe("plateau et zones sûres", () => {
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
    expect(getBoard().height).toBeCloseTo(321);
    expect(computedStyle).toHaveBeenCalledWith(root);

    // Écran haut : les deux marges latérales bornent cette fois la largeur.
    viewport.innerHeight = 1000;
    expect(getBoard().width).toBeCloseTo(355);

    // Pas de variables de zones sûres, comme dans un document sans la feuille globale.
    for (const name of Object.keys(insets)) delete insets[name];
    viewport.innerHeight = 667;
    expect(getBoard().height).toBeCloseTo(399);
  });
});
