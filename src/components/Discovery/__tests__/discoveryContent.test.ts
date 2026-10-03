import { describe, expect, it } from "vitest";
import { charactersDetails } from "../../../helpers/characters";
import { generateLevel } from "../../../engine";
import type { LevelSpec } from "../../../engine";
import { discoveryContent } from "../discoveryContent";

const base: LevelSpec = generateLevel(1, { seed: 1, tier: "normal", pool: charactersDetails });

describe("discoveryContent", () => {
  it("préfère la règle à la disposition", () => {
    const c = discoveryContent({ ...base, layout: "swarm", rule: "memory", modifiers: [] });
    expect(c).toEqual({ icon: "🧠", hint: "Retiens-le bien !", gesture: "tap" });
  });

  it("flashlight : geste glissé", () => {
    const c = discoveryContent({ ...base, rule: "classic", modifiers: ["lookalikes", "flashlight"] });
    expect(c.icon).toBe("🔦");
    expect(c.gesture).toBe("swipe");
  });

  it("findAll : affiche le nombre à trouver", () => {
    expect(discoveryContent({ ...base, rule: "findAll", findCount: 3, modifiers: [] }).icon).toBe("×3");
  });

  it("sinon la disposition", () => {
    expect(discoveryContent({ ...base, layout: "scroll", rule: "classic", modifiers: [] }).hint).toBe("Ils défilent !");
    expect(discoveryContent({ ...base, layout: "pile", rule: "classic", modifiers: [] }).hint).toBe("Ils sont tous en tas !");
    expect(discoveryContent({ ...base, layout: "swarm", rule: "classic", modifiers: [] }).hint).toBe("Ils bougent !");
  });

  describe("avec les mécaniques nouvelles", () => {
    it("ne montre pas une règle déjà vue : la disposition nouvelle à la place", () => {
      const spec = { ...base, layout: "swarm" as const, rule: "memory" as const, modifiers: [] };
      expect(discoveryContent(spec, ["layout:swarm"]).hint).toBe("Ils bougent !");
    });

    it("préfère un modificateur nouveau à une règle déjà vue", () => {
      const spec = { ...base, layout: "grid" as const, rule: "memory" as const, modifiers: ["flashlight" as const] };
      const c = discoveryContent(spec, ["modifier:flashlight"]);
      expect(c.icon).toBe("🔦");
      expect(c.gesture).toBe("swipe");
    });

    it("préfère une règle nouvelle à une disposition nouvelle", () => {
      const spec = { ...base, layout: "pile" as const, rule: "memory" as const, modifiers: [] };
      expect(discoveryContent(spec, ["layout:pile", "rule:memory"]).icon).toBe("🧠");
    });

    it("ignore les mécaniques qui ne sont pas dans le niveau", () => {
      const spec = { ...base, layout: "scroll" as const, rule: "classic" as const, modifiers: [] };
      expect(discoveryContent(spec, ["rule:memory", "layout:scroll"]).hint).toBe("Ils défilent !");
    });
  });
});
