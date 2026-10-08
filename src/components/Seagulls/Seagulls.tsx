import { useTranslation } from "../../i18n";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { GameStateEnum, useGameStore } from "../../../store/store";
import { BOARD } from "../../engine/types";
import { birdPose, SeagullDirector } from "../../game/seagulls";
import type { FlightKind } from "../../game/seagulls";
import { isPageVisible, subscribeAppActive } from "../../platform/appLifecycle";
import { preparedImage } from "../../game/assetReadiness";
import { obstacleTheme } from "../../game/obstacleTheme";
import "./Seagulls.css";

const PREVIEWS: [FlightKind, string][] = [["solo", "1 goéland"], ["small", "2–3"], ["flock", "7–8"], ["giant", "Géant"]];
const CROWD_PREVIEWS: [FlightKind, string][] = [["solo", "1"], ["small", "2–5"], ["flock", "6–14"], ["horde", "15–20"], ["surge", "21–36"]];

export default function Seagulls({ boardRef }: { boardRef: RefObject<HTMLDivElement> }) {
  const { t: tr } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const directorRef = useRef<SeagullDirector | null>(null);
  const seed = useGameStore(s => s.runSeed);
  const tier = useGameStore(s => s.tier);
  const political = useGameStore(s => s.currentSpec?.wanted.serie === "politics");
  const obstacles = obstacleTheme(political);
  const blocked = useGameStore(s => s.obstacleBlocking);
  const over = useGameStore(s => s.gameState === GameStateEnum.END || s.gameState === GameStateEnum.FINISH);
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("birds") === "1";

  useEffect(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;
    // Capture au-dessus du plateau : les oiseaux sont toujours testés avant
    // les feuillages, indépendamment de l'ordre de remontage des effets React.
    const inputRoot = board.parentElement ?? board;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const mask = document.createElement("canvas");
    mask.width = 30;
    mask.height = 40;
    const maskContext = mask.getContext("2d", { willReadFrequently: true });
    if (!maskContext) return;
    const pixelScale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(BOARD.w * pixelScale);
    canvas.height = Math.round(BOARD.h * pixelScale);
    context.scale(pixelScale, pixelScale);
    let director = new SeagullDirector(seed, tier, political);
    directorRef.current = director;
    let visible = isPageVisible();
    const unsubscribeVisibility = subscribeAppActive(active => { visible = active; });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motion.matches;
    const onMotion = () => { reducedMotion = motion.matches; };
    motion.addEventListener("change", onMotion);

    const setBlocked = (value: boolean) => {
      const state = useGameStore.getState();
      if (state.obstacleBlocking !== value) state.setObstacleBlocking(value);
    };
    const clear = () => {
      context.clearRect(0, 0, BOARD.w, BOARD.h);
      canvas.dataset.flight = "none";
      canvas.dataset.flightPhase = "none";
      setBlocked(false);
    };
    // Une nouvelle partie quotidienne peut réutiliser exactement la même graine.
    const unsubscribeRun = useGameStore.subscribe((state, previous) => {
      if (state.currentSpec === null && previous.currentSpec !== null) {
        director = new SeagullDirector(seed, tier, political);
        directorRef.current = director;
        clear();
      }
    });

    // Test de l'alpha réellement affiché : les coins transparents restent jouables.
    // Capture avant Pixi, sans faire traverser les touchers vers les animaux cachés.
    const intercept = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".seagulls-preview")) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / rect.width * canvas.width);
      const y = Math.floor((event.clientY - rect.top) / rect.height * canvas.height);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
      if (useGameStore.getState().obstacleBlocking || context.getImageData(x, y, 1, 1).data[3] > 32) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    inputRoot.addEventListener("pointerdown", intercept, { capture: true });
    let last = performance.now();
    let frameId: number;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const state = useGameStore.getState();
      const ended = state.gameState !== GameStateEnum.PLAYING && state.gameState !== GameStateEnum.PAUSED;
      const transitioning = state.animationLevelLoading || state.wantedFound || !state.currentSpec;
      const eligible = !!state.currentSpec && state.currentSpec.rule === "classic" &&
        !state.currentSpec.modifiers.includes("flashlight") &&
        (preview || (state.currentSpec.scene?.seagulls ?? state.currentSpec.index >= 4));
      if (ended || transitioning || reducedMotion || !eligible) {
        director.cancel();
        clear();
      } else {
        const images = obstacles.passers.map(preparedImage);
        const active = visible && images.every(Boolean) && state.gameState === GameStateEnum.PLAYING && !state.pauseTimer && !state.worldBanner;
        const frame = director.advance(dt, active, eligible, state.currentSpec?.index);
        context.clearRect(0, 0, BOARD.w, BOARD.h);
        canvas.dataset.flight = frame?.flight.kind ?? "none";
        canvas.dataset.count = String(frame?.flight.birds.length ?? 0);
        if (import.meta.env.DEV) {
          const progress = frame ? frame.ageMs / frame.flight.durationMs : 0;
          canvas.dataset.flightPhase = !frame ? "none" : progress < 0.4 ? "enter" : progress < 0.6 ? "middle" : "leave";
        }
        if (frame) {
          for (const bird of frame.flight.birds) {
            const img = images[bird.sprite ?? 0];
            if (!img) continue;
            const pose = birdPose(bird, frame.flight, frame.ageMs);
            if (!pose) continue;
            const height = bird.width * img.naturalHeight / img.naturalWidth;
            context.save();
            context.translate(pose.x, pose.y);
            const direction = bird.direction ?? frame.flight.direction;
            context.rotate(pose.bank * direction);
            context.scale(direction, 1);
            context.drawImage(img, -bird.width * 0.51, -height * 0.6, bird.width, height);
            context.restore();
          }
        }
        let obscured = false;
        if (frame?.flight.kind === "giant") {
          maskContext.clearRect(0, 0, mask.width, mask.height);
          maskContext.drawImage(canvas, 0, 0, mask.width, mask.height);
          const alpha = maskContext.getImageData(0, 0, mask.width, mask.height).data;
          let covered = 0;
          for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 200) covered++;
          obscured = covered / (mask.width * mask.height) >= 0.55;
        }
        setBlocked(obscured);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      unsubscribeVisibility();
      unsubscribeRun();
      motion.removeEventListener("change", onMotion);
      inputRoot.removeEventListener("pointerdown", intercept, true);
      directorRef.current = null;
      setBlocked(false);
    };
  }, [seed, tier, boardRef, preview, political, obstacles]);

  return <>
    <canvas ref={canvasRef} className="seagulls-layer" aria-hidden="true" />
    <div className="seagulls-notice" role="status" aria-live="polite">
      {blocked && <span>{tr("Un géant de passage !")}</span>}
    </div>
    {preview && !over && <div className="seagulls-preview" aria-label={tr(political ? "Aperçu des foules" : "Aperçu des goélands")}>
      {(political ? CROWD_PREVIEWS.map(([kind, label]) => [kind, kind === "surge" && tier !== "expert" ? "21–30" : label] as const) : PREVIEWS)
        .map(([kind, label]) => <button key={kind} type="button" onClick={() => directorRef.current?.preview(kind)}>{tr(label)}</button>)}
    </div>}
  </>;
}
