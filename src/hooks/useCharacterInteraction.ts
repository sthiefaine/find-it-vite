import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../store/store";
import { pointColorsArray, randomIntFromInterval } from "../helpers/gameUtils";
import { showPointsEffect } from "../helpers/animationUtils";
import { playHitGoldenSound, playPopSound } from "../helpers/sounds";
import { resolveTap, sameLevel } from "../game/session";
import * as haptics from "../platform/haptics";

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
  // Délai d'1 s après une bonne réponse, avant le niveau suivant
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    spec,
    gameState,
    setScore,
    setTimeLeft,
    setPauseTimer,
    advanceLevel,
    setSoundSrc,
    recordTargetFound,
    recordMiss,
    endBonus,
  } = useGameStore(
    useShallow((state) => ({
      spec: state.currentSpec,
      gameState: state.gameState,
      setScore: state.setScore,
      setTimeLeft: state.setTimeLeft,
      setPauseTimer: state.setPauseTimer,
      advanceLevel: state.advanceLevel,
      setSoundSrc: state.setSoundSrc,
      recordTargetFound: state.recordTargetFound,
      recordMiss: state.recordMiss,
      endBonus: state.endBonus,
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

    // État lu à l'instant du toucher : deux touchers rapprochés ne comptent qu'une fois
    const { foundIds, isDiscovery, bonusDone } = useGameStore.getState();
    if (bonusDone) return;
    const result = resolveTap(spec, foundIds, character, { isDiscovery });
    if (result.kind === "ignored") return;

    const position = { x: point.x - 10, y: point.y - 30 };
    // Le canvas ne sert qu'à l'effet visuel : le jeu continue sans lui
    const canvas = canvasRef.current;

    if (result.kind === "target") {
      setSoundSrc(result.golden ? playHitGoldenSound : playPopSound);
      const color = result.golden
        ? "#ffd54a"
        : pointColorsArray[randomIntFromInterval(0, pointColorsArray.length - 1)];
      if (canvas) showPointsEffect(canvas, position, true, color);

      if (result.levelDone) haptics.success();
      else haptics.tapLight();
      recordTargetFound(character.id, result.levelDone);
      setScore(+result.points);
      if (!result.levelDone) return; // cible suivante : on continue tout de suite

      if (result.golden) {
        endBonus(); // tout trouvé avant la fin du bonus
        return;
      }

      setDisableClick(true);
      setSelectedCharacterId(character.id);
      setIsCorrectSelection(true);
      if (result.timeDelta) setTimeLeft(result.timeDelta); // plafonné par le store
      setPauseTimer(true);

      // on n'avance que si la partie n'a pas changé entre-temps (Rejouer, autre niveau…)
      const { runSeed, level, currentSpec } = useGameStore.getState();
      const startedFor = { runSeed, level };
      clearAdvanceTimeout();
      advanceTimeoutRef.current = setTimeout(() => {
        advanceTimeoutRef.current = null;
        setIsCorrectSelection(false);
        const now = useGameStore.getState();
        // même graine et même étape, mais aussi même niveau généré (Rejouer une mission
        // garde la graine) et partie toujours en cours
        if (
          !sameLevel(startedFor, now) ||
          now.currentSpec !== currentSpec ||
          now.gameState !== GameStateEnum.PLAYING
        )
          return;
        advanceLevel();
        setPauseTimer(false);
      }, 1000);
      return;
    }

    setSoundSrc(playPopSound);
    haptics.error();
    setIsCorrectSelection(false);
    // pendant un bonus, une erreur ne montre aucun « -1 »
    if (canvas && result.countsAsMiss) showPointsEffect(canvas, position, false, "red");
    if (result.countsAsMiss) recordMiss();
    if (result.timeDelta) setTimeLeft(result.timeDelta);
    if (!result.blink) return;

    setDisableClick(true);
    setSelectedCharacterId(character.id);
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
  };

  function clearAdvanceTimeout() {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  }

  // Rejouer (RESET) : le délai en cours ne doit pas faire avancer la nouvelle partie
  useEffect(
    () =>
      useGameStore.subscribe((state) => {
        if (state.gameState === GameStateEnum.RESET) clearAdvanceTimeout();
      }),
    []
  );

  // Démontage : plus de délai ni de clignotement en attente
  useEffect(
    () => () => {
      clearAdvanceTimeout();
      if (blinkIntervalRef.current) clearInterval(blinkIntervalRef.current);
    },
    []
  );

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
