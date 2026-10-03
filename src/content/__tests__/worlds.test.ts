import { describe, expect, it } from "vitest";
import { animalsPack, charactersDetails } from "../../helpers/characters";
import { generateLevel, validateSpec } from "../../engine";
import type { Tier } from "../../engine";
import { allCharacters, getWorld, isEmojiAfter12, LEVELS_PER_WORLD, WORLDS, worldOfCharacter } from "../worlds";

// Familles volontairement seules (pas de sosie dans le monde)
const SOLO_FAMILIES = new Set(["animaux/raye", "animaux/vert", "ocean/tortue"]);

describe("mondes", () => {
  it("5 mondes dans l'ordre, startIndex et unlockStars corrects", () => {
    expect(WORLDS.map((w) => w.id)).toEqual(["animaux", "ocean", "dinos", "halloween", "espace"]);
    expect(WORLDS.map((w) => w.startIndex)).toEqual([1, 11, 21, 31, 41]);
    expect(WORLDS.map((w) => w.unlockStars)).toEqual([0, 12, 24, 36, 48]);
    expect(LEVELS_PER_WORLD).toBe(10);
    for (const w of WORLDS) {
      expect(w.background).toMatch(/gradient\(/);
      expect(w.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(w.name.length).toBeGreaterThan(0);
    }
  });

  it("12 persos par monde, name uniques et sans accent", () => {
    for (const w of WORLDS) expect(w.characters).toHaveLength(12);
    const names = allCharacters().map((c) => c.name);
    expect(names).toHaveLength(60);
    expect(new Set(names).size).toBe(60);
    for (const c of allCharacters()) {
      expect(c.name).toMatch(/^[a-z0-9-]+$/);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it("animaux = les 12 images actuelles, préfixe de monde pour les autres", () => {
    expect(getWorld("animaux")!.characters).toEqual(animalsPack);
    expect(charactersDetails).toEqual(animalsPack);
    for (const w of WORLDS.slice(1)) {
      for (const c of w.characters) {
        expect(c.name.startsWith(`${w.id}-`)).toBe(true);
        expect(c.emoji).toBeTruthy();
      }
    }
  });

  it("emoji ≤ 12.0 seulement (lisibles sur Android 10 et moins)", () => {
    for (const e of ["🦤", "🪶", "🦭", "🐻‍❄️", "🥲"]) expect(isEmojiAfter12(e), e).toBe(true);
    for (const e of ["🪐", "🦦", "🦈", "🕷️", "⭐"]) expect(isEmojiAfter12(e), e).toBe(false);
    for (const w of WORLDS) {
      expect(isEmojiAfter12(w.emoji), w.emoji).toBe(false);
      for (const c of w.characters) if (c.emoji) expect(isEmojiAfter12(c.emoji), c.name).toBe(false);
    }
  });

  it("chaque famille a au moins 2 membres, sauf exceptions assumées", () => {
    for (const w of WORLDS) {
      const sizes = new Map<string, number>();
      for (const c of w.characters) sizes.set(c.family, (sizes.get(c.family) ?? 0) + 1);
      for (const [family, n] of sizes) {
        if (!SOLO_FAMILIES.has(`${w.id}/${family}`)) expect(n, `${w.id}/${family}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("sans document, l'image emoji est une chaîne vide et ne plante pas", () => {
    expect(getWorld("ocean")!.characters[0].imageSrc).toBe("");
  });

  it("getWorld et worldOfCharacter", () => {
    expect(getWorld("dinos")?.name).toBe("Dinosaures");
    expect(getWorld("lune")).toBeUndefined();
    expect(worldOfCharacter("chat")?.id).toBe("animaux");
    expect(worldOfCharacter("espace-fusee")?.id).toBe("espace");
    expect(worldOfCharacter("inconnu")).toBeUndefined();
  });
});

describe("moteur avec le pool de chaque monde", () => {
  const tiers: Tier[] = ["easy", "normal", "expert"];
  it("generateLevel produit des niveaux valides sur startIndex..startIndex+9", () => {
    for (const w of WORLDS) {
      for (const tier of tiers) {
        for (const seed of [1, 42, 2026]) {
          const ctx = { seed, tier, pool: w.characters };
          const names = new Set(w.characters.map((c) => c.name));
          for (let i = w.startIndex; i < w.startIndex + LEVELS_PER_WORLD; i++) {
            const spec = generateLevel(i, ctx);
            expect(spec.index).toBe(i);
            expect(validateSpec(spec, ctx).ok, `${w.id} #${i} ${tier}`).toBe(true);
            expect(names.has(spec.wanted.name)).toBe(true);
            expect(spec.decoys.every((d) => names.has(d.name))).toBe(true);
          }
        }
      }
    }
  });
});
