// Tête d'un perso, centrée en (cx, cy) : apparence (intrus), dorure et « pop » des cibles dorées.
import { useCallback, useRef, useState } from "react";
import { Container, Graphics, Sprite, useTick } from "@pixi/react";
import {
  BLEND_MODES,
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Sprite as PixiSprite,
} from "pixi.js";
import { GOLD_TINT } from "../../../engine/rules";
import { Look, PLAIN_LOOK } from "./crowd";

const POP_FRAMES = 14; // ≈ 0,23 s à 60 fps

type Props = {
  name?: string;
  cx: number;
  cy: number;
  size: number;
  image: string;
  look?: Look;
  gold?: boolean;
  found?: boolean; // cible dorée trouvée : pop puis disparition
  alpha?: number;
  phase?: number; // décalage du scintillement
};

const drawSparkle = (g: PixiGraphics) => {
  g.clear();
  g.beginFill(0xffffff);
  g.drawPolygon([0, -1, 0.22, -0.22, 1, 0, 0.22, 0.22, 0, 1, -0.22, 0.22, -1, 0, -0.22, -0.22]);
  g.endFill();
};

// Halo doré derrière la tête
const drawHalo = (w: number) => (g: PixiGraphics) => {
  g.clear();
  g.beginFill(GOLD_TINT, 0.25);
  g.lineStyle(Math.max(2, w * 0.05), GOLD_TINT, 0.95);
  g.drawCircle(0, 0, w * 0.47);
  g.endFill();
};

export function CrowdSprite({
  name,
  cx,
  cy,
  size,
  image,
  look = PLAIN_LOOK,
  gold = false,
  found = false,
  alpha = 1,
  phase = 0,
}: Props) {
  const outer = useRef<PixiContainer>(null);
  const glint = useRef<PixiSprite>(null);
  const sparkle = useRef<PixiGraphics>(null);
  const time = useRef(phase);
  const pop = useRef(0);
  const [gone, setGone] = useState(false);

  useTick((delta) => {
    if (found) {
      // Pop : gonfle puis s'efface
      pop.current += delta;
      const t = Math.min(1, pop.current / POP_FRAMES);
      outer.current?.scale.set(1 + 0.6 * t);
      if (outer.current) outer.current.alpha = 1 - t;
      if (t >= 1) setGone(true);
      return;
    }
    time.current += delta / 60;
    const s = (Math.sin(time.current * 4) + 1) / 2;
    if (glint.current) glint.current.alpha = 0.35 * s * s;
    if (sparkle.current) {
      const p = Math.max(0, Math.sin(time.current * 2.3 + 1));
      sparkle.current.scale.set(size * 0.13 * p);
      sparkle.current.rotation = time.current;
    }
  }, gold && !gone);

  const sparkleDraw = useCallback(drawSparkle, []);
  const w = size * look.scale;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const haloDraw = useCallback(drawHalo(w), [w]);

  // Gardé invisible pour devFindIt (position de la cible)
  if (gone) return <Container name={name} x={cx} y={cy} visible={false} />;

  return (
    <Container ref={outer} name={name} x={cx} y={cy} alpha={alpha}>
      {gold && <Graphics draw={haloDraw} />}
      <Container rotation={look.rotation} scale={[look.flip ? -1 : 1, 1]}>
        <Sprite image={image} anchor={0.5} width={w} height={w} tint={look.tint} eventMode="none" />
        {gold && (
          <Sprite
            ref={glint}
            image={image}
            anchor={0.5}
            width={w}
            height={w}
            alpha={0}
            blendMode={BLEND_MODES.ADD}
            eventMode="none"
          />
        )}
      </Container>
      {gold && <Graphics ref={sparkle} x={w * 0.28} y={-w * 0.3} scale={0} draw={sparkleDraw} />}
    </Container>
  );
}

// Cible trouvée (findAll) : anneau vert et coche, au-dessus de la foule
const drawFound = (size: number) => (g: PixiGraphics) => {
  const r = size * 0.46;
  g.clear();
  g.lineStyle(Math.max(3, size * 0.07), 0x22c55e, 1);
  g.drawCircle(0, 0, r);
  const b = Math.max(9, size * 0.17);
  g.lineStyle(0);
  g.beginFill(0x22c55e);
  g.drawCircle(r * 0.7, r * 0.7, b);
  g.endFill();
  g.lineStyle(Math.max(2, b * 0.3), 0xffffff, 1);
  g.moveTo(r * 0.7 - b * 0.5, r * 0.7);
  g.lineTo(r * 0.7 - b * 0.1, r * 0.7 + b * 0.4);
  g.lineTo(r * 0.7 + b * 0.5, r * 0.7 - b * 0.4);
};

export function FoundMarker({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draw = useCallback(drawFound(size), [size]);
  return <Graphics x={cx} y={cy} draw={draw} eventMode="none" />;
}
