import { afterEach, describe, expect, it, vi } from "vitest";
import { error, success, tapLight } from "../haptics";
import { platformStorage } from "../storage";
import { localStorageAdapter } from "../../save/storage";

afterEach(() => vi.unstubAllGlobals());

describe("haptics (web)", () => {
  it("utilise navigator.vibrate", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    tapLight();
    success();
    error();
    expect(vibrate).toHaveBeenCalledTimes(3);
  });

  it("ne plante pas sans vibreur, ni si vibrate lève une erreur", () => {
    vi.stubGlobal("navigator", {});
    expect(() => tapLight()).not.toThrow();
    vi.stubGlobal("navigator", { vibrate: () => { throw new Error("refusé"); } });
    expect(() => error()).not.toThrow();
  });
});

describe("platformStorage", () => {
  it("garde localStorage hors de l'app native", () => {
    expect(platformStorage()).toBe(localStorageAdapter);
  });
});
