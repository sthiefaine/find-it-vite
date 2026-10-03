import { RefObject, useEffect, useRef } from "react";
import type { Tier } from "../../engine/types";
import "./Flashlight.css";

const BASE_RADIUS: Record<Tier, number> = { easy: 105, normal: 80, expert: 65 };
const PULSE_MS = 1200;
const IDLE_MS = 4000;

type Props = {
  // Conteneur du plateau : on y écoute le doigt, en capture
  boardRef: RefObject<HTMLElement>;
  width: number;
  height: number;
  scale: number;
  tier: Tier;
  active: boolean; // niveau affiché : lance la pulsation
  hidden: boolean; // bonne réponse ou fin de partie : fondu
};

const Flashlight = ({ boardRef, width, height, scale, tier, active, hidden }: Props) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const radius = BASE_RADIUS[tier] * scale;
  const pulseStart = useRef<number | null>(null);
  const activeAt = useRef(Infinity);

  // Petit délai : laisse la carte de découverte finir de sortir
  useEffect(() => {
    if (!active) return;
    activeAt.current = performance.now();
    pulseStart.current = activeAt.current + 350;
  }, [active]);

  useEffect(() => {
    const board = boardRef.current;
    const overlay = overlayRef.current;
    if (!board || !overlay) return;

    const pos = { x: width / 2, y: height / 2 };
    const target = { ...pos };
    let snap = false;
    let lastMove = performance.now();
    let wanderStart = 0;
    let last = "";

    const onPointer = (e: PointerEvent) => {
      const box = board.getBoundingClientRect();
      target.x = e.clientX - box.left;
      target.y = e.clientY - box.top;
      if (e.type === "pointerdown") snap = true;
      lastMove = performance.now();
    };
    board.addEventListener("pointermove", onPointer, { capture: true, passive: true });
    board.addEventListener("pointerdown", onPointer, { capture: true, passive: true });

    let raf = 0;
    const tick = (now: number) => {
      let ease = 0.5;
      // Easy : sans mouvement depuis 4 s, la lumière se balade toute seule
      if (tier === "easy" && now - Math.max(lastMove, activeAt.current) > IDLE_MS) {
        if (!wanderStart) wanderStart = now;
        const t = (now - wanderStart) / 1000;
        target.x = width / 2 + width * 0.32 * Math.sin(t * 0.45);
        target.y = height / 2 + height * 0.32 * Math.sin(t * 0.7);
        ease = 0.03;
      } else {
        wanderStart = 0;
      }
      if (snap) {
        pos.x = target.x;
        pos.y = target.y;
        snap = false;
      } else {
        pos.x += (target.x - pos.x) * ease;
        pos.y += (target.y - pos.y) * ease;
      }

      let r = radius;
      const p0 = pulseStart.current;
      if (p0 !== null && now >= p0) {
        const p = (now - p0) / PULSE_MS;
        if (p >= 1) pulseStart.current = null;
        // Deux battements qui s'amortissent
        else r *= 1 + 0.35 * Math.sin(p * 2 * Math.PI * 2) ** 2 * (1 - p);
      }

      const next = `${pos.x.toFixed(1)}|${pos.y.toFixed(1)}|${r.toFixed(1)}`;
      if (next !== last) {
        last = next;
        overlay.style.setProperty("--fl-x", `${pos.x.toFixed(1)}px`);
        overlay.style.setProperty("--fl-y", `${pos.y.toFixed(1)}px`);
        overlay.style.setProperty("--fl-r", `${r.toFixed(1)}px`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      board.removeEventListener("pointermove", onPointer, { capture: true });
      board.removeEventListener("pointerdown", onPointer, { capture: true });
    };
  }, [boardRef, width, height, radius, tier]);

  return (
    <div
      ref={overlayRef}
      className={`flashlight${hidden ? " flashlight--off" : ""}`}
      aria-hidden
    />
  );
};

export default Flashlight;
