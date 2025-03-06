import GameHeader from "../../components/Game/Header/GameHeader.tsx";
import "./Game.css";
import GameGrid from "../../components/Game/Grid/Grid.tsx";
import { useGameStore } from "../../../store/store.tsx";
import { useShallow } from "zustand/shallow";
import GridAnimated from "../../components/Game/Grid/GridAnimated.tsx";
import GridAnimated2 from "../../components/Game/Grid/GridAnimated2.tsx";
import GridAnimated3 from "../../components/Game/Grid/GridAnimated3.tsx";
import InGameActionButton from "../../components/Game/InGameActionButton/inGameActionButton.tsx";
import { getLevelConfig, GridType } from "../../helpers/gameUtils.ts";

const Game = () => {
  const { level } = useGameStore(
    useShallow((state) => ({
      level: state.level,
    }))
  );

  // Get the level configuration which includes all necessary parameters
  const levelConfig = getLevelConfig(level);

  // Render the appropriate grid based on the grid type defined in the level config
  const renderGrid = () => {
    switch (levelConfig.gridType) {
      case GridType.BASIC:
        return <GameGrid />;
        
      case GridType.ANIMATED_SCROLL:
        return (
          <GridAnimated 
            difficulty={levelConfig.difficulty}
            scrollDirection={levelConfig.additionalParams?.scrollDirection || "horizontal"}
            minSpeed={(levelConfig.speed || 0.5) * 0.7}
            maxSpeed={levelConfig.speed || 0.8}
            alternateDirection={levelConfig.additionalParams?.alternateDirection || false}
            sameDirection={levelConfig.additionalParams?.sameDirection || false}
            addLine={Math.min(3, Math.floor(level / 4))}
          />
        );
        
      case GridType.ANIMATED_COMPLEX:
        return (
          <GridAnimated2 
            difficulty={levelConfig.difficulty}
            characterCount={levelConfig.characterCount || 100}
            useBackgroundGrid={levelConfig.additionalParams?.useBackgroundGrid || false}
            backgroundGridJitter={levelConfig.additionalParams?.backgroundGridJitter || 2}
          />
        );
        
      case GridType.ANIMATED_MOVING:
        return (
          <GridAnimated3 
            difficulty={levelConfig.difficulty}
            characterCount={
              levelConfig.additionalParams?.edgeBehavior === "bounce" 
                ? Math.min(50, levelConfig.characterCount || 40) 
                : levelConfig.characterCount || 50
            }
            wantedCharacterSpeed={levelConfig.additionalParams?.wantedCharacterSpeed || 0.25}
            otherCharactersSpeed={levelConfig.additionalParams?.otherCharactersSpeed || 0.3}
            differentLayersDirection={levelConfig.additionalParams?.differentLayersDirection || false}
            edgeBehavior={levelConfig.additionalParams?.edgeBehavior || "bounce"}
            moveBackgroundCharacters={true}
            useBackgroundGrid={false}
            wantedZIndexBelow={levelConfig.additionalParams?.wantedZIndexBelow || false}
            ensureWantedCharacter={true}
            forceRestartOnMissingWanted={true}
          />
        );
        
      default:
        // Fallback to basic grid
        return <GameGrid />;
    }
  };

  return (
    <div className="gameContainer">
      <GameHeader />
      {renderGrid()}
      <InGameActionButton />
    </div>
  );
};

export default Game;