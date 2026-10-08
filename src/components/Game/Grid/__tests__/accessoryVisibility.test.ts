import { describe, expect, it } from "vitest";
import { ACCESSORIES, getAccessoryBox } from "../../../../content/accessories";
import { charactersDetails } from "../../../../helpers/characters";
import { PLAIN_LOOK } from "../crowd";
import { accessoryRegionFor, portraitDistanceTo, portraitOverlapsRegion, regionInside } from "../accessoryVisibility";

describe("zone d'accessoire dans le portrait affiché", () => {
  it("utilise les repères propres à chaque animal, avec miroir, échelle et rotation du sprite", () => {
    for (const animal of charactersDetails) for (const accessory of ACCESSORIES) {
      const character = { x: 120, y: 180, imageSrc: animal.imageSrc, look: { ...PLAIN_LOOK, accessoryId: accessory.id, rotation: Math.PI / 2, flip: true, scale: 1.2 } };
      const region = accessoryRegionFor(character, 45)!;
      const box = getAccessoryBox(accessory, animal.imageSrc);
      // À 90° avec miroir, (x,y) local devient (-y,-x).
      expect(region.bounds.left).toBeCloseTo(character.x - (box.y + box.height - .5) * 54);
      expect(region.bounds.right).toBeCloseTo(character.x - (box.y - .5) * 54);
      expect(region.bounds.top).toBeCloseTo(character.y - (box.x + box.width - .5) * 54);
      expect(region.bounds.bottom).toBeCloseTo(character.y - (box.x - .5) * 54);
      expect(regionInside(region, { w: 390, h: 520 })).toBe(true);
    }
  });

  it("détecte une tenue coupée par le bord du plateau", () => {
    const character = { x: 10, y: 10, imageSrc: "/custom.png", look: { ...PLAIN_LOOK, accessoryId: "cap" as const } };
    expect(regionInside(accessoryRegionFor(character, 45)!, { w: 390, h: 520 })).toBe(false);
  });

  it("prend en compte les coins d'un portrait tourné plutôt que son carré sans rotation", () => {
    const character = { x: 0, y: 0, imageSrc: "/custom.png", look: { ...PLAIN_LOOK, rotation: Math.PI / 4 } };
    expect(portraitDistanceTo({ x: 28, y: 0 }, character, 45)).toBe(0);
    expect(portraitDistanceTo({ x: 28, y: 0 }, { ...character, look: PLAIN_LOOK }, 45)).toBe(5.5);
    const region = { corners: [{ x: 27, y: -1 }, { x: 29, y: -1 }, { x: 29, y: 1 }, { x: 27, y: 1 }], bounds: { left: 27, right: 29, top: -1, bottom: 1 } };
    expect(portraitOverlapsRegion(character, 45, region)).toBe(true);
    expect(portraitOverlapsRegion({ ...character, look: PLAIN_LOOK }, 45, region)).toBe(false);
  });

  it("ne confond pas les enveloppes englobantes et l'intersection réelle des rectangles tournés", () => {
    const character = { x: 0, y: 0, imageSrc: "/custom.png", look: { ...PLAIN_LOOK, rotation: Math.PI / 4 } };
    const region = { corners: [{ x: 27, y: 27 }, { x: 29, y: 27 }, { x: 29, y: 29 }, { x: 27, y: 29 }], bounds: { left: 27, right: 29, top: 27, bottom: 29 } };
    expect(portraitOverlapsRegion(character, 45, region)).toBe(false);
  });
});
