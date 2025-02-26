import { useEffect, useRef } from "react";
import { CharacterDetails } from "../../helpers/characters";
import "./WantedCharacter.css"

type WantedCharacterProps = {
  wantedCharacter: CharacterDetails | null;
  showWanted: boolean;
};

export const WantedCharacter = ({ wantedCharacter, showWanted }: WantedCharacterProps) => {
  const canvasRef = useRef(null)
  useEffect(() => {
    if(!wantedCharacter) return
    const canvas = canvasRef.current as any
    const context = canvas.getContext('2d')
    const image = new Image();
    image.src = wantedCharacter?.imageSrc;
    image.onload = function() {
       context.drawImage(image,0,0);
    };
  }, [wantedCharacter])


  return (
    <div className="poster">
      <div className="imageSquare">
        {showWanted && wantedCharacter && (
          <canvas id={wantedCharacter.name} ref={canvasRef} className="canvas">
          </canvas>
        )}
      </div>
      <p className="wantedName">
        {showWanted && wantedCharacter ? wantedCharacter.name : "???"}
      </p>
    </div>
  );
};

export default WantedCharacter;