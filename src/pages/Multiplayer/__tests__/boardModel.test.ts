import { describe, expect, it } from "vitest";
import { createMatchBoard } from "../boardModel";
import { levelCharacterIds, multiplayerLevel } from "../../../multiplayer/multiplayerRules";
import { pickCharacterAt } from "../../../helpers/hitTest";
import { BOARD } from "../../../engine/types";

describe("plateau multijoueur", () => {
  it("affiche les identifiants vérifiés par le serveur pour les quatre dispositions", () => {
    const layouts = new Set<string>();
    for (let level = 1; level <= 60; level++) {
      const spec = multiplayerLevel(level, 831, "animaux");
      layouts.add(spec.layout);
      const identities = levelCharacterIds(spec);
      const original = JSON.stringify(spec);
      const atTime = createMatchBoard(spec);
      for (const elapsed of [0, .5, 3.2, 19.5, 29.9]) {
        const sprites = atTime(elapsed);
        expect(sprites.every(sprite => identities.all.has(sprite.id))).toBe(true);
        expect(sprites.filter(sprite => sprite.isWanted).every(sprite => identities.wanted.has(sprite.id))).toBe(true);
        expect(sprites.every(sprite => Number.isFinite(sprite.cx) && Number.isFinite(sprite.cy))).toBe(true);
      }
      expect(JSON.stringify(spec)).toBe(original);
    }
    expect([...layouts].sort()).toEqual(["grid", "pile", "scroll", "swarm"]);
  });

  it("retrouve la même foule au même instant après un retour d’arrière-plan", () => {
    for (const level of [4, 11, 18, 30, 36, 47, 57]) {
      const spec = multiplayerLevel(level, 772, "animaux");
      const uninterrupted = createMatchBoard(spec);
      const resumed = createMatchBoard(spec);
      for (let elapsed = 0; elapsed < 25; elapsed += .13) uninterrupted(elapsed);
      expect(uninterrupted(25)).toEqual(resumed(25));
      expect(uninterrupted(25)).toEqual(uninterrupted(25));
    }
  });

  it("conserve une cible touchable dans les rondes et traversées denses, avec le même ordre que le dessin", () => {
    for (const movement of ["orbit", "crossing"] as const) {
      for (const seed of [42, 831, 1771]) {
        const base = multiplayerLevel(47, seed, "animaux");
        const spec = { ...base, layout: "swarm" as const, params: { ...base.params, movement, count: 150 } };
        const atTime = createMatchBoard(spec);
        let visibleFrames = 0;
        for (let elapsed = 0; elapsed < 30; elapsed += .5) {
          const sprites = atTime(elapsed);
          expect(sprites.map(sprite => sprite.z)).toEqual(sprites.map((_, index) => index));
          const target = sprites.find(sprite => sprite.isWanted)!;
          if (target.cx >= 0 && target.cx <= BOARD.w && target.cy >= 0 && target.cy <= BOARD.h) {
            visibleFrames++;
            expect(pickCharacterAt(target.cx, target.cy, sprites)?.id).toBe(target.id);
          }
        }
        expect(visibleFrames).toBeGreaterThan(20);
      }
    }
  });

  it("laisse les sprites et accessoires exacts dans le tas et la cible dans une rangée entière", () => {
    const pile = multiplayerLevel(43, 91, "animaux");
    const pileSprites = createMatchBoard(pile)(0);
    const wanted = pileSprites.find(sprite => sprite.isWanted)!;
    expect(pileSprites.length).toBeGreaterThan(300);
    expect(wanted.imageSrc).toBe(pile.wanted.imageSrc);
    expect(pickCharacterAt(wanted.cx, wanted.cy, pileSprites)?.id).toBe(wanted.id);
    for (const level of [22, 31, 34, 46]) {
      const spec = multiplayerLevel(level, 91, "animaux");
      const sprites = createMatchBoard(spec)(12);
      const target = sprites.find(sprite => sprite.isWanted)!;
      expect(target.cx).toBeGreaterThanOrEqual(spec.spriteSize / 2);
      expect(target.cx).toBeLessThanOrEqual(BOARD.w - spec.spriteSize / 2);
      expect(target.look.accessoryId ?? null).toBe(spec.accessories?.target ?? null);
    }
  });
});
