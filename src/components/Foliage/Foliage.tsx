import { useEffect, useId, useMemo, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { GameStateEnum, useGameStore } from "../../../store/store";
import { BOARD } from "../../engine/types";
import type { LevelSpec } from "../../engine/types";
import {
  foliageDragClears, foliageExit, foliageHit, makeFoliage, moveFoliageDrag,
} from "../../game/foliage";
import type { FoliageDrag, FoliagePoint } from "../../game/foliage";
import { isPageVisible, subscribeAppActive } from "../../platform/appLifecycle";
import "./Foliage.css";

const IMAGE = "/assets/images/obstacles/foliage.png";
const ORIGIN: FoliagePoint = { x: 0, y: 0 };

export default function Foliage({ boardRef, spec }: { boardRef: RefObject<HTMLDivElement>; spec: LevelSpec }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const keyboardClear = useRef<(id: number) => void>(() => undefined);
  const tier = useGameStore(state => state.tier);
  const density = spec.scene?.foliage;
  const seed = spec.seed;
  const instructionsId = useId();
  const patches = useMemo(() => density ? makeFoliage(seed, density, tier) : [], [seed, density, tier]);

  useEffect(() => {
    const board = boardRef.current;
    const layer = layerRef.current;
    if (!board || !layer || !patches.length) return;
    const buttons = Array.from(layer.querySelectorAll<HTMLButtonElement>(".foliage-patch"));
    const cleared = new Set<number>();
    const offsets = patches.map(() => ({ ...ORIGIN }));
    const frames = new Map<number, number>();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let drag: FoliageDrag | null = null;
    let ready = false;
    let visible = isPageVisible();
    let alive = true;
    let alpha: Uint8ClampedArray | null = null;
    const maskSize = 128;
    const img = new Image();
    board.classList.add("foliage-board");

    const isActive = () => {
      const state = useGameStore.getState();
      return visible && state.currentSpec?.seed === seed && state.gameState === GameStateEnum.PLAYING &&
        !state.animationLevelLoading && !state.wantedFound && !state.pauseTimer && !state.worldBanner;
    };
    const paint = (id: number, offset: FoliagePoint) => {
      offsets[id] = offset;
      const patch = patches[id];
      buttons[id].style.transform = `translate(-50%, -50%) translate(${offset.x / patch.size * 100}%, ${offset.y / patch.size * 100}%) rotate(${patch.rotation}deg)`;
    };
    const stopAnimation = (id: number) => {
      const frame = frames.get(id);
      if (frame !== undefined) cancelAnimationFrame(frame);
      frames.delete(id);
    };
    const animate = (id: number, destination: FoliagePoint, removing: boolean) => {
      stopAnimation(id);
      const start = { ...offsets[id] };
      const startedAt = performance.now();
      const duration = motion.matches ? 0 : removing ? 260 : 150;
      const frame = (now: number) => {
        const t = duration ? Math.min(1, (now - startedAt) / duration) : 1;
        const ease = 1 - (1 - t) ** 3;
        paint(id, { x: start.x + (destination.x - start.x) * ease, y: start.y + (destination.y - start.y) * ease });
        if (t < 1) frames.set(id, requestAnimationFrame(frame));
        else {
          frames.delete(id);
          if (removing) buttons[id].hidden = true;
        }
      };
      frame(startedAt);
    };
    const clearPatch = (id: number, offset: FoliagePoint) => {
      if (cleared.has(id)) return;
      cleared.add(id);
      buttons[id].tabIndex = -1;
      buttons[id].setAttribute("aria-hidden", "true");
      animate(id, foliageExit(patches[id], offset), true);
      layer.dataset.remaining = String(patches.length - cleared.size);
    };
    const releaseCapture = (pointerId: number) => {
      if (board.hasPointerCapture(pointerId)) board.releasePointerCapture(pointerId);
    };
    const cancelDrag = () => {
      const previous = drag;
      drag = null;
      if (!previous) return;
      releaseCapture(previous.pointerId);
      animate(previous.patchId, ORIGIN, false);
      layer.dataset.dragging = "false";
    };
    const syncActive = () => {
      const active = isActive();
      layer.dataset.active = String(active);
      if (!active) cancelDrag();
      for (const patch of patches) buttons[patch.id].tabIndex = active && ready && !cleared.has(patch.id) ? 0 : -1;
    };
    img.onload = () => {
      if (!alive) return;
      const canvas = document.createElement("canvas");
      canvas.width = maskSize;
      canvas.height = maskSize;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(img, 0, 0, maskSize, maskSize);
      alpha = context.getImageData(0, 0, maskSize, maskSize).data;
      ready = true;
      layer.dataset.ready = "true";
      syncActive();
    };
    img.src = IMAGE;

    const pointOf = (event: PointerEvent): FoliagePoint => {
      const box = board.getBoundingClientRect();
      return { x: (event.clientX - box.left) / box.width * BOARD.w, y: (event.clientY - box.top) / box.height * BOARD.h };
    };
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const pointerDown = (event: PointerEvent) => {
      if (!ready || !alpha || !isActive() || event.button !== 0 || useGameStore.getState().obstacleBlocking) return;
      if (event.target instanceof Element && event.target.closest(".seagulls-preview")) return;
      if (drag) { swallow(event); return; }
      const point = pointOf(event);
      for (let id = patches.length - 1; id >= 0; id--) {
        if (buttons[id].hidden || !foliageHit(patches[id], offsets[id], point, alpha, maskSize)) continue;
        swallow(event);
        // Une feuille qui finit de sortir reste opaque jusqu'à sa disparition.
        if (cleared.has(id)) return;
        stopAnimation(id);
        drag = { pointerId: event.pointerId, patchId: id, start: { x: point.x - offsets[id].x, y: point.y - offsets[id].y }, offset: offsets[id] };
        board.setPointerCapture(event.pointerId);
        layer.dataset.dragging = "true";
        return;
      }
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      swallow(event);
      if (!isActive()) { cancelDrag(); return; }
      drag = moveFoliageDrag(drag, event.pointerId, pointOf(event));
      paint(drag.patchId, drag.offset);
    };
    const pointerEnd = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      swallow(event);
      const previous = moveFoliageDrag(drag, event.pointerId, pointOf(event));
      drag = null;
      releaseCapture(previous.pointerId);
      if (foliageDragClears(previous, event.type !== "pointerup" || !isActive())) clearPatch(previous.patchId, previous.offset);
      else animate(previous.patchId, ORIGIN, false);
      layer.dataset.dragging = "false";
    };
    const lostCapture = (event: PointerEvent) => {
      if (drag?.pointerId === event.pointerId) cancelDrag();
    };
    keyboardClear.current = id => {
      if (!ready || !isActive() || useGameStore.getState().obstacleBlocking) return;
      cancelDrag();
      clearPatch(id, ORIGIN);
      const next = patches.find(patch => !cleared.has(patch.id));
      if (next) buttons[next.id].focus({ preventScroll: true });
    };
    const unsubscribeVisibility = subscribeAppActive(active => { visible = active; syncActive(); });
    const unsubscribeStore = useGameStore.subscribe(syncActive);
    board.addEventListener("pointerdown", pointerDown, { capture: true });
    board.addEventListener("pointermove", pointerMove, { capture: true });
    board.addEventListener("pointerup", pointerEnd, { capture: true });
    board.addEventListener("pointercancel", pointerEnd, { capture: true });
    board.addEventListener("lostpointercapture", lostCapture);
    layer.dataset.remaining = String(patches.length);
    patches.forEach(patch => {
      buttons[patch.id].hidden = false;
      buttons[patch.id].removeAttribute("aria-hidden");
      paint(patch.id, ORIGIN);
    });
    syncActive();

    return () => {
      alive = false;
      cancelDrag();
      frames.forEach(cancelAnimationFrame);
      unsubscribeVisibility();
      unsubscribeStore();
      board.classList.remove("foliage-board");
      board.removeEventListener("pointerdown", pointerDown, true);
      board.removeEventListener("pointermove", pointerMove, true);
      board.removeEventListener("pointerup", pointerEnd, true);
      board.removeEventListener("pointercancel", pointerEnd, true);
      board.removeEventListener("lostpointercapture", lostCapture);
      img.onload = null;
      layer.dataset.ready = "false";
      keyboardClear.current = () => undefined;
    };
  }, [boardRef, patches, seed]);

  if (!density) return null;
  return <div ref={layerRef} className="foliage-layer" data-ready="false" data-active="false" aria-label="Feuillages à écarter">
    <span id={instructionsId} className="foliage-instructions">Fais glisser les feuilles pour regarder dessous. Au clavier, appuie sur Entrée ou Espace pour les écarter.</span>
    {patches.map(patch => <button
      key={`${seed}-${patch.id}`}
      type="button"
      className="foliage-patch"
      aria-label={`Écarter le feuillage ${patch.id + 1}`}
      aria-describedby={instructionsId}
      tabIndex={-1}
      style={{ left: `${patch.x / BOARD.w * 100}%`, top: `${patch.y / BOARD.h * 100}%`, width: `${patch.size / BOARD.w * 100}%` } as CSSProperties}
      onClick={event => { event.preventDefault(); event.stopPropagation(); keyboardClear.current(patch.id); }}
    ><img src={IMAGE} alt="" draggable={false} /></button>)}
  </div>;
}
