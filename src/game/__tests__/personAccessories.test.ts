import { describe, expect, it } from "vitest";
import { ACCESSORIES } from "../../content/accessories";
import { unlockedPeople } from "../../content/personUnlocks";
import { peoplePack, historyPack } from "../../helpers/characters";
import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../../components/Game/Grid/layouts";
import { planTargets } from "../../components/Game/Grid/crowd";
import type { LevelSpec } from "../../engine/types";
import { generatePlayableLevel } from "../playableLevel";
import { levelAssetUrls } from "../assetReadiness";
import { CROWD_VARIANT_KINDS, kindOfVariant } from "../crowdVariants";
import { multiplayerLevel } from "../../multiplayer/multiplayerRules";

function crowdOf(spec: LevelSpec) {
  const crowd = spec.layout === "grid" ? layoutGrid(spec).cells : spec.layout === "scroll" ? layoutScroll(spec).slots
    : spec.layout === "pile" ? placePile(spec) : placeSwarm(spec);
  return crowd.map(item => ({ isWanted: item.isWanted, name: "character" in item ? item.character.name : item.imageSrc,
    accessory: item.look.accessoryId }));
}

describe.each([["politique", peoplePack], ["histoire", historyPack]] as const)("accessoires des personnages : %s", (theme, catalogue) => {
  const pool = unlockedPeople({}, catalogue);
  const context = { seed: 42, tier: "normal" as const, pool };

  it("introduit les tenues au même rythme que les animaux et garde des pauses sans déguisement", () => {
    for (const [tier, first] of [["normal", 13], ["easy", 23]] as const) {
      for (const index of [1, 6, first - 1]) expect(generatePlayableLevel(index, { ...context, tier }).accessories).toBeUndefined();
      expect(generatePlayableLevel(first, { ...context, tier }).accessories?.target).toBeTruthy();
      for (const index of [15, 25, 35]) {
        const spec = generatePlayableLevel(index, { ...context, tier });
        expect(spec.accessories).toBeUndefined();
        expect(spec.crowdVariant).toBeUndefined();
      }
    }
  });

  it("précharge les accessoires du portrait recherché et de la foule", () => {
    const dressed = generatePlayableLevel(13, context);
    const target = dressed.accessories!.target;
    expect(planTargets(dressed)[0].look.accessoryId).toBe(target);
    expect(levelAssetUrls(dressed)).toEqual(expect.arrayContaining(ACCESSORIES.map(accessory => accessory.imageSrc)));
  });

  it("garde une seule combinaison portrait et tenue dans les variantes et les quatre dispositions", () => {
    const layouts = new Set<string>();
    for (const kind of CROWD_VARIANT_KINDS) for (const index of [41, 42, 43, 47]) {
      const spec = generatePlayableLevel(index, context, { forceVariant: kind });
      layouts.add(spec.layout);
      if (kind.endsWith("-bare") && (spec.layout === "pile" || spec.layout === "swarm")) {
        expect(spec.crowdVariant).toBeUndefined();
        continue;
      }
      expect(kindOfVariant(spec.crowdVariant!)).toBe(kind);
      expect(generatePlayableLevel(index, context, { forceVariant: kind })).toEqual(spec);
      const crowd = crowdOf(spec);
      const wanted = crowd.filter(item => item.isWanted);
      expect(wanted).toHaveLength(1);
      expect(wanted[0].accessory).toBe(spec.accessories!.target ?? undefined);
      expect(crowd.filter(item => item.name === wanted[0].name && item.accessory === wanted[0].accessory)).toHaveLength(1);
      expect([spec.wanted, ...spec.decoys].every(person => pool.some(owned => owned.name === person.name))).toBe(true);
    }
    expect(layouts.size).toBe(4);
  });

  it("garde la cible unique avec sa tenue dans les salons", () => {
    for (const index of [13, 43, 47, 80]) {
      const spec = multiplayerLevel(index, 42, theme);
      const crowd = crowdOf(spec);
      const wanted = crowd.filter(item => item.isWanted);
      expect(wanted).toHaveLength(1);
      expect(wanted[0].accessory).toBe(spec.accessories?.target ?? undefined);
      expect(spec.crowdVariant).toBeUndefined();
      expect(multiplayerLevel(index, 42, theme)).toEqual(spec);
    }
  });
});
