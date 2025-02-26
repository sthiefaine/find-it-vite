import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import GameHeader from "../../components/Game/Header/GameHeader.tsx";
import "./Game.css";
import {
  generateLevelGrid,
  GridCell,
  LevelConfig,
} from "../../helpers/gameUtils.ts";
import { level1Config } from "../../components/Game/Levels/Level1.tsx";
import {
  CharacterDetails,
  charactersDetails,
} from "../../helpers/characters.ts";
import GameGrid from "../../components/Game/Grid/Grid.tsx";

const levels: LevelConfig[] = [level1Config];
const WANTED_DELAY = 2000; // 2 secondes
const SUCCESS_DELAY = 1000; // 1 seconde

const Game = () => {
  const [wantedCharacter, setWantedCharacter] =
    useState<CharacterDetails | null>(null);
  const [previousWanted, setPreviousWanted] = useState<CharacterDetails | null>(
    null
  );
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [timer, setTimer] = useState<number>(120); // Timer initial
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [level, setLevel] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [showWanted, setShowWanted] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    resetGame();
  }, [level]);

  useEffect(() => {
    if (!showWanted) {
      const delayTimeout = setTimeout(() => {
        setShowWanted(true);
      }, WANTED_DELAY);
      return () => clearTimeout(delayTimeout);
    } else if (timer <= 0) {
      setGameOver(true);
    } else {
      const interval = setInterval(
        () => setTimer((prev) => (prev > 0 ? prev - 1 : 0)),
        1000
      );
      return () => clearInterval(interval);
    }
  }, [showWanted, timer]);

  const resetGame = () => {
    const currentLevel = levels[level - 1];
    const newWanted =
      charactersDetails[
        Math.floor(Math.random() * currentLevel.characters.length)
      ];
    setWantedCharacter(newWanted);
    setPreviousWanted(newWanted);
    setGrid(
      generateLevelGrid(
        currentLevel.layout,
        currentLevel.characters,
        newWanted,
        level
      )
    );
    setGameOver(false);
    setShowWanted(false);
  };

  const handleSelect = (cell: GridCell) => {
    if (gameOver || !wantedCharacter || !cell || !showWanted) return;

    if (cell.name === wantedCharacter.name) {
      setScore((prev) => prev + 1);
      setTimeout(() => {
        if (level < levels.length) {
          setLevel((prev) => prev + 1);
        } else {
          setTimer((prev) => prev + 5);
          resetGame();
        }
      }, SUCCESS_DELAY);
    } else {
      setTimer((prev) => Math.max(prev - 2, 0));
    }
  };

  const handleReset = () => {
    setLevel(1);
    setScore(0);
    setTimer(120);
    resetGame();
  };

  return (
    <div className="gameContainer">
      <GameHeader
        level={level}
        wantedCharacter={wantedCharacter}
        timer={timer}
        score={score}
        showWanted={showWanted}
      />
      <GameGrid
        level={level}
        grid={grid}
        wantedCharacter={wantedCharacter}
        onSelect={handleSelect}
        gameOver={gameOver}
        isLoading={!showWanted}
      />
      <div style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        gap: 20,
      }}>
        {gameOver && (
          <button className="resetButton" onClick={handleReset}>
            Rejouer
          </button>
        )}
        <button className="backButton" onClick={() => navigate("/")}>
          Retour à l'accueil
        </button>{" "}
      </div>
    </div>
  );
};

export default Game;
