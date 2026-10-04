import { describe, expect, it } from "vitest";
import { ACCESSORY_LOOKALIKES } from "../../content/accessories";
import { charactersDetails } from "../../helpers/characters";
import { generatePlayableLevel } from "../playableLevel";
import { validateSpec } from "../../engine/validate";
import type { LevelSpec, Tier } from "../../engine/types";
import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../../components/Game/Grid/layouts";
import { planTargets } from "../../components/Game/Grid/crowd";
import { sceneForIndex } from "../../content/scenes";
import { multiplayerLevel } from "../../multiplayer/multiplayerRules";
import {
  CROWD_VARIANT_KINDS, crowdVariantAt, crowdVariantChance, kindOfVariant, readVariantPreview, variantUnlockedAt,
} from "../crowdVariants";
import { withAccessoryPreview } from "../accessories";

const pool = charactersDetails;
const crowdOf = (spec: LevelSpec) => {
  const result = spec.layout === "grid" ? layoutGrid(spec).cells : spec.layout === "scroll" ? layoutScroll(spec).slots
    : spec.layout === "pile" ? placePile(spec) : placeSwarm(spec);
  return result.map((item) => ({
    isWanted: item.isWanted,
    species: "character" in item ? item.character.imageSrc : item.imageSrc,
    accessory: item.look.accessoryId,
  }));
};

describe("variantes de foule", () => {
  it("arrive progressivement, plus tard en Enfant, jamais pendant les respirations", () => {
    for (const tier of ["easy", "normal"] as Tier[]) {
      const seen = new Map<string, number>();
      for (let seed = 1; seed <= 40; seed++) {
        for (let index = 1; index <= 80; index++) {
          const spec = generatePlayableLevel(index, { seed, tier, pool });
          if (!spec.crowdVariant) continue;
          const kind = kindOfVariant(spec.crowdVariant);
          expect(index, `${tier} ${kind}`).toBeGreaterThanOrEqual(variantUnlockedAt(kind, tier));
          expect(sceneForIndex(index).breather).toBeFalsy();
          seen.set(kind, Math.min(seen.get(kind) ?? Infinity, index));
        }
      }
      for (const kind of CROWD_VARIANT_KINDS) {
        // Chaque variante se montre dans les quelques niveaux qui suivent son arrivée.
        expect(seen.get(kind), `${tier} ${kind}`).toBeLessThanOrEqual(variantUnlockedAt(kind, tier) + 4);
      }
    }
    expect(variantUnlockedAt("same-single", "normal")).toBe(15);
    expect(variantUnlockedAt("two-single", "normal")).toBe(20);
    expect(variantUnlockedAt("same-bare", "normal")).toBe(25);
    expect(variantUnlockedAt("same-mixed", "normal")).toBe(35);
    expect(variantUnlockedAt("same-mixed", "easy")).toBe(45);
  });

  it("devient plus fréquente avec le niveau, sans jamais remplacer tous les niveaux classiques", () => {
    for (const tier of ["easy", "normal", "expert"] as Tier[]) {
      for (let index = 2; index <= 300; index++) {
        expect(crowdVariantChance(index, tier)).toBeGreaterThanOrEqual(crowdVariantChance(index - 1, tier));
        expect(crowdVariantChance(index, tier)).toBeLessThan(.8);
      }
    }
    const share = (from: number, to: number) => {
      let variants = 0;
      let total = 0;
      for (let seed = 1; seed <= 30; seed++) for (let index = from; index <= to; index++) {
        if (sceneForIndex(index).breather) continue;
        total++;
        if (generatePlayableLevel(index, { seed, tier: "normal", pool }).crowdVariant) variants++;
      }
      return variants / total;
    };
    const early = share(16, 40);
    const late = share(120, 160);
    expect(early).toBeGreaterThan(.1);
    expect(late).toBeGreaterThan(early);
    expect(late).toBeLessThan(.85);
  });

  it("n'enchaîne jamais trois fois la même variante, en Infini comme dans les avis d'une étape", () => {
    for (const tier of ["easy", "normal", "expert"] as Tier[]) {
      for (let seed = 1; seed <= 60; seed++) {
        // Infini : un index par avis ; Aventure : cinq avis par index.
        for (const indexAt of [(p: number) => p, (p: number) => 15 + Math.floor((p - 1) / 5)]) {
          const kinds: (string | undefined)[] = [];
          for (let position = 1; position <= 400; position++) {
            const index = indexAt(position);
            const scene = sceneForIndex(index);
            kinds.push(crowdVariantAt(index, tier, scene.layout, { seed, position }, scene.breather));
          }
          for (let i = 2; i < kinds.length; i++) {
            if (!kinds[i]) continue;
            expect(kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2], `${tier} graine ${seed} #${i}`).toBe(false);
          }
        }
      }
    }
  });

  it.each(CROWD_VARIANT_KINDS)("garde une seule cible correspondant à l'avis (%s) dans les quatre dispositions", (kind) => {
    const layouts = new Set<string>();
    for (const tier of ["easy", "normal", "expert"] as Tier[]) {
      for (const seed of [1, 42, 2026]) {
        for (const index of [16, 17, 18, 21, 22, 24, 28, 30, 36, 42, 43, 44, 47, 53, 66, 120]) {
          const context = { seed, tier, pool };
          const spec = generatePlayableLevel(index, context, { forceVariant: kind });
          layouts.add(spec.layout);
          expect(kindOfVariant(spec.crowdVariant!)).toBe(kind);
          expect(validateSpec(spec, context).errors).toEqual([]);
          const target = spec.accessories!.target ?? undefined;
          // L'avis montre exactement la tenue recherchée (ou son absence).
          expect(planTargets(spec)[0].look.accessoryId).toBe(target);
          expect(kind.endsWith("-bare")).toBe(target === undefined);
          const crowd = crowdOf(spec);
          const wanted = crowd.filter((item) => item.isWanted);
          expect(wanted).toHaveLength(1);
          const species = new Set(crowd.map((item) => item.species));
          expect(species.size, `${kind} #${index}`).toBe(kind.startsWith("same") ? 1 : 2);
          // Unicité : aucun leurre n'a la même espèce et la même tenue que la cible.
          const matches = crowd.filter((item) => item.species === wanted[0].species && item.accessory === target);
          expect(matches, `${kind} ${tier} #${index} graine ${seed}`).toHaveLength(1);
          const sameDecoys = crowd.filter((item) => !item.isWanted && item.species === wanted[0].species);
          expect(sameDecoys.length).toBeGreaterThan(5);
          if (kind.endsWith("-single")) expect(sameDecoys.every((item) => item.accessory === undefined)).toBe(true);
          if (kind.endsWith("-bare")) expect(sameDecoys.every((item) => item.accessory !== undefined)).toBe(true);
          if (kind.endsWith("-mixed")) {
            expect(crowd.every((item) => item.accessory !== undefined)).toBe(true);
            const similar = ACCESSORY_LOOKALIKES[target!];
            expect(sameDecoys.some((item) => similar.includes(item.accessory!))).toBe(true);
          }
          expect(crowdOf(spec)).toEqual(crowd);
        }
      }
    }
    expect(layouts.size).toBe(4);
  });

  it("garde la cible visible et sans demi-rangées trompeuses, et ne place pas la variante B dans les tas", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (let index = 15; index <= 120; index++) {
        const spec = generatePlayableLevel(index, { seed, tier: "normal", pool });
        if (!spec.crowdVariant) continue;
        expect(spec.params.wantedBelow).toBeFalsy();
        if (spec.crowdVariant.dress === "bare") {
          expect(spec.layout).not.toBe("pile");
          expect(spec.params.edgeRows).toBeFalsy();
        }
      }
    }
  });

  it("choisit un sosie de la cible pour la variante à deux espèces", () => {
    const spec = generatePlayableLevel(60, { seed: 42, tier: "normal", pool }, { forceVariant: "two-mixed" });
    const partner = pool.find((animal) => animal.name === spec.crowdVariant?.partner)!;
    expect(partner).toBeTruthy();
    expect(partner.name).not.toBe(spec.wanted.name);
    expect(spec.decoys.map((d) => d.name).sort()).toEqual([spec.wanted.name, partner.name].sort());
  });

  it("reste hors des salons en ligne et des aperçus de production", () => {
    for (let index = 1; index <= 120; index++) expect(multiplayerLevel(index, 42, "animaux").crowdVariant).toBeUndefined();
    expect(readVariantPreview("?variant=same-bare", true)).toBe("same-bare");
    expect(readVariantPreview("?variant=same-bare", false)).toBeUndefined();
    expect(readVariantPreview("?variant=rien", true)).toBeUndefined();
    const bare = generatePlayableLevel(30, { seed: 1, tier: "normal", pool }, { forceVariant: "same-bare" });
    expect(withAccessoryPreview(bare, "cap")).toBe(bare);
    expect(withAccessoryPreview(generatePlayableLevel(30, { seed: 1, tier: "normal", pool }, { forceVariant: "two-single" }), "cap").accessories?.target).toBe("cap");
  });
});
