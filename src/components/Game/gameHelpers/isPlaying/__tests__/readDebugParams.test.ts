import { describe, expect, it } from "vitest";
import { readDebugParams } from "../isPlaying";
import { readModeParams } from "../../../../../game/modes";

describe("readDebugParams", () => {
  it("en dev : lit seed, level et tier", () => {
    expect(readDebugParams("?seed=123&level=8&tier=expert", true)).toEqual({
      seed: 123,
      level: 8,
      tier: "expert",
    });
  });

  it("en prod : ignore ?seed, ?level et ?tier", () => {
    expect(readDebugParams("?seed=123&level=8&tier=expert", false)).toEqual({});
  });

  it("en prod, l'Aventure garde ?mode=…&world=…&level=…", () => {
    const search = "?mode=adventure&world=ocean&level=3";
    expect(readDebugParams(search, false)).toEqual({});
    expect(readModeParams(search)).toEqual({ mode: "adventure", worldId: "ocean", level: 3 });
  });
});
