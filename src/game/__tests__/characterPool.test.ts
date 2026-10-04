import { describe, expect, it } from "vitest";
import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../../components/Game/Grid/layouts";
import { unlockedAnimals } from "../../content/unlockedAnimals";
import { getWorld } from "../../content/worlds";
import { defaultSave } from "../../save/schema";
import { poolOfStep } from "../adventureRun";
import { characterPoolFor } from "../characterPool";
import { readModeParams } from "../modes";
import { generatePlayableLevel } from "../playableLevel";

describe("catalogue des modes", () => {
  it("ignore les anciennes séries dans l'URL et préserve les catalogues Aventure et Défi", () => {
    const save = defaultSave();
    for (const search of ["", "?serie=ferme", "?serie=sauvages", "?serie=vaches", "?serie=inconnue&level=4000&seed=42"]) {
      const mode = readModeParams(search).mode;
      expect(characterPoolFor(mode, 1, save)).toEqual(unlockedAnimals(save));
    }
    expect(characterPoolFor(readModeParams("?mode=daily&serie=ferme").mode, 1, save)).toEqual(getWorld("animaux")!.characters);
    expect(characterPoolFor(readModeParams("?mode=adventure&world=ocean&serie=ferme").mode, 21, save)).toEqual(poolOfStep(21));
  });

  it("limite cible, leurres et foule à tous les portraits débloqués, même aux reprises", () => {
    for (const save of [defaultSave(), { collection: { panda: 2, "vache-normande": 1 } }]) {
      const pool = characterPoolFor("endless", 1, save);
      const ids = new Set(pool.map((animal) => animal.name));
      const images = new Set(pool.map((animal) => animal.imageSrc));
      const layouts = new Set<string>();
      for (const tier of ["easy", "normal", "expert"] as const) {
        for (const index of [...Array.from({ length: 60 }, (_, i) => i + 1), 100, 4000]) {
          const spec = generatePlayableLevel(index, { seed: 42, tier, pool });
          layouts.add(spec.layout);
          expect(ids.has(spec.wanted.name)).toBe(true);
          expect(spec.decoys.every((animal) => ids.has(animal.name))).toBe(true);
          const crowd = spec.layout === "grid" ? layoutGrid(spec).cells : spec.layout === "scroll" ? layoutScroll(spec).slots : spec.layout === "pile" ? placePile(spec) : placeSwarm(spec);
          expect(crowd.every((slot) => images.has("character" in slot ? slot.character.imageSrc : slot.imageSrc))).toBe(true);
          expect(crowd.filter((slot) => slot.isWanted)).toHaveLength(1);
        }
      }
      expect(layouts.size).toBe(4);
    }
  });

  it("retrouve les mêmes portraits au rejeu et prend en compte une nouvelle capture", () => {
    const save = defaultSave();
    const first = generatePlayableLevel(11, { seed: 2026, tier: "normal", pool: characterPoolFor("endless", 1, save) });
    const replay = generatePlayableLevel(11, { seed: 2026, tier: "normal", pool: characterPoolFor("endless", 1, save) });
    expect(replay).toEqual(first);
    const unlocked = { ...save, collection: { ...save.collection, panda: 1 } };
    expect(characterPoolFor("endless", 1, unlocked).some((animal) => animal.name === "panda")).toBe(true);
    expect(characterPoolFor("endless", 1, save).some((animal) => animal.name === "panda")).toBe(false);
  });
});
