import { useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../store/store";
import { pointColorsArray, randomIntFromInterval } from "../helpers/gameUtils";
import { showPointsEffect } from "../helpers/animationUtils";
import { playPopSound } from "../helpers/sounds";

// Perso touché, tel que renvoyé par pickCharacterAt (helpers/hitTest.ts)
export type TappedCharacter = {
  id: number;
  isWanted: boolean;
};

export const useCharacterInteraction = () => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [disableClick, setDisableClick] = useState(false);
  const [blinkState, setBlinkState] = useState<boolean>(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    null
  );
  const [isCorrectSelection, setIsCorrectSelection] = useState(false);
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    spec,
    gameState,
    setScore,
    setTimeLeft,
    setPauseTimer,
    setLevel,
    setSoundSrc,
    recordFound,
    recordMiss,
  } = useGameStore(
    useShallow((state) => ({
      spec: state.currentSpec,
      gameState: state.gameState,
      setScore: state.setScore,
      setTimeLeft: state.setTimeLeft,
      setPauseTimer: state.setPauseTimer,
      setLevel: state.setLevel,
      setSoundSrc: state.setSoundSrc,
      recordFound: state.recordFound,
      recordMiss: state.recordMiss,
    }))
  );

  // point : position du toucher en px dans le canvas
  const handleCharacterClick = (
    point: { x: number; y: number },
    character: TappedCharacter
  ) => {
    if (
      gameState === GameStateEnum.END ||
      gameState === GameStateEnum.FINISH ||
      gameState === GameStateEnum.PAUSED ||
      !spec ||
      disableClick
    ) {
      return;
    }

    setDisableClick(true);
    setSelectedCharacterId(character.id);

    const position = { x: point.x - 10, y: point.y - 30 };

    // Le canvas ne sert qu'à l'effet visuel : le jeu continue sans lui
    const canvas = canvasRef.current;

    if (character.isWanted) {
      setSoundSrc(playPopSound);
      setIsCorrectSelection(true);

      const randomColor =
        pointColorsArray[randomIntFromInterval(0, pointColorsArray.length - 1)];
      if (canvas) showPointsEffect(canvas, position, true, randomColor);

      recordFound();
      setScore(+1);
      setTimeLeft(+spec.rewardS); // plafonné à MAX_PLAY_TIME par le store
      setPauseTimer(true);

      setTimeout(() => {
        setLevel(+1);
        setPauseTimer(false);
        setIsCorrectSelection(false);
      }, 1000);
    } else {
      setSoundSrc(playPopSound);
      setIsCorrectSelection(false);

      if (canvas) showPointsEffect(canvas, position, false, "red");

      recordMiss();
      setTimeLeft(-spec.penaltyS);

      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
      }

      let count = 0;
      blinkIntervalRef.current = setInterval(() => {
        setBlinkState((prev) => !prev);
        count++;

        if (count >= 4) {
          if (blinkIntervalRef.current) {
            clearInterval(blinkIntervalRef.current);
            blinkIntervalRef.current = null;
          }
          setBlinkState(true);
          setDisableClick(false);
          setSelectedCharacterId(null);
        }
      }, 125);
    }
  };

  const cleanupBlinkEffect = () => {
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }
    setBlinkState(true);
    setSelectedCharacterId(null);
    setIsCorrectSelection(false);
  };

  return {
    canvasRef,
    disableClick,
    setDisableClick,
    selectedCharacterId,
    isCorrectSelection,
    setSelectedCharacterId,
    setIsCorrectSelection,
    blinkState,
    cleanupBlinkEffect,
    handleCharacterClick,
  };
};
