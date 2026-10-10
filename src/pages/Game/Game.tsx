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
import { getBoard } from "../../helpers/board.ts";
import type { LevelSpec } from "../../engine/types.ts";
import Flashlight from "../../components/Flashlight/Flashlight.tsx";
import { stepInfo } from "../../game/adventureRun.ts";
import StepToast from "../../components/StepToast/StepToast.tsx";
import Seagulls from "../../components/Seagulls/Seagulls.tsx";
import Foliage from "../../components/Foliage/Foliage.tsx";
import { PortraitReveal } from "../../components/PortraitReveal/PortraitReveal";
import { CaptureCelebration } from "../../components/Game/CaptureCelebration/CaptureCelebration";

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
  const { spec, gameState, tier, wantedFound, loading, pauseTimer, mode, adventureStep } =
    useGameStore(
      useShallow((state) => ({
        spec: state.currentSpec,
        gameState: state.gameState,
        tier: state.tier,
        wantedFound: state.wantedFound,
        loading: state.animationLevelLoading,
        pauseTimer: state.pauseTimer,
        mode: state.mode,
        adventureStep: state.adventureStep,
      }))
    );
  const board = useMemo(() => getBoard(), []);
  const unlock = useGameStore(state => state.unlockQueue[0]);
  const dismissUnlock = useGameStore(state => state.dismissUnlock);
  const boardRef = useRef<HTMLDivElement>(null);
  const isOver =
    gameState === GameStateEnum.FINISH || gameState === GameStateEnum.END;
  const hasFlashlight = !!spec?.modifiers.includes("flashlight");
  // Aventure : la page prend le décor du monde (ou du Grand Mélange)
  const chapterId = useGameStore(state => state.chapterId);
  const world = mode === "adventure" && !chapterId ? stepInfo(adventureStep) : undefined;
  const scene = spec?.scene;

  return (
    <div
      className={`gameContainer${world ? " gameContainer--world" : ""}${scene ? " gameContainer--scene" : ""}`}
      style={
        {
          "--board-w": `${board.width}px`,
          "--board-h": `${board.height}px`,
          ...(world && { background: world.background, "--world-accent": world.accent }),
          ...(scene && { background: scene.background, "--world-accent": scene.accent }),
        } as CSSProperties
      }
    >
      <GameHeader />
      <div
        ref={boardRef}
        className={`boardWrap${hasFlashlight ? " boardWrap--flashlight" : ""}`}
      >
        {spec ? renderGrid(spec) : <div className="gridContainer" />}
        {!isOver && <CaptureCelebration />}
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
        <Seagulls boardRef={boardRef} />
        {spec?.scene?.foliage && <Foliage key={`foliage-${spec.seed}`} boardRef={boardRef} spec={spec} />}
        {mode === "adventure" && !isOver && <StepToast />}
      </div>
      <div className="gameActions">
        <InGameActionButton />
      </div>
      <AnimatePresence>
        {isOver && <Results key="results" />}
      </AnimatePresence>
      {unlock && <PortraitReveal key={unlock.name} character={unlock} onContinue={dismissUnlock} />}
    </div>
  );
};

export default Game;
