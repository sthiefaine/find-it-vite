import { afterEach, describe, expect, it, vi } from "vitest";
import { generateNickname, NICKNAME_KEY, readNickname, saveNickname } from "../nickname";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("pseudo des salons", () => {
  it("produit des noms lisibles acceptés par le serveur, même aux extrémités du tirage", () => {
    const random = vi.spyOn(Math, "random");
    for (const locale of ["fr", "en"] as const) {
      const names = new Set<string>();
      for (let index = 0; index < 400; index++) {
        random.mockReturnValue(index / 400);
        const name = generateNickname(locale);
        expect(name.length).toBeGreaterThan(1);
        expect(name.length).toBeLessThanOrEqual(20);
        expect(name).toMatch(/^\p{L}+ \p{L}+$/u);
        expect(generateNickname(locale, name)).not.toBe(name);
        names.add(name);
      }
      expect(names.size).toBeGreaterThan(300);
    }
  });

  it("conserve le même pseudo après une visite et mémorise une saisie personnalisée", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    });
    const initial = readNickname("fr");
    expect(data.get(NICKNAME_KEY)).toBe(initial);
    expect(readNickname("fr")).toBe(initial);
    saveNickname("  Léa  ");
    expect(readNickname("fr")).toBe("Léa");
    saveNickname(" ");
    expect(readNickname("fr")).toBe("Léa");
    data.set(NICKNAME_KEY, "x".repeat(21));
    expect(readNickname("fr").length).toBeLessThanOrEqual(20);
  });

  it("reste jouable quand le stockage est bloqué", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("Storage blocked"); },
      setItem: () => { throw new Error("Storage blocked"); },
    });
    expect(readNickname("fr")).not.toBe("");
    expect(() => saveNickname("Renard Futé")).not.toThrow();
  });
});
