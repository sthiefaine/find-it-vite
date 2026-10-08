import { describe, expect, it } from "vitest";
import { ACCESSORIES, getAccessory, getAccessoryBox } from "../../content/accessories";
import { charactersDetails } from "../../helpers/characters";
import { generatePlayableLevel } from "../playableLevel";
import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../../components/Game/Grid/layouts";
import { planTargets } from "../../components/Game/Grid/crowd";
import { readAccessoryPreview, withAccessoryPreview } from "../accessories";

const context = { seed: 42, tier: "normal" as const, pool: charactersDetails };

describe("accessoires réutilisables", () => {
  it("aligne les lunettes et la moustache sur le visage du lapin, sous ses longues oreilles", () => {
    const image = "/assets/images/characters/animals/lapin.png";
    const glasses = getAccessoryBox(getAccessory("sunglasses")!, image);
    const moustache = getAccessoryBox(getAccessory("moustache")!, image);
    const cap = getAccessoryBox(getAccessory("cap")!, image);
    expect(glasses.y + glasses.height / 2).toBeCloseTo(.61);
    expect(moustache.y + moustache.height / 2).toBeCloseTo(.80);
    expect(cap.y).toBeGreaterThan(.20);
    expect(cap.y + cap.height).toBeLessThan(.56);
  });

  it("conserve le ratio et garde les accessoires dans le portrait de tous les animaux", () => {
    for (const animal of charactersDetails) for (const accessory of ACCESSORIES) {
      const box = getAccessoryBox(accessory, animal.imageSrc);
      expect(box.width / box.height).toBeCloseTo(accessory.box.width / accessory.box.height);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1);
      expect(box.y + box.height).toBeLessThanOrEqual(1);
    }
    const accessory = getAccessory("sunglasses")!;
    expect(getAccessoryBox(accessory, "/custom.png")).toBe(accessory.box);
    const custom = getAccessoryBox(accessory, "/custom.png", { eyesY: .6, muzzleY: .8 });
    expect(custom.y + custom.height / 2).toBeCloseTo(.6);
  });
  it("couvre les deux yeux écartés du requin-marteau avec les lunettes", () => {
    const box = getAccessoryBox(getAccessory("sunglasses")!, "/assets/images/characters/animals/requin-marteau.png");
    expect(box.x).toBeLessThan(.09);
    expect(box.x + box.width).toBeGreaterThan(.91);
    expect(box.y + box.height / 2).toBeCloseTo(.39);
  });
  it("réserve le forçage de tenue aux aperçus locaux et rejette les identifiants inconnus", () => {
    expect(readAccessoryPreview("?accessory=moustache", true)).toBe("moustache");
    expect(readAccessoryPreview("?accessory=moustache", false)).toBeUndefined();
    expect(readAccessoryPreview("?accessory=inconnu", true)).toBeUndefined();
    const spec = generatePlayableLevel(1, context);
    expect(withAccessoryPreview(spec, undefined)).toBe(spec);
    expect(withAccessoryPreview(spec, "moustache").accessories?.target).toBe("moustache");
  });
  it("propose les cinq accessoires dont la fausse moustache, dans le carré du portrait", () => {
    expect(new Set(ACCESSORIES.map((a) => a.id)).size).toBe(5);
    expect(ACCESSORIES.some((a) => a.id === "moustache")).toBe(true);
    for (const { box } of ACCESSORIES) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1);
      expect(box.y + box.height).toBeLessThanOrEqual(1);
    }
  });

  it("introduit les tenues progressivement, plus tard en Enfant, et ménage les respirations", () => {
    for (let index = 1; index < 13; index++) expect(generatePlayableLevel(index, context).accessories).toBeUndefined();
    expect(generatePlayableLevel(13, context).accessories?.target).toBeTruthy();
    for (let index = 1; index < 23; index++) expect(generatePlayableLevel(index, { ...context, tier: "easy" }).accessories).toBeUndefined();
    expect(generatePlayableLevel(23, { ...context, tier: "easy" }).accessories?.target).toBeTruthy();
    for (const index of [15, 25, 35]) expect(generatePlayableLevel(index, context).accessories).toBeUndefined();
  });

  it.each(ACCESSORIES)("garde une cible unique portant $label dans les quatre dispositions", ({ id }) => {
    const plain = generatePlayableLevel(19, context);
    const spec = { ...plain, accessories: { target: id, decoyChance: .5 } };
    expect(planTargets(spec)[0].look.accessoryId).toBe(id);
    for (const layout of [layoutGrid, layoutScroll, placePile, placeSwarm]) {
      const result = layout(spec);
      const crowd = Array.isArray(result) ? result : "cells" in result ? result.cells : result.slots;
      const target = crowd.filter((c) => c.isWanted);
      expect(target).toHaveLength(1);
      expect(target[0].look.accessoryId).toBe(spec.accessories.target);
      expect(crowd.filter((c) => !c.isWanted && c.look.accessoryId === id).length).toBeGreaterThanOrEqual(2);
      const targetImage = "character" in target[0] ? target[0].character.imageSrc : target[0].imageSrc;
      expect(crowd.filter((c) => ("character" in c ? c.character.imageSrc : c.imageSrc) === targetImage)).toHaveLength(1);
      expect(layout(spec)).toEqual(result);
    }
  });

  it("ne change ni les placements, ni les vitesses, ni les temps quand on ajoute une tenue", () => {
    const plain = { ...generatePlayableLevel(19, context), accessories: undefined };
    const dressed = { ...plain, accessories: { target: "moustache" as const, decoyChance: .5 } };
    for (const layout of [layoutGrid, layoutScroll, placePile, placeSwarm]) {
      const normalize = (value: unknown) => JSON.parse(JSON.stringify(value, (key, entry) => key === "accessoryId" ? undefined : entry));
      if (layout === placeSwarm) {
        const initial = placeSwarm(plain).sort((a, b) => a.id - b.id);
        const protectedCrowd = placeSwarm(dressed).sort((a, b) => a.id - b.id);
        expect(protectedCrowd.map((character) => ({ ...normalize(character), zIndex: undefined })))
          .toEqual(initial.map((character) => ({ ...normalize(character), zIndex: undefined })));
        expect(protectedCrowd.filter((character) => !character.isWanted).map((character) => character.zIndex))
          .toEqual(initial.filter((character) => !character.isWanted).map((character) => character.zIndex));
      } else expect(normalize(layout(dressed))).toEqual(normalize(layout(plain)));
    }
    expect(dressed.rewardS).toBe(plain.rewardS);
    expect(dressed.penaltyS).toBe(plain.penaltyS);
  });

  it("dessine la cible habillée au-dessus pour chaque essaim, avec une profondeur cohérente pour les routes retriées", () => {
    const original = generatePlayableLevel(53, context);
    for (const movement of ["linear", "stopGo", "orbit", "crossing", "scatter"] as const) for (const accessory of ACCESSORIES) {
      const spec = { ...original, layout: "swarm" as const, accessories: { target: accessory.id, decoyChance: .5 }, params: { ...original.params, movement, wantedBelow: true, count: 100 } };
      const crowd = placeSwarm(spec);
      const target = crowd.find((character) => character.isWanted)!;
      expect(crowd[crowd.length - 1]).toBe(target);
      expect(crowd.filter((character) => !character.isWanted).every((character) => character.zIndex < target.zIndex)).toBe(true);
      expect(target.look.accessoryId).toBe(accessory.id);
      expect(placeSwarm(spec)).toEqual(crowd);
    }
  });
});
