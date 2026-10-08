import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Application, ICanvas } from "pixi.js";

// Chaque niveau monte un nouveau <Stage> (key={spec.seed}). Le démontage de @pixi/react
// ne libère pas toujours le contexte WebGL : ils s'accumulent jusqu'à « Too many active
// WebGL contexts ». On le libère nous-mêmes une fois le canvas sorti du DOM (vrai
// démontage ; le double montage du StrictMode garde le même canvas en place).
export function useReleaseStage(): (app: Application) => void {
  const view = useRef<HTMLCanvasElement | null>(null);
  const firstFrame = useRef<Application | null>(null);

  // Stage redimensionne son canvas après onMount, ce qui efface son contenu.
  // Le layout effect parent vient ensuite : dessiner ici prépare la grille
  // dans le même commit que les obstacles, avant toute peinture du navigateur.
  useLayoutEffect(() => {
    const app = firstFrame.current;
    if (!app) return;
    firstFrame.current = null;
    app.render();
  });

  useEffect(
    () => () => {
      const canvas = view.current;
      if (!canvas) return;
      setTimeout(() => {
        if (canvas.isConnected) return;
        // getContext renvoie le contexte existant (même type), sans en créer un autre
        const gl =
          (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
          (canvas.getContext("webgl") as WebGLRenderingContext | null);
        if (gl && !gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
      }, 0);
    },
    []
  );

  return useCallback((app: Application) => {
    const v: ICanvas = app.view;
    if (v instanceof HTMLCanvasElement) view.current = v;
    firstFrame.current = app;
  }, []);
}
