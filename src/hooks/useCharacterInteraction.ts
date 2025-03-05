import { FederatedPointerEvent } from "@pixi/events";
import { useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../store/store";
import { pointColorsArray, randomIntFromInterval } from "../helpers/gameUtils";
import { showPointsEffect } from "../helpers/animationUtils";
import { playPopSound } from "../helpers/sounds";

type CellPosition = {
  rowIndex: number;
  colIndex: number;
  offsetX: number;
  offsetY: number;
};

type PlacedCharacter = {
  id: number;
  name: string;
  imageSrc: string;
  position: CellPosition;
  isWanted: boolean;
  zIndex: number;
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
    wantedCharacter,
    gameState,
    setScore,
    setTimeLeft,
    setPauseTimer,
    setLevel,
    setSoundSrc,
  } = useGameStore(
    useShallow((state) => ({
      wantedCharacter: state.wantedCharacter,
      gameState: state.gameState,
      setScore: state.setScore,
      setTimeLeft: state.setTimeLeft,
      setPauseTimer: state.setPauseTimer,
      setLevel: state.setLevel,
      setSoundSrc: state.setSoundSrc,
    }))
  );

  const handleCharacterClick = (
    e: FederatedPointerEvent,
    character: PlacedCharacter
  ) => {
    if (
      gameState === GameStateEnum.END ||
      gameState === GameStateEnum.FINISH ||
      gameState === GameStateEnum.PAUSED ||
      !wantedCharacter ||
      disableClick
    ) {
      return;
    }

    setDisableClick(true);
    setSelectedCharacterId(character.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sprite = e.target as any;
    const bounds = sprite.getBounds();
    const position = { x: bounds.x, y: bounds.y - 10 };

    if (canvasRef.current) {
      if (character.isWanted) {
        setSoundSrc(playPopSound);
        setIsCorrectSelection(true);

        const randomColor =
          pointColorsArray[
            randomIntFromInterval(0, pointColorsArray.length - 1)
          ];

        showPointsEffect(canvasRef.current, position, true, randomColor);

        setScore(+1);
        setTimeLeft(+4);
        setPauseTimer(true);

        setTimeout(() => {
          setLevel(+1);
          setPauseTimer(false);
          setIsCorrectSelection(false);
        }, 1000);
      } else {
        setSoundSrc(playPopSound);
        setIsCorrectSelection(false);

        showPointsEffect(canvasRef.current, position, false, "red");

        setTimeLeft(-5);

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
