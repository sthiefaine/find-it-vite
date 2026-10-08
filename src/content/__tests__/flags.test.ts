import { describe, expect, it } from "vitest";
import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../../components/Game/Grid/layouts";
import { withAccessoryPreview, planAccessories } from "../../game/accessories";
import { levelAssetUrls } from "../../game/assetReadiness";
import { CROWD_VARIANT_KINDS, applyCrowdVariant } from "../../game/crowdVariants";
import { generateRunLevel } from "../../game/levelPreparation";
import { generatePlayableLevel } from "../../game/playableLevel";
import { flagsPack, playableFlagsPack } from "../../helpers/characters";
import { MULTIPLAYER_THEMES, multiplayerLevel, multiplayerPool } from "../../multiplayer/multiplayerRules";
import { defaultSave } from "../../save/schema";
import { playThemeFromSearch, playThemePool, themeOptions } from "../playThemes";

describe("drapeaux sans accessoires", () => {
  it("couvre les pays et territoires et ouvre le thème dès le départ", () => {
    expect(flagsPack).toHaveLength(250);
    expect(new Set(flagsPack.map((flag) => flag.name)).size).toBe(flagsPack.length);
    for (const flag of flagsPack) {
      expect(flag.name).toMatch(/^flag-[a-z]{2}$/);
      expect(flag.imageSrc).toBe(`/assets/images/characters/flags/${flag.name.slice(5)}.png`);
      expect(flag.label.length).toBeGreaterThan(1);
      if (flag.duplicateOf) expect(flagsPack.some((other) => other.name === flag.duplicateOf && !other.duplicateOf)).toBe(true);
    }
    expect(playableFlagsPack.some((flag) => flag.name === "flag-aq")).toBe(false);
    expect(playThemeFromSearch("?theme=drapeaux")).toBe("drapeaux");
    for (const mode of ["endless", "duel"] as const) {
      expect(playThemePool(mode, "drapeaux", defaultSave())).toEqual(playableFlagsPack);
      expect(themeOptions(mode, defaultSave()).find(({ theme }) => theme.id === "drapeaux"))
        .toMatchObject({ availableCount: playableFlagsPack.length, totalCount: playableFlagsPack.length, enabled: true });
    }
    expect(MULTIPLAYER_THEMES).toContain("drapeaux");
    expect(multiplayerPool("drapeaux")).toEqual(playableFlagsPack);
  });

  it("garde une cible unique sans accessoire dans toutes les dispositions et difficultés", () => {
    const layouts = new Set<string>();
    for (const tier of ["easy", "normal", "expert"] as const) {
      for (const index of [1, 4, 8, 13, 20, 23, 27, 30, 35, 40, 47, 80, 100, 4000]) {
        const spec = generatePlayableLevel(index, { seed: 42, tier, pool: playableFlagsPack });
        layouts.add(spec.layout);
        expect([spec.wanted, ...spec.decoys].every((flag) => flag.serie === "flags")).toBe(true);
        expect(spec.accessories).toBeUndefined();
        expect(spec.crowdVariant).toBeUndefined();
        expect(levelAssetUrls(spec).some((url) => url.includes("/accessories/"))).toBe(false);
        const crowd = spec.layout === "grid" ? layoutGrid(spec).cells
          : spec.layout === "scroll" ? layoutScroll(spec).slots
            : spec.layout === "pile" ? placePile(spec) : placeSwarm(spec);
        expect(crowd.filter((item) => item.isWanted)).toHaveLength(1);
        expect(crowd.every((item) => !item.look.accessoryId)).toBe(true);
        const online = multiplayerLevel(index, 42, "drapeaux");
        expect(online.accessories).toBeUndefined();
        expect(online.crowdVariant).toBeUndefined();
        expect(online.wanted.serie).toBe("flags");
      }
    }
    expect(layouts.size).toBe(4);
  });

  it("ignore même les aperçus forcés d’accessoires et de variantes habillées", () => {
    const context = { seed: 42, tier: "expert" as const, pool: playableFlagsPack };
    const spec = generatePlayableLevel(35, context);
    expect(withAccessoryPreview(spec, "moustache")).toBe(spec);
    expect(planAccessories(spec, "expert", false)).toBeUndefined();
    for (const kind of CROWD_VARIANT_KINDS) {
      expect(applyCrowdVariant(spec, kind, playableFlagsPack, "expert")).toBe(spec);
      const forced = generatePlayableLevel(35, context, { forceVariant: kind });
      expect(forced.accessories).toBeUndefined();
      expect(forced.crowdVariant).toBeUndefined();
      const run = generateRunLevel({
        runSeed: 42, tier: "expert", level: 35, mode: "endless", adventureStep: 1, missionFound: 0,
      }, defaultSave(), `?theme=drapeaux&variant=${kind}&accessory=moustache`, true);
      expect(run.wanted.serie).toBe("flags");
      expect(run.accessories).toBeUndefined();
      expect(run.crowdVariant).toBeUndefined();
    }
  });
});
