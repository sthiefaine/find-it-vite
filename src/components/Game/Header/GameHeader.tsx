import { useEffect, useRef } from "react";
import { CharacterDetails } from "../../../helpers/characters";
import "./GameHeader.css";

type GameHeaderProps = {
  level: number;
  wantedCharacter: CharacterDetails | null;
  timer: number;
  score: number;
  showWanted: boolean;
};

export const GameHeader = ({ level, wantedCharacter, timer, score, showWanted }: GameHeaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!wantedCharacter || !showWanted || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = new Image();
    image.src = wantedCharacter.imageSrc;
    image.onload = () => {
      const wrh = (image.width / image.height);
      let newWidth = canvas.width;
      let newHeight = (newWidth / wrh);
      if (newHeight > canvas.height) {
        newHeight = canvas.height - image.height;
        newWidth = canvas.width - image.width;
      }
      var xOffset = newWidth < canvas.width ? ((canvas.width - newWidth) / 2) : 0;
      var yOffset = newHeight < canvas.height ? ((canvas.height - newHeight) / 2) : 0;

      ctx.drawImage(image, xOffset, yOffset, newWidth, newHeight);
    };
  }, [wantedCharacter, showWanted]);

  return (
    <div className="container">
      <h1 className="title">Recherché</h1>
      <div className="poster">
        <div className="imageSquare">
          {showWanted && wantedCharacter && (
            <canvas ref={canvasRef} className="canvas">
            </canvas>
          )}
        </div>
        <p className="wantedName">
          {showWanted && wantedCharacter ? wantedCharacter.name : "???"}
        </p>
      </div>
      <p className="timer">{timer}</p>
      <p className="score">Score: {score}</p>
    </div>
  );
};

export default GameHeader;