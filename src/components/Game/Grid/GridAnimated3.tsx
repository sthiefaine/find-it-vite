import { useEffect, useRef, useState } from "react";
import { Stage, Container, Sprite, Graphics } from "@pixi/react";
import { FederatedPointerEvent } from "@pixi/events";
import { useShallow } from "zustand/shallow";
import { GameStateEnum, useGameStore } from "../../../../store/store";
import {
  CELL_SIZE,
  GridCell,
  randomIntFromInterval,
} from "../../../helpers/gameUtils";
import "./Grid.css";
import { Rectangle } from "pixi.js";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";
import { HitCandidate, pickCharacterAt } from "../../../helpers/hitTest";

type NoOverlapZone = {
  x: number;
  y: number;
  radius: number;
  characterId: number;
  zoneIndex: number;
};

type PlacedCharacter = {
  id: number;
  x: number;
  y: number;
  name: string;
  imageSrc: string;
  noOverlapZones: NoOverlapZone[];
  isWanted: boolean;
  zIndex: number;
  isBackground?: boolean;

  velocityX: number;
  velocityY: number;
};

type EdgeBehavior = "bounce" | "wrap";

interface GridAnimated3Props {
  difficulty?: number;
  characterCount?: number;
  useBackgroundGrid?: boolean;
  backgroundGridJitter?: number;
  moveBackgroundCharacters?: boolean;
  sameDirectionForAll?: boolean;
  differentLayersDirection?: boolean;
  // Vitesses des couches (si differentLayersDirection) ; par défaut otherCharactersSpeed
  lowerLayerSpeed?: number;
  upperLayerSpeed?: number;
  edgeBehavior?: EdgeBehavior;
  // Ignoré : le recherché suit la même loi de mouvement que les leurres
  wantedCharacterSpeed?: number;
  otherCharactersSpeed?: number;
  wantedZIndexBelow?: boolean;
  ensureWantedCharacter?: boolean; // Ensure wanted character is placed
  forceRestartOnMissingWanted?: boolean; // Force restart of animation if wanted character goes missing
}

const GridAnimated3 = ({
  difficulty = 2,
  characterCount = 50,
  useBackgroundGrid = false,
  backgroundGridJitter = 2,
  moveBackgroundCharacters = true,
  sameDirectionForAll = false,
  differentLayersDirection = false,
  lowerLayerSpeed,
  upperLayerSpeed,
  edgeBehavior = "wrap",
  wantedZIndexBelow = false,
  otherCharactersSpeed = 0.4,
  ensureWantedCharacter = true,
  forceRestartOnMissingWanted = true,
}: GridAnimated3Props) => {
  const localCanvasRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const wantedCharacterPlacedRef = useRef<boolean>(false); // Track if wanted character is placed
  const wantedCharacterVisibleRef = useRef<boolean>(true); // Track if wanted character is currently visible

  const [isInitializing, setIsInitializing] = useState(true);
  const [wantedCharacterMissing, setWantedCharacterMissing] = useState(false);
  const checkMissingInterval = useRef<NodeJS.Timeout | null>(null);
  
  const {
    canvasRef,
    disableClick,
    setDisableClick,
    selectedCharacterId,
    blinkState,
    isCorrectSelection,
    handleCharacterClick,
  } = useCharacterInteraction();

  // La boucle d'animation lit ces valeurs via des refs (sinon closure figée)
  const isCorrectSelectionRef = useRef(isCorrectSelection);
  isCorrectSelectionRef.current = isCorrectSelection;

  // Synchronize our local canvas ref with the hook
  useEffect(() => {
    if (localCanvasRef.current) {
      canvasRef.current = localCanvasRef.current;
    }
  }, [localCanvasRef.current]);

  const [placedCharacters, setPlacedCharacters] = useState<PlacedCharacter[]>([]);

  const gridSize = Math.min(window.innerWidth, 450);
  const GRID_SIZE_WIDTH = gridSize;
  const GRID_SIZE_HEIGHT = gridSize;

  const CENTER_X = GRID_SIZE_WIDTH / 2;
  const CENTER_Y = GRID_SIZE_HEIGHT / 2;

  const { grid, wantedCharacter, gameState, animationLevelLoading, debug } =
    useGameStore(
      useShallow((state) => ({
        grid: state.grid,
        wantedCharacter: state.wantedCharacter,
        gameState: state.gameState,
        animationLevelLoading: state.animationLevelLoading,
        debug: state.debug,
      }))
    );

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const placedCharactersRef = useRef<PlacedCharacter[]>([]);
  placedCharactersRef.current = placedCharacters;

  const isPositionInZone = (
    position: { x: number; y: number },
    zone: NoOverlapZone
  ): boolean => {
    const distance = Math.sqrt(
      Math.pow(position.x - zone.x, 2) + Math.pow(position.y - zone.y, 2)
    );

    return distance < zone.radius + CELL_SIZE / 2;
  };

  const createWantedZones = (
    characterId: number,
    x: number,
    y: number
  ): NoOverlapZone[] => {
    const halfSize = CELL_SIZE / 2.5;

    return [
      { x, y: y - halfSize, radius: halfSize / 2.2, characterId, zoneIndex: 0 },
      { x, y, radius: halfSize / 2.5, characterId, zoneIndex: 1 },
      { x, y: y + halfSize, radius: halfSize / 2, characterId, zoneIndex: 2 },
    ];
  };

  const generateRandomPosition = () => {
    const margin = CELL_SIZE / 2;
    const x = randomIntFromInterval(margin, GRID_SIZE_WIDTH - margin);
    const y = randomIntFromInterval(margin, GRID_SIZE_HEIGHT - margin);
    return { x, y };
  };

  const generateRandomVelocity = (speed: number) => {
    const angle = Math.random() * Math.PI * 2;
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;
    return { velocityX, velocityY };
  };

  const generateCommonDirection = (speed: number) => {
    const angle = Math.random() * Math.PI * 2;
    return {
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
    };
  };

  const generateLayersDirections = () => {
    const lowerLayerDirection = generateCommonDirection(
      lowerLayerSpeed ?? otherCharactersSpeed
    );
    const upperLayerDirection = generateCommonDirection(
      upperLayerSpeed ?? otherCharactersSpeed
    );
    return { lowerLayerDirection, upperLayerDirection };
  };

  // Loi de mouvement commune à tous les persos de la foule (recherché compris)
  const LOWER_LAYER_MAX_Z = 40;
  const pickVelocity = (
    zIndex: number,
    commonDirection: { velocityX: number; velocityY: number } | null,
    layersDirections: {
      lowerLayerDirection: { velocityX: number; velocityY: number };
      upperLayerDirection: { velocityX: number; velocityY: number };
    } | null
  ) => {
    if (commonDirection) return { ...commonDirection };
    if (layersDirections) {
      return {
        ...(zIndex < LOWER_LAYER_MAX_Z
          ? layersDirections.lowerLayerDirection
          : layersDirections.upperLayerDirection),
      };
    }
    return generateRandomVelocity(otherCharactersSpeed);
  };

  const createBackgroundGrid = (
    availableCharacters: GridCell[],
    startId: number,
    commonDirection: { velocityX: number; velocityY: number } | null,
    layersDirections: {
      lowerLayerDirection: { velocityX: number; velocityY: number };
      upperLayerDirection: { velocityX: number; velocityY: number };
    } | null
  ): PlacedCharacter[] => {
    const backgroundChars: PlacedCharacter[] = [];

    if (!availableCharacters.length) return backgroundChars;

    const cellsPerRow = Math.floor(GRID_SIZE_WIDTH / CELL_SIZE);
    const cellsPerColumn = Math.floor(GRID_SIZE_HEIGHT / CELL_SIZE);

    for (let row = 0; row < cellsPerColumn; row++) {
      for (let col = 0; col < cellsPerRow; col++) {
        const baseX = col * CELL_SIZE + CELL_SIZE / 2;
        const baseY = row * CELL_SIZE + CELL_SIZE / 2;

        const jitterX = randomIntFromInterval(
          -backgroundGridJitter,
          backgroundGridJitter
        );
        const jitterY = randomIntFromInterval(
          -backgroundGridJitter,
          backgroundGridJitter
        );

        const finalX = baseX + jitterX;
        const finalY = baseY + jitterY;

        const randomIndex = randomIntFromInterval(
          0,
          availableCharacters.length - 1
        );
        const character = availableCharacters[randomIndex];

        if (!character) continue;

        const uniqueId = startId + row * cellsPerRow + col;

        let velocityX = 0;
        let velocityY = 0;

        if (moveBackgroundCharacters) {
          const velocity = pickVelocity(0, commonDirection, layersDirections);
          velocityX = velocity.velocityX;
          velocityY = velocity.velocityY;
        }

        backgroundChars.push({
          id: uniqueId,
          x: finalX,
          y: finalY,
          name: character.name,
          imageSrc: character.imageSrc,
          noOverlapZones: [
            {
              x: finalX,
              y: finalY,
              radius: CELL_SIZE / 7,
              characterId: uniqueId,
              zoneIndex: 0,
            },
          ],
          isWanted: false,
          zIndex: 0,
          isBackground: true,
          velocityX,
          velocityY,
        });
      }
    }

    return backgroundChars;
  };

  const checkIfWantedCharacterOnScreen = (characterList: PlacedCharacter[]) => {
    const wantedCharacter = characterList.find(char => char.isWanted);
    
    if (!wantedCharacter) {
      wantedCharacterVisibleRef.current = false;
      return false;
    }
    
    // Vérifier si au moins une partie du personnage est visible à l'écran
    const { x, y } = wantedCharacter;
    const halfCell = CELL_SIZE / 2;
    
    const onScreen = 
      x + halfCell > 0 && 
      x - halfCell < GRID_SIZE_WIDTH && 
      y + halfCell > 0 && 
      y - halfCell < GRID_SIZE_HEIGHT;
    
    wantedCharacterVisibleRef.current = onScreen;
    return onScreen;
  };

  const placeCharacters = () => {
    if (!grid || !wantedCharacter) return;

    const availableCharacters = grid.filter(
      (cell): cell is GridCell => cell !== null && cell !== undefined
    );

    if (availableCharacters.length === 0) return;

    const wantedCell = availableCharacters.find(
      (cell) => cell?.name === wantedCharacter.name
    );
    
    if (!wantedCell) return;

    let commonDirection = null;
    let layersDirections = null;

    if (sameDirectionForAll) {
      commonDirection = generateCommonDirection(otherCharactersSpeed);
    } else if (differentLayersDirection) {
      layersDirections = generateLayersDirections();
    }

    // Place wanted character in a visible position to start
    const wantedPosition = generateRandomPosition();

    const wantedZones = createWantedZones(
      wantedCell.id,
      wantedPosition.x,
      wantedPosition.y
    );

    // Donner au personnage recherché un z-index aléatoire pour qu'il soit parfois caché
    // Permettre un z-index selon la difficulté
    let wantedZIndex;
    if (difficulty <= 1) {
      // Plus facile: personnage recherché au-dessus
      wantedZIndex = randomIntFromInterval(70, 90);
    } else if (difficulty <= 3) {
      // Difficulté moyenne: personnage recherché dans la moitié supérieure
      wantedZIndex = randomIntFromInterval(50, 80);
    } else {
      // Difficulté élevée: personnage recherché peut être n'importe où
      wantedZIndex = randomIntFromInterval(20, 90);
    }

    // Si wantedZIndexBelow est true, forcer le personnage recherché à être en dessous
    if (wantedZIndexBelow) {
      wantedZIndex = randomIntFromInterval(10, 30);
    }

    // Même loi que les leurres de sa couche : aucun indice par le mouvement
    const wantedVelocity = pickVelocity(
      wantedZIndex,
      commonDirection,
      layersDirections
    );

    const placedWanted: PlacedCharacter = {
      id: wantedCell.id,
      x: wantedPosition.x,
      y: wantedPosition.y,
      name: wantedCell.name,
      imageSrc: wantedCell.imageSrc,
      noOverlapZones: wantedZones,
      isWanted: true,
      zIndex: wantedZIndex,
      velocityX: wantedVelocity.velocityX,
      velocityY: wantedVelocity.velocityY,
    };

    // Mark that we've placed the wanted character
    wantedCharacterPlacedRef.current = true;
    wantedCharacterVisibleRef.current = true;

    let allPlacedCharacters: PlacedCharacter[] = [placedWanted];

    if (useBackgroundGrid) {
      const backgroundAvailableCharacters = availableCharacters.filter(
        (char) => char?.name !== wantedCharacter.name
      );

      const backgroundCharacters = createBackgroundGrid(
        backgroundAvailableCharacters,
        1000000,
        commonDirection,
        layersDirections
      );

      allPlacedCharacters = [...allPlacedCharacters, ...backgroundCharacters];
    }

    // Calculate how many regular characters to place
    // If characterCount is 100, we've already placed 1 wanted character, so we need 99 more
    const remainingCharactersToPlace = Math.max(0, characterCount - 1);

    let otherCharacters = availableCharacters
      .filter((cell) => cell?.name !== wantedCharacter.name)
      .sort(() => Math.random() - 0.5);

    // If we don't have enough unique characters, duplicate them to reach desired count
    const uniqueOthers = [...otherCharacters];
    while (otherCharacters.length < remainingCharactersToPlace) {
      const nextBatch = uniqueOthers.map((char) => ({
        ...char,
        id: (char?.id ?? 0) + otherCharacters.length * 1000,
        name: char?.name ?? "",
        imageSrc: char?.imageSrc ?? "",
      }));
      otherCharacters = [...otherCharacters, ...nextBatch];
    }

    // Take only the number we need
    otherCharacters = otherCharacters.slice(0, remainingCharactersToPlace);

    // Place the other characters
    for (let i = 0; i < otherCharacters.length; i++) {
      const character = otherCharacters[i];
      if (!character) continue;

      const position = generateRandomPosition();

      const zones = [
        {
          x: position.x,
          y: position.y,
          radius: CELL_SIZE / 4,
          characterId: character.id,
          zoneIndex: 0,
        },
      ];

      const zIndex = randomIntFromInterval(10, 90);

      const { velocityX, velocityY } = pickVelocity(
        zIndex,
        commonDirection,
        layersDirections
      );

      allPlacedCharacters.push({
        id: character.id + i * 1000,
        x: position.x,
        y: position.y,
        name: character.name,
        imageSrc: character.imageSrc,
        noOverlapZones: zones,
        isWanted: false,
        zIndex: zIndex,
        velocityX,
        velocityY,
      });
    }

    // Always sort by zIndex so rendering order is correct
    allPlacedCharacters.sort((a, b) => a.zIndex - b.zIndex);
    setPlacedCharacters(allPlacedCharacters);
  };

  const animateCharacters = (timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;

    const deltaTime = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    if (gameStateRef.current === GameStateEnum.END) {
      return;
    }

    if (isCorrectSelectionRef.current) {
      animationFrameRef.current = requestAnimationFrame(animateCharacters);
      return;
    }

    setPlacedCharacters((prevCharacters) => {
      // Vérifier si le personnage recherché est toujours présent
      const wantedExists = prevCharacters.some(char => char.isWanted);
      
      // Si le personnage recherché est absent, marquer comme manquant
      if (!wantedExists && forceRestartOnMissingWanted) {
        setWantedCharacterMissing(true);
        return prevCharacters;
      }
      
      // Traiter normalement tous les personnages, y compris le recherché
      return prevCharacters.map((character) => {
        // Personnages statiques (background)
        if (character.isBackground && !moveBackgroundCharacters) {
          return character;
        }

        let newX = character.x + character.velocityX * deltaTime * 60;
        let newY = character.y + character.velocityY * deltaTime * 60;

        const margin = CELL_SIZE / 2;
        let newVelocityX = character.velocityX;
        let newVelocityY = character.velocityY;

        if (edgeBehavior === "bounce") {
          if (newX < margin || newX > GRID_SIZE_WIDTH - margin) {
            newVelocityX = -character.velocityX;
            newX = newX < margin ? margin : GRID_SIZE_WIDTH - margin;
          }
          if (newY < margin || newY > GRID_SIZE_HEIGHT - margin) {
            newVelocityY = -character.velocityY;
            newY = newY < margin ? margin : GRID_SIZE_HEIGHT - margin;
          }
        } else if (edgeBehavior === "wrap") {
          if (newX < -CELL_SIZE / 2) newX = GRID_SIZE_WIDTH + CELL_SIZE / 2;
          if (newX > GRID_SIZE_WIDTH + CELL_SIZE / 2) newX = -CELL_SIZE / 2;
          if (newY < -CELL_SIZE / 2) newY = GRID_SIZE_HEIGHT + CELL_SIZE / 2;
          if (newY > GRID_SIZE_HEIGHT + CELL_SIZE / 2) newY = -CELL_SIZE / 2;
        }

        const updatedZones = character.noOverlapZones.map((zone) => ({
          ...zone,
          x: newX + (zone.x - character.x),
          y: newY + (zone.y - character.y),
        }));

        return {
          ...character,
          x: newX,
          y: newY,
          velocityX: newVelocityX,
          velocityY: newVelocityY,
          noOverlapZones: updatedZones,
        };
      });
    });

    animationFrameRef.current = requestAnimationFrame(animateCharacters);
  };

  // Effet pour surveiller si le personnage recherché manque et le recréer si nécessaire
  useEffect(() => {
    if (wantedCharacterMissing && forceRestartOnMissingWanted) {
      // Réinitialiser l'état
      setWantedCharacterMissing(false);
      // Replacer les personnages
      placeCharacters();
    }
  }, [wantedCharacterMissing]);

  // Vérifier périodiquement si le personnage recherché est toujours visible
  useEffect(() => {
    if (forceRestartOnMissingWanted && !isInitializing && !animationLevelLoading && gameState === GameStateEnum.PLAYING) {
      // Vérifier toutes les 5 secondes si le personnage est toujours visible
      const checkInterval = setInterval(() => {
        const characters = placedCharactersRef.current;
        if (!wantedCharacterVisibleRef.current) {
          const visibleNow = checkIfWantedCharacterOnScreen(characters);
          if (!visibleNow) {
            setWantedCharacterMissing(true);
          }
        } else {
          // Mise à jour du statut
          checkIfWantedCharacterOnScreen(characters);
        }
      }, 5000);
      
      checkMissingInterval.current = checkInterval;
      
      return () => {
        if (checkMissingInterval.current) {
          clearInterval(checkMissingInterval.current);
          checkMissingInterval.current = null;
        }
      };
    }
  }, [isInitializing, animationLevelLoading, gameState]);

  useEffect(() => {
    // Reset the flag that tracks if the wanted character is placed
    wantedCharacterPlacedRef.current = false;
    wantedCharacterVisibleRef.current = false;
    
    if (grid && wantedCharacter && !animationLevelLoading) {
      setDisableClick(true);
      setIsInitializing(true);

      // Place characters (including wanted character)
      placeCharacters();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      const initTimer = setTimeout(() => {
        // Check if wanted character is placed successfully
        if (ensureWantedCharacter && !wantedCharacterPlacedRef.current) {
          placeCharacters(); // Try placing characters again
        }

        setIsInitializing(false);
        setDisableClick(false);

        if (!animationLevelLoading) {
          lastTimeRef.current = performance.now();
          animationFrameRef.current = requestAnimationFrame(animateCharacters);
        }
      }, 100);

      return () => {
        clearTimeout(initTimer);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (checkMissingInterval.current) {
          clearInterval(checkMissingInterval.current);
          checkMissingInterval.current = null;
        }
      };
    }
  }, [
    grid,
    wantedCharacter,
    difficulty,
    animationLevelLoading,
    characterCount,
    useBackgroundGrid,
    backgroundGridJitter,
    moveBackgroundCharacters,
    sameDirectionForAll,
    differentLayersDirection,
    lowerLayerSpeed,
    upperLayerSpeed,
    edgeBehavior,
    otherCharactersSpeed,
    ensureWantedCharacter,
  ]);

  // If grid is not loaded or level is loading, show empty container
  if (!grid || animationLevelLoading) {
    return <div className="gridContainer"></div>;
  }

  const wantedCharacterWithZones = placedCharacters.find(
    (char) => char.isWanted
  );

  // If wanted character is still not placed after initialization, we have a problem
  if (!wantedCharacterWithZones && !isInitializing) {
    // Emergency re-initialization
    placeCharacters();
  }

  const showOnlyWantedCharacter =
    isCorrectSelection ||
    gameState === GameStateEnum.END ||
    gameState === GameStateEnum.FINISH;

  // Persos touchables aux positions courantes, remplis pendant le rendu (z = ordre de dessin)
  const candidates: HitCandidate[] = [];
  const hitArea = new Rectangle(0, 0, GRID_SIZE_WIDTH, GRID_SIZE_HEIGHT);

  const handlePointerDown = (e: FederatedPointerEvent) => {
    if (disableClick || isInitializing || showOnlyWantedCharacter) return;
    const hit = pickCharacterAt(e.global.x, e.global.y, candidates);
    if (!hit) return;
    handleCharacterClick(
      { x: e.global.x, y: e.global.y },
      { id: hit.id, isWanted: hit.isWanted }
    );
  };

  return (
    <div ref={localCanvasRef} className="gridContainer">
      <Stage
        ref={stageRef}
        width={GRID_SIZE_WIDTH}
        height={GRID_SIZE_HEIGHT}
        className="canvasGameBoard"
        options={{
          powerPreference: "high-performance",
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container>
          {!isInitializing &&
            placedCharacters.map((character, index) => {
              // Skip blinking characters
              if (
                selectedCharacterId === character.id &&
                !isCorrectSelection &&
                !blinkState
              ) {
                return null;
              }

              // In end game state, only show wanted character
              if (showOnlyWantedCharacter && !character.isWanted) {
                return null;
              }

              candidates.push({
                id: character.id,
                cx: character.x,
                cy: character.y,
                size: CELL_SIZE,
                z: index,
                isWanted: character.isWanted,
              });

              return (
                <Sprite
                  key={`character-${character.id}`}
                  image={character.imageSrc}
                  x={character.x - CELL_SIZE / 2}
                  y={character.y - CELL_SIZE / 2}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  eventMode="none"
                  alpha={character.isBackground ? 0.9 : 1}
                />
              );
            })}

          {!isInitializing &&
            debug &&
            wantedCharacterWithZones &&
            wantedCharacterWithZones.noOverlapZones.map((zone, index) => (
              <Container
                key={`zone-${wantedCharacterWithZones.id}-${index}`}
                x={zone.x}
                y={zone.y}
              >
                <Graphics
                  draw={(g) => {
                    g.clear();

                    const colors = [0xff0000, 0x00ff00, 0x0000ff];
                    g.lineStyle(2, colors[zone.zoneIndex], 0.6);
                    g.drawCircle(0, 0, zone.radius);
                    g.endFill();
                  }}
                />
              </Container>
            ))}
        </Container>
        {/* Zone de toucher unique, au-dessus des sprites */}
        <Container
          eventMode="static"
          hitArea={hitArea}
          pointerdown={handlePointerDown}
        />
      </Stage>
    </div>
  );
};

export default GridAnimated3;