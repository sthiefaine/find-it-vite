import { CSSProperties, useMemo, useRef } from "react";
import GameHeader from "../../components/Game/Header/GameHeader.tsx";
import "./Game.css";
import GameGrid from "../../components/Game/Grid/Grid.tsx";
import { GameStateEnum, useGameStore } from "../../../store/store.tsx";
import { AnimatePresence } from "framer-motion";
import Results from "../../components/Results/Results.tsx";
import { useShallow } from "zustand/shallow";
import GridAnimated from "../../components/Game/Grid/GridAnimated.tsx";
import GridAnimated2 from "../../components/Game/Grid/GridAnimated2.tsx";
import GridAnimated3 from "../../components/Game/Grid/GridAnimated3.tsx";
import InGameActionButton from "../../components/Game/InGameActionButton/inGameActionButton.tsx";
import ProfilePicker from "../../components/ProfilePicker/ProfilePicker.tsx";
import { useSaveStore } from "../../save/saveStore.ts";
import { getBoard } from "../../helpers/board.ts";
import type { LevelSpec, Tier } from "../../engine/types.ts";
import Flashlight from "../../components/Flashlight/Flashlight.tsx";

const renderGrid = (spec: LevelSpec) => {
  switch (spec.layout) {
    case "grid":
      return <GameGrid spec={spec} key={spec.seed} />;
    case "scroll":
      return <GridAnimated spec={spec} key={spec.seed} />;
    case "pile":
      return <GridAnimated2 spec={spec} key={spec.seed} />;
    case "swarm":
      return <GridAnimated3 spec={spec} key={spec.seed} />;
  }
};

const Game = () => {
  const { spec, gameState, setGameState, tier, wantedFound, loading, pauseTimer } =
    useGameStore(
      useShallow((state) => ({
        spec: state.currentSpec,
        gameState: state.gameState,
        setGameState: state.setGameState,
        tier: state.tier,
        wantedFound: state.wantedFound,
        loading: state.animationLevelLoading,
        pauseTimer: state.pauseTimer,
      }))
    );
  const board = useMemo(() => getBoard(), []);
  const boardRef = useRef<HTMLDivElement>(null);
  const isOver =
    gameState === GameStateEnum.FINISH || gameState === GameStateEnum.END;
  const hasFlashlight = !!spec?.modifiers.includes("flashlight");

  const handlePickProfile = (tier: Tier) => {
    useSaveStore.getState().setProfileTier(tier);
    setGameState(GameStateEnum.INIT);
  };

  return (
    <div
      className="gameContainer"
      style={
        {
          "--board-w": `${board.width}px`,
          "--board-h": `${board.height}px`,
        } as CSSProperties
      }
    >
      <GameHeader />
      <div
        ref={boardRef}
        className={`boardWrap${hasFlashlight ? " boardWrap--flashlight" : ""}`}
      >
        {spec ? renderGrid(spec) : <div className="gridContainer" />}
        {spec && hasFlashlight && (
          <Flashlight
            key={`flashlight-${spec.seed}`}
            boardRef={boardRef}
            width={board.width}
            height={board.height}
            scale={board.scale}
            tier={tier}
            // Chrono en pause pendant la carte de découverte : la pulsation attend
            active={!loading && !pauseTimer}
            hidden={wantedFound || isOver}
          />
        )}
      </div>
      <div className="gameActions">
        <InGameActionButton />
      </div>
      <AnimatePresence>
        {isOver && <Results key="results" />}
        {gameState === GameStateEnum.CHOOSE_PROFILE && (
          <ProfilePicker key="profile" onPick={handlePickProfile} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Game;
