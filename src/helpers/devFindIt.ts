// Outil de test, chargé en dev seulement (voir App.tsx) :
// window.__findIt.spec : niveau en cours ; window.__findIt.positions() : où sont les cibles.
import { Container, DisplayObject, Renderer } from "pixi.js";
import { useGameStore } from "../../store/store";

// Cible : centre (x, y) et taille en px CSS de la page
type TargetPos = { id: number; x: number; y: number; width: number; height: number; found: boolean };

// Chaque rendu Pixi passe par Renderer.render : on retient la scène de chaque canvas
const scenes = new Map<HTMLCanvasElement, DisplayObject>();
const originalRender = Renderer.prototype.render;
Renderer.prototype.render = function (this: Renderer, displayObject, options) {
  if (this.view instanceof HTMLCanvasElement && displayObject instanceof DisplayObject)
    scenes.set(this.view, displayObject);
  return originalRender.call(this, displayObject, options);
};

// Conteneurs nommés « target:<id> » par les grilles (voir Grid/crowd.ts), même invisibles
function collectTargets(node: DisplayObject, out: DisplayObject[]) {
  if (node.name?.startsWith("target:")) out.push(node);
  if (node instanceof Container) node.children.forEach((c) => collectTargets(c, out));
}

const foundIds = (): number[] => {
  const s = useGameStore.getState();
  return "foundIds" in s ? ((s.foundIds as number[] | undefined) ?? []) : [];
};

// Toutes les cibles du plateau. En défilement, une cible qui passe un bord a deux copies :
// on garde la plus à l'intérieur du plateau.
function positions(): TargetPos[] {
  const found = new Set(foundIds());
  const best = new Map<number, { pos: TargetPos; inside: number }>();
  for (const [canvas, root] of scenes) {
    if (!canvas.isConnected) {
      scenes.delete(canvas);
      continue;
    }
    if (!canvas.closest(".gridContainer")) continue;
    const box = canvas.getBoundingClientRect();
    const nodes: DisplayObject[] = [];
    collectTargets(root, nodes);
    for (const node of nodes) {
      const id = Number(node.name!.slice("target:".length));
      const c = node.toGlobal({ x: 0, y: 0 });
      const b = node.visible ? node.getBounds() : null;
      const inside = Math.min(c.x, c.y, box.width - c.x, box.height - c.y);
      const pos: TargetPos = {
        id,
        x: box.left + c.x,
        y: box.top + c.y,
        width: b?.width ?? 0,
        height: b?.height ?? 0,
        found: found.has(id),
      };
      const prev = best.get(id);
      if (!prev || inside > prev.inside) best.set(id, { pos, inside });
    }
  }
  return [...best.values()].map((v) => v.pos).sort((a, b) => a.id - b.id);
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
