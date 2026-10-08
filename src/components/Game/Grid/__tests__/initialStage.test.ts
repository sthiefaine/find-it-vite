import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";

const { layoutEffects } = vi.hoisted(() => ({ layoutEffects: [] as (() => void)[] }));
vi.mock("react", () => ({
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useLayoutEffect: (effect: () => void) => layoutEffects.push(effect),
}));

import { useReleaseStage } from "../useReleaseStage";

class Canvas {}
beforeEach(() => { layoutEffects.length = 0; vi.stubGlobal("HTMLCanvasElement", Canvas); });
afterEach(() => vi.unstubAllGlobals());

describe("première frame du plateau", () => {
  it("dessine après le redimensionnement de Stage, dans le layout effect avant peinture", () => {
    const mount = useReleaseStage();
    const events: string[] = [];
    const render = vi.fn(() => events.push("dessin"));
    const app = { view: new Canvas(), render } as unknown as Application;

    // Le hook existe pendant le chargement, sans Stage monté.
    layoutEffects.forEach(effect => effect());
    expect(render).not.toHaveBeenCalled();
    mount(app);
    expect(render).not.toHaveBeenCalled();
    // @pixi/react appelle updateSize après onMount, effaçant le canvas.
    events.push("resize");
    layoutEffects.forEach(effect => effect());
    expect(events).toEqual(["resize", "dessin"]);
    // Les rendus React suivants ne rajoutent pas de frame synchrone.
    layoutEffects.forEach(effect => effect());
    expect(render).toHaveBeenCalledTimes(1);

    const nextRender = vi.fn();
    mount({ view: new Canvas(), render: nextRender } as unknown as Application);
    layoutEffects.forEach(effect => effect());
    expect(nextRender).toHaveBeenCalledTimes(1);
  });
});
