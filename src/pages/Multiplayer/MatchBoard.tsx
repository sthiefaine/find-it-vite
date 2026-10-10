import { useTranslation } from "../../i18n";
import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import { BOARD, type LevelSpec } from "../../engine/types";
import { ACCESSORY_OUTLINE_OFFSETS, getAccessory, getAccessoryBox } from "../../content/accessories";
import { preparedAccessoryOutline, preparedImage } from "../../game/assetReadiness";
import { pickCharacterAt } from "../../helpers/hitTest";
import { getPortraitScale } from "../../helpers/portraitScale";
import { createMatchBoard, type MatchSprite } from "./boardModel";
import type { MatchTap, TapPoint } from "../../multiplayer/protocol";
import { createMatchDistractions, distractionAt, type Distraction } from "../../multiplayer/distractions";

type Props = {
  spec: LevelSpec;
  startsAt: number;
  serverNow: () => number;
  enabled: boolean;
  onTap: (id: number | null, point: TapPoint) => void;
  playerId: string;
  opponentName: string;
  levelNonce: string;
  taps: MatchTap[];
  revealElapsedMs?: number;
};

export function MatchBoard({ spec, startsAt, serverNow, enabled, onTap, playerId, opponentName, levelNonce, taps, revealElapsedMs }: Props) {
  const { t: tr } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const painted = useRef<MatchSprite[]>([]);
  const atTime = useMemo(() => createMatchBoard(spec), [spec]);
  const distractions = useMemo(() => createMatchDistractions(spec), [spec]);
  const obstacles = useRef<Distraction[]>([]);
  const overlay = useRef({ taps, playerId, opponentName, levelNonce, revealElapsedMs });
  overlay.current = { taps, playerId, opponentName, levelNonce, revealElapsedMs };
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
    const drawSprite = (sprite: MatchSprite) => {
        const image = preparedImage(sprite.imageSrc);
        if (!image) return;
        const size = sprite.size * sprite.look.scale * getPortraitScale(sprite.imageSrc);
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
    };
    const render = () => {
      const now = serverNow();
      const current = overlay.current;
      const revealing = current.revealElapsedMs !== undefined;
      const elapsed = revealing ? current.revealElapsedMs! / 1_000 : Math.max(0, (now - startsAt) / 1_000);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, BOARD.w, BOARD.h);
      const sprites = atTime(elapsed);
      painted.current = sprites;
      sprites.forEach(drawSprite);
      obstacles.current = revealing ? [] : distractions(elapsed);
      for (const item of obstacles.current) {
        context.save();
        context.globalAlpha = item.opacity;
        context.translate(item.x, item.y);
        context.rotate(item.rotation);
        const image = item.imageSrc ? preparedImage(item.imageSrc) : null;
        if (image) context.drawImage(image, -item.width / 2, -item.width * image.naturalHeight / image.naturalWidth / 2,
          item.width, item.width * image.naturalHeight / image.naturalWidth);
        else if (item.kind === "mist") {
          context.fillStyle = "#f3eaf9";
          for (const [x, y, radius] of [[-.25, .02, .22], [-.06, -.08, .27], [.20, .01, .22], [.02, .13, .23]]) {
            context.beginPath(); context.arc(x * item.width, y * item.width, radius * item.width, 0, Math.PI * 2); context.fill();
          }
        }
        context.restore();
      }
      if (revealing) {
        context.fillStyle = "#160c3299";
        context.fillRect(0, 0, BOARD.w, BOARD.h);
        for (const target of sprites.filter(sprite => sprite.isWanted)) {
          drawSprite(target);
          const radius = target.size * target.look.scale * getPortraitScale(target.imageSrc) / 2 + 9;
          context.save();
          context.strokeStyle = "#ffe478"; context.lineWidth = 4;
          context.shadowColor = "#ffe478"; context.shadowBlur = 12;
          context.beginPath(); context.arc(target.cx, target.cy, radius, 0, Math.PI * 2); context.stroke();
          context.restore();
        }
      }
      for (const marker of current.taps) {
        const age = now - marker.at;
        if (marker.levelNonce !== current.levelNonce || age < 0 || age > 1_000) continue;
        const own = marker.playerId === current.playerId;
        context.save();
        context.globalAlpha = Math.min(1, (1_000 - age) / 350);
        context.strokeStyle = marker.result === "wrong" ? "#ff7a99" : own ? "#ffe075" : "#57e9f6";
        context.lineWidth = 3;
        context.beginPath(); context.arc(marker.x, marker.y, 15 + age / 100, 0, Math.PI * 2); context.stroke();
        if (marker.result === "wrong") {
          context.beginPath(); context.moveTo(marker.x - 6, marker.y - 6); context.lineTo(marker.x + 6, marker.y + 6);
          context.moveTo(marker.x + 6, marker.y - 6); context.lineTo(marker.x - 6, marker.y + 6); context.stroke();
        }
        context.font = "bold 12px sans-serif"; context.textAlign = "center";
        const name = own ? tr("toi") : current.opponentName;
        const width = context.measureText(name).width + 14;
        const x = Math.max(width / 2 + 3, Math.min(BOARD.w - width / 2 - 3, marker.x));
        const y = Math.max(20, marker.y - 32);
        context.fillStyle = "#241340e8"; context.fillRect(x - width / 2, y - 12, width, 18);
        context.fillStyle = own ? "#ffe075" : "#57e9f6"; context.fillText(name, x, y + 1);
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
  }, [atTime, distractions, startsAt, serverNow, tr]);

  const tap = (x: number, y: number) => {
    if (!enabled) return;
    const point = { x, y };
    if (distractionAt(point, obstacles.current)) { onTap(null, point); return; }
    const hit = pickCharacterAt(x, y, painted.current);
    onTap(hit?.id ?? null, point);
  };
  const pointer = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    cursor.current = null;
    const rect = event.currentTarget.getBoundingClientRect();
    tap((event.clientX - rect.left) * BOARD.w / rect.width, (event.clientY - rect.top) * BOARD.h / rect.height);
  };

  return <canvas ref={canvas} className="mp-board" tabIndex={enabled ? 0 : -1}
    role="application" aria-label={revealElapsedMs !== undefined ? tr("La cible {{name}} est entourée sur le plateau.", { name: tr(spec.wanted.label) })
      : tr("Trouve {{name}}. Au clavier, déplace le cercle avec les flèches, puis appuie sur Entrée.", { name: tr(spec.wanted.label) })}
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
