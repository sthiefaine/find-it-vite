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
});
