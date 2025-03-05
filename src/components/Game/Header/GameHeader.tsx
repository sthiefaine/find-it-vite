import { useEffect, useRef, useState } from "react";
import "@pixi/events";
import "./GameHeader.css";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import { useShallow } from "zustand/shallow";
import { Timer } from "./Timer/Timer";
import ScoreDisplay from "./ScoreDisplay/ScoreDisplay";
import { Sprite, Stage } from "@pixi/react";
import { Countdown } from "../../Countdown/Countdown";

export const GameHeader = () => {
  const { animationLevelLoading, wantedCharacter, score, gameState } = useGameStore(
    useShallow((state) => {
      return {
        wantedCharacter: state.wantedCharacter,
        animationLevelLoading: state.animationLevelLoading,
        score: state.score,
        gameState: state.gameState
      };
    })
  );

  const [isAnimating, setIsAnimating] = useState(false);
  const [spriteAlpha, setSpriteAlpha] = useState(0);
  const [flashEffect, setFlashEffect] = useState(false);

  const spriteRef = useRef(null);
  const PixiRef = useRef<Stage | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (wantedCharacter && !animationLevelLoading) {
      setFlashEffect(true);
      setSpriteAlpha(0);
      setIsAnimating(true);

      setTimeout(() => setFlashEffect(false), 800);

      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }

      const startTime = performance.now();
      const duration = 1000;

      const animate = (currentTime: number) => {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);

        setSpriteAlpha(Math.min(progress * 2, 1));

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          animationFrameId.current = null;
        }
      };

      animationFrameId.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [wantedCharacter, animationLevelLoading]);

  return (
    <div className="header-container">
      <div className="header-content">
        <Timer />

        <div className={`wanted-poster ${flashEffect ? "flash-effect" : ""}`}>
          <div className="wanted-image-container">
          {(animationLevelLoading && gameState === GameStateEnum.PLAYING && score === 0) && <Countdown />}
            <Stage
              ref={PixiRef}
              width={60}
              height={60}
              options={{
                backgroundAlpha: 0,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
              }}
            >

              {!animationLevelLoading && wantedCharacter && (
                <Sprite
                  ref={spriteRef}
                  image={wantedCharacter.imageSrc}
                  width={60}
                  height={60}
                  alpha={spriteAlpha}
                  eventMode="static"
                />
              )}
            </Stage>
            <div className="wanted-stamp">⚠️</div>
            {isAnimating && <div className="character-glow"></div>}
          </div>
          <div className="wanted-name-container">
            <p className={`wanted-name ${isAnimating ? "name-appear" : ""}`}>
              {!animationLevelLoading && wantedCharacter
                ? wantedCharacter.name
                : "???"}
            </p>
          </div>
        </div>

        <ScoreDisplay score={score} />
      </div>
    </div>
  );
};

export default GameHeader;
