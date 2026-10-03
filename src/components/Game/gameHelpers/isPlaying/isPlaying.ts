/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from "react";
import {
  gameConstants,
  GameStateEnum,
  useGameStore,
} from "../../../../../store/store";
import { useShallow } from "zustand/shallow";
import { generateGrid, getRandomNumber } from "../../../../helpers/gameUtils";
import { charactersDetails } from "../../../../helpers/characters";
import { useLocation } from "react-router-dom";

export function IsPlaying() {
  const {
    gameState,
    setGameState,
    setTimeLeft,
    setScore,
    setClearGameStore,
    timeLeft,
    setAnimationLevelLoading,
    setTimeLeftValue,
    setWantedCharacter,
    level,
    setGrid,
    animationLevelLoading,
    submitGameResult,
  } = useGameStore(
    useShallow((state) => {
      return {
        gameState: state.gameState,
        setGameState: state.setGameState,
        setTimeLeft: state.setTimeLeft,
        setScore: state.setScore,
        setClearGameStore: state.setClearGameStore,
        timeLeft: state.timeLeft,
        setTimeLeftValue: state.setTimeLeftValue,
        setAnimationLevelLoading: state.setAnimationLevelLoading,
        setWantedCharacter: state.setWantedCharacter,
        level: state.level,
        setGrid: state.setGrid,
        animationLevelLoading: state.animationLevelLoading,
        submitGameResult: state.submitGameResult,
      };
    })
  );
  const location = useLocation();
  const pathName = location.pathname;

  const setupLevel = (isInitialSetup = false) => {
    if (isInitialSetup) {
      setGameState(GameStateEnum.INIT);
      setClearGameStore();
      setTimeLeftValue(gameConstants.MAX_PLAY_TIME);
    }
    const charactersToChooseFrom = charactersDetails;
    const newWanted =
      charactersToChooseFrom[
        getRandomNumber(0, charactersToChooseFrom.length - 1)
      ];
    setWantedCharacter(newWanted);

    const gridSize = Math.min(window.innerWidth, 450);
    const maxCellPerRow = Math.floor((gridSize / 375) * 13);
    const newGrid = generateGrid(45, gridSize, level, maxCellPerRow, newWanted);
    setGrid(newGrid);

    setTimeout(
      () => {
        setAnimationLevelLoading(false);
      },
      isInitialSetup ? 3000 : 1000
    );
  };

  useEffect(() => {
    // pas de nouveau niveau si la partie s'est terminée pendant la transition
    if (useGameStore.getState().gameState === GameStateEnum.PLAYING) {
      setAnimationLevelLoading(true);
      setupLevel();
    }
  }, [level]);

  useEffect(() => {
    console.log("===>", pathName, level, animationLevelLoading);
    if (pathName === "/game") {
      if (
        gameState === GameStateEnum.END ||
        gameState === GameStateEnum.RESET ||
        gameState === GameStateEnum.NONE
      ) {
        setGameState(GameStateEnum.INIT);
      }
      switch (gameState) {
        case GameStateEnum.INIT:
          setScore(0);
          setupLevel(true);
          setAnimationLevelLoading(true);
          setGameState(GameStateEnum.PLAYING);
          break;
        case GameStateEnum.PLAYING: {
          break;
        }
        case GameStateEnum.END:
          setGameState(GameStateEnum.END);
          break;
        case GameStateEnum.RESET: {
          setClearGameStore();
          setGameState(GameStateEnum.INIT);
          break;
        }
        case GameStateEnum.PAUSED: {
          setGameState(GameStateEnum.PAUSED);
          break;
        }
        default:
          break;
      }
    } else {
      console.log("END");
      setClearGameStore();
      setGameState(GameStateEnum.NONE);
    }
  }, [pathName, setGameState, gameState]);

  // Fin de partie (chrono à 0 ou bouton Arrêter) : on enregistre le résultat
  useEffect(() => {
    if (
      pathName === "/game" &&
      (gameState === GameStateEnum.FINISH || gameState === GameStateEnum.END)
    ) {
      submitGameResult();
    }
  }, [gameState, pathName]);

  useEffect(() => {
    if (gameState === GameStateEnum.PLAYING && !animationLevelLoading) {
      if (timeLeft < 0) {
        setTimeLeftValue(0);
      }

      if (timeLeft === 0) {
        setGameState(GameStateEnum.FINISH);
      }

      const interval = setInterval(() => {
        if (timeLeft === 1) {
          setTimeLeftValue(0);
          clearInterval(interval);
          return;
        }
        setTimeLeft(-1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [gameState, timeLeft, setTimeLeft, animationLevelLoading]);

  return null;
}
