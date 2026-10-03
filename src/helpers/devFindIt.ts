// Outil de test, chargé en dev seulement (voir App.tsx) :
// window.__findIt.spec : niveau en cours ; window.__findIt.positions() : où est le recherché.
import { Container, DisplayObject, Renderer, Sprite } from "pixi.js";
import { useGameStore } from "../../store/store";

type Rect = { x: number; y: number; width: number; height: number };

// Chaque rendu Pixi passe par Renderer.render : on retient la scène de chaque canvas
const scenes = new Map<HTMLCanvasElement, DisplayObject>();
const originalRender = Renderer.prototype.render;
Renderer.prototype.render = function (this: Renderer, displayObject, options) {
  if (this.view instanceof HTMLCanvasElement && displayObject instanceof DisplayObject)
    scenes.set(this.view, displayObject);
  return originalRender.call(this, displayObject, options);
};

const textureUrl = (sprite: Sprite): string | undefined => {
  const resource = sprite.texture?.baseTexture?.resource as
    | { url?: string; src?: string }
    | undefined;
  return resource?.url ?? resource?.src;
};

const absolute = (url: string) => new URL(url, window.location.href).href;

function collectSprites(node: DisplayObject, out: Sprite[]) {
  if (!node.visible) return;
  if (node instanceof Sprite) out.push(node);
  if (node instanceof Container) node.children.forEach((c) => collectSprites(c, out));
}

// Rectangles (en px de la page) des sprites du recherché sur le plateau
function positions(): Rect[] {
  const spec = useGameStore.getState().currentSpec;
  if (!spec) return [];
  const wanted = absolute(spec.wanted.imageSrc);
  const rects: Rect[] = [];
  for (const [canvas, root] of scenes) {
    if (!canvas.isConnected) {
      scenes.delete(canvas);
      continue;
    }
    if (!canvas.closest(".gridContainer")) continue;
    const box = canvas.getBoundingClientRect();
    const sprites: Sprite[] = [];
    collectSprites(root, sprites);
    for (const sprite of sprites) {
      const url = textureUrl(sprite);
      if (!url || absolute(url) !== wanted || sprite.worldAlpha === 0) continue;
      const b = sprite.getBounds();
      rects.push({ x: box.left + b.x, y: box.top + b.y, width: b.width, height: b.height });
    }
  }
  return rects;
}

declare global {
  interface Window {
    __findIt?: unknown;
  }
}

window.__findIt = {
  get spec() {
    return useGameStore.getState().currentSpec;
  },
  get state() {
    const { level, runSeed, tier, gameState, timeLeft, score, animationLevelLoading } =
      useGameStore.getState();
    return { level, runSeed, tier, gameState, timeLeft, score, animationLevelLoading };
  },
  positions,
};
