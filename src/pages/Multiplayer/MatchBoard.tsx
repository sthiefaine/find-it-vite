import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import { BOARD, type LevelSpec } from "../../engine/types";
import { ACCESSORY_OUTLINE_OFFSETS, getAccessory, getAccessoryBox } from "../../content/accessories";
import { preparedAccessoryOutline, preparedImage } from "../../game/assetReadiness";
import { pickCharacterAt } from "../../helpers/hitTest";
import { createMatchBoard, type MatchSprite } from "./boardModel";

type Props = {
  spec: LevelSpec;
  startsAt: number;
  serverNow: () => number;
  enabled: boolean;
  onTap: (id: number) => void;
};

export function MatchBoard({ spec, startsAt, serverNow, enabled, onTap }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const painted = useRef<MatchSprite[]>([]);
  const atTime = useMemo(() => createMatchBoard(spec), [spec]);
  const cursor = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    let frame = 0;
    let ratio = 1;
    const resize = () => {
      ratio = Math.min(3, window.devicePixelRatio || 1) * element.clientWidth / BOARD.w;
      element.width = Math.round(BOARD.w * ratio);
      element.height = Math.round(BOARD.h * ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const render = () => {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, BOARD.w, BOARD.h);
      const sprites = atTime(Math.max(0, (serverNow() - startsAt) / 1_000));
      painted.current = sprites;
      for (const sprite of sprites) {
        const image = preparedImage(sprite.imageSrc);
        if (!image) continue;
        const size = sprite.size * sprite.look.scale;
        context.save();
        context.translate(sprite.cx, sprite.cy);
        context.rotate(sprite.look.rotation);
        context.scale(sprite.look.flip ? -1 : 1, 1);
        context.drawImage(image, -size / 2, -size / 2, size, size);
        const accessory = getAccessory(sprite.look.accessoryId);
        if (accessory) {
          const accessoryImage = preparedImage(accessory.imageSrc);
          const box = getAccessoryBox(accessory, sprite.imageSrc);
          const outline = preparedAccessoryOutline(accessory.imageSrc);
          if (outline) for (const offset of ACCESSORY_OUTLINE_OFFSETS) {
            context.drawImage(outline, (box.x - .5 + offset.x) * size, (box.y - .5 + offset.y) * size, box.width * size, box.height * size);
          }
          if (accessoryImage) context.drawImage(accessoryImage, (box.x - .5) * size, (box.y - .5) * size, box.width * size, box.height * size);
        }
        context.restore();
      }
      if (cursor.current) {
        context.strokeStyle = "#ffce53";
        context.lineWidth = 3;
        context.beginPath();
        context.arc(cursor.current.x, cursor.current.y, 21, 0, Math.PI * 2);
        context.stroke();
      }
      frame = requestAnimationFrame(render);
    };
    render();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [atTime, startsAt, serverNow]);

  const tap = (x: number, y: number) => {
    if (!enabled) return;
    const hit = pickCharacterAt(x, y, painted.current);
    if (hit) onTap(hit.id);
  };
  const pointer = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    cursor.current = null;
    const rect = event.currentTarget.getBoundingClientRect();
    tap((event.clientX - rect.left) * BOARD.w / rect.width, (event.clientY - rect.top) * BOARD.h / rect.height);
  };

  return <canvas ref={canvas} className="mp-board" tabIndex={enabled ? 0 : -1}
    role="application" aria-label={`Trouve ${spec.wanted.label}. Au clavier, déplace le cercle avec les flèches, puis appuie sur Entrée.`}
    onPointerDown={pointer} onContextMenu={event => event.preventDefault()}
    onBlur={() => { cursor.current = null; }}
    onKeyDown={event => {
      if (!enabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) return;
      event.preventDefault();
      const position = cursor.current ?? { x: BOARD.w / 2, y: BOARD.h / 2 };
      const step = event.shiftKey ? 5 : 20;
      cursor.current = {
        x: Math.max(0, Math.min(BOARD.w, position.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0))),
        y: Math.max(0, Math.min(BOARD.h, position.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0))),
      };
      if (event.key === "Enter" || event.key === " ") tap(position.x, position.y);
    }} />;
}
