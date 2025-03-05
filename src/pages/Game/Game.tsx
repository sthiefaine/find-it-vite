import GameHeader from "../../components/Game/Header/GameHeader.tsx";
import "./Game.css";
import GameGrid from "../../components/Game/Grid/Grid.tsx";
import { useGameStore } from "../../../store/store.tsx";
import { useShallow } from "zustand/shallow";
import GridAnimated from "../../components/Game/Grid/GridAnimated.tsx";
import GridAnimated2 from "../../components/Game/Grid/GridAnimated2.tsx";
import GridAnimated3 from "../../components/Game/Grid/GridAnimated3.tsx";
import InGameActionButton from "../../components/Game/InGameActionButton/inGameActionButton.tsx";

const Game = () => {
  const { level } = useGameStore(
    useShallow((state) => ({
      level: state.level,
    }))
  );

  return (
    <div className="gameContainer">
      <GameHeader />
      {level && <GameGrid />}
      {!level && <GridAnimated />}
      {!level && <GridAnimated2 />}
      {!level && <GridAnimated3 />}

      <InGameActionButton />
    </div>
  );
};

export default Game;
