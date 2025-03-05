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
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";

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
  lowerLayerSpeed?: number;
  upperLayerSpeed?: number;
  edgeBehavior?: EdgeBehavior;
  wantedCharacterSpeed?: number;
  otherCharactersSpeed?: number;
  wantedZIndexBelow?: boolean;
}

const GridAnimated3 = ({
  difficulty = 2,
  characterCount = 180,
  useBackgroundGrid = false,
  backgroundGridJitter = 2,
  moveBackgroundCharacters = true,
  sameDirectionForAll = false,
  differentLayersDirection = true,
  lowerLayerSpeed = 0.6,
  upperLayerSpeed = 0.0,
  edgeBehavior = "wrap",
  wantedZIndexBelow = false,
  wantedCharacterSpeed = 0.5,
  otherCharactersSpeed = 0.5,
}: GridAnimated3Props) => {
  const localCanvasRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const {
    canvasRef,
    disableClick,
    setDisableClick,
    selectedCharacterId,
    blinkState,
    isCorrectSelection,
    handleCharacterClick: hookHandleCharacterClick
  } = useCharacterInteraction();

  // Synchroniser notre canvas ref local avec celle du hook
  useEffect(() => {
    if (localCanvasRef.current) {
      canvasRef.current = localCanvasRef.current;
    }
  }, [localCanvasRef.current]);

  const [placedCharacters, setPlacedCharacters] = useState<PlacedCharacter[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  const gridSize = Math.min(window.innerWidth, 450);
  const GRID_SIZE_WIDTH = gridSize;
  const GRID_SIZE_HEIGHT = gridSize;

  const CENTER_X = GRID_SIZE_WIDTH / 2;
  const CENTER_Y = GRID_SIZE_HEIGHT / 2;

  const {
    grid,
    wantedCharacter,
    gameState,
    animationLevelLoading,
    setLevel,
    setPauseTimer,
    debug,
  } = useGameStore(
    useShallow((state) => ({
      grid: state.grid,
      wantedCharacter: state.wantedCharacter,
      gameState: state.gameState,
      animationLevelLoading: state.animationLevelLoading,
      setLevel: state.setLevel,
      setPauseTimer: state.setPauseTimer,
      debug: state.debug,
    }))
  );

  // Fonction d'adaptation pour convertir notre type vers celui attendu par le hook
  const adaptCharacterToHook = (character: PlacedCharacter) => {
    return {
      id: character.id,
      name: character.name,
      imageSrc: character.imageSrc,
      position: {
        rowIndex: 0,
        colIndex: 0,
        offsetX: character.x,
        offsetY: character.y
      },
      isWanted: character.isWanted,
      zIndex: character.zIndex
    };
  };
  
  // Fonction adaptateur pour gérer le clic
  const handleCharacterClick = (e: FederatedPointerEvent, character: PlacedCharacter) => {
    if (disableClick) return;
    
    // Convertir notre type de personnage vers celui attendu par le hook
    const adaptedCharacter = adaptCharacterToHook(character);
    hookHandleCharacterClick(e, adaptedCharacter);
  };

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
    const lowerLayerDirection = generateCommonDirection(lowerLayerSpeed);

    const upperLayerDirection = differentLayersDirection
      ? generateCommonDirection(upperLayerSpeed)
      : {
          velocityX:
            lowerLayerDirection.velocityX * (upperLayerSpeed / lowerLayerSpeed),
          velocityY:
            lowerLayerDirection.velocityY * (upperLayerSpeed / lowerLayerSpeed),
        };

    return { lowerLayerDirection, upperLayerDirection };
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
          if (commonDirection) {
            velocityX = commonDirection.velocityX;
            velocityY = commonDirection.velocityY;
          } else if (layersDirections) {
            velocityX = layersDirections.lowerLayerDirection.velocityX;
            velocityY = layersDirections.lowerLayerDirection.velocityY;
          } else {
            const velocity = generateRandomVelocity(otherCharactersSpeed / 2);
            velocityX = velocity.velocityX;
            velocityY = velocity.velocityY;
          }
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
    } else if (
      differentLayersDirection ||
      lowerLayerSpeed !== upperLayerSpeed
    ) {
      layersDirections = generateLayersDirections();
    }

    let wantedPosition;

    if (difficulty <= 1) {
      wantedPosition = {
        x: CENTER_X + randomIntFromInterval(-50, 50),
        y: CENTER_Y + randomIntFromInterval(-50, 50),
      };
    } else {
      wantedPosition = generateRandomPosition();
    }

    const wantedZones = createWantedZones(
      wantedCell.id,
      wantedPosition.x,
      wantedPosition.y
    );

    const wantedZIndex =
      difficulty <= 1
        ? wantedZIndexBelow
          ? -1
          : 80
        : wantedZIndexBelow
        ? -1
        : randomIntFromInterval(20, 60);

    let wantedVelocityX, wantedVelocityY;

    if (commonDirection) {
      const speedRatio = wantedCharacterSpeed / otherCharactersSpeed;
      wantedVelocityX = commonDirection.velocityX * speedRatio;
      wantedVelocityY = commonDirection.velocityY * speedRatio;
    } else if (layersDirections) {
      const direction =
        wantedZIndex < 40
          ? layersDirections.lowerLayerDirection
          : layersDirections.upperLayerDirection;
      const layerSpeed = wantedZIndex < 40 ? lowerLayerSpeed : upperLayerSpeed;
      const speedRatio = wantedCharacterSpeed / layerSpeed;
      wantedVelocityX = direction.velocityX * speedRatio;
      wantedVelocityY = direction.velocityY * speedRatio;
    } else {
      const velocity = generateRandomVelocity(wantedCharacterSpeed);
      wantedVelocityX = velocity.velocityX;
      wantedVelocityY = velocity.velocityY;
    }

    const placedWanted: PlacedCharacter = {
      id: wantedCell.id,
      x: wantedPosition.x,
      y: wantedPosition.y,
      name: wantedCell.name,
      imageSrc: wantedCell.imageSrc,
      noOverlapZones: wantedZones,
      isWanted: true,
      zIndex: wantedZIndex,
      velocityX: wantedVelocityX,
      velocityY: wantedVelocityY,
    };

    let allPlacedCharacters: PlacedCharacter[] = [placedWanted];

    if (useBackgroundGrid) {
      const backgroundCharacters = createBackgroundGrid(
        availableCharacters,
        1000000,
        commonDirection,
        layersDirections
      );

      allPlacedCharacters = [...allPlacedCharacters, ...backgroundCharacters];
    }

    let otherCharacters = availableCharacters
      .filter((cell) => cell?.name !== wantedCharacter.name)
      .sort(() => Math.random() - 0.5);

    const uniqueOthers = [...otherCharacters];
    while (otherCharacters.length < characterCount - 1) {
      const nextBatch = uniqueOthers.map((char) => ({
        ...char,
        id: char?.id ?? 0 + otherCharacters.length * 1000,
        name: char?.name ?? "",
        imageSrc: char?.imageSrc ?? "",
      }));
      otherCharacters = [...otherCharacters, ...nextBatch];
    }

    otherCharacters = otherCharacters.slice(0, characterCount - 1);

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

      let velocityX, velocityY;

      if (commonDirection) {
        velocityX = commonDirection.velocityX;
        velocityY = commonDirection.velocityY;
      } else if (layersDirections) {
        const direction =
          zIndex < 40
            ? layersDirections.lowerLayerDirection
            : layersDirections.upperLayerDirection;
        velocityX = direction.velocityX;
        velocityY = direction.velocityY;
      } else {
        const velocity = generateRandomVelocity(otherCharactersSpeed);
        velocityX = velocity.velocityX;
        velocityY = velocity.velocityY;
      }

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

    const charactersInZones: PlacedCharacter[][] = [[], [], []];

    allPlacedCharacters.forEach((character) => {
      if (character.isWanted) return;

      for (let zoneIndex = 0; zoneIndex < wantedZones.length; zoneIndex++) {
        const zone = wantedZones[zoneIndex];

        if (isPositionInZone({ x: character.x, y: character.y }, zone)) {
          charactersInZones[zoneIndex].push(character);
        }
      }
    });

    let zonesToClear: number;
    if (difficulty <= 0) {
      zonesToClear = 3;
    } else if (difficulty <= 1) {
      zonesToClear = 2;
    } else if (difficulty <= 2) {
      zonesToClear = 1;
    } else {
      zonesToClear = 1;
    }

    const finalPlacedCharacters: PlacedCharacter[] = [...allPlacedCharacters];

    if (zonesToClear > 0) {
      const zoneIndicesInOrderOfClearing = [0, 2, 1];

      for (let i = 0; i < zonesToClear && i < 3; i++) {
        const zoneIndexToClear = zoneIndicesInOrderOfClearing[i];

        charactersInZones[zoneIndexToClear].forEach((character) => {
          if (character.isBackground && difficulty <= 1) {
            const index = finalPlacedCharacters.findIndex(
              (c) => c.id === character.id
            );
            if (index !== -1) {
              finalPlacedCharacters.splice(index, 1);
            }
            return;
          }

          if (character.zIndex <= placedWanted.zIndex) {
            return;
          }

          const index = finalPlacedCharacters.findIndex(
            (c) => c.id === character.id
          );
          if (index === -1) return;

          let newX = character.x;
          let newY = character.y;

          const dx = character.x - wantedPosition.x;
          const dy = character.y - wantedPosition.y;

          const distance = Math.sqrt(dx * dx + dy * dy);
          const nx = distance > 0 ? dx / distance : 0;
          const ny = distance > 0 ? dy / distance : 0;

          newX += (nx * CELL_SIZE) / randomIntFromInterval(1.2, 2);
          newY += (ny * CELL_SIZE) / randomIntFromInterval(1.2, 2);

          newX = Math.max(
            CELL_SIZE / 2,
            Math.min(GRID_SIZE_WIDTH - CELL_SIZE / 2, newX)
          );
          newY = Math.max(
            CELL_SIZE / 2,
            Math.min(GRID_SIZE_HEIGHT - CELL_SIZE / 2, newY)
          );

          finalPlacedCharacters[index] = {
            ...finalPlacedCharacters[index],
            x: newX,
            y: newY,
            noOverlapZones: [
              {
                x: newX,
                y: newY,
                radius: CELL_SIZE / 4,
                characterId: character.id,
                zoneIndex: 0,
              },
            ],
          };
        });
      }
    }

    // Vérification pour s'assurer qu'au moins une zone du personnage recherché est visible
    const ensureWantedCharacterVisibility = (
      allCharacters: PlacedCharacter[],
      wantedCharacter: PlacedCharacter
    ): PlacedCharacter[] => {
      const updatedCharacters = [...allCharacters];
      
      const wantedZones = wantedCharacter.noOverlapZones;
      
      // Pour chaque zone, vérifier si elle est couverte par un personnage avec zIndex plus élevé
      const zoneCoverageStatus: boolean[] = wantedZones.map((zone) => {
        const blockingCharacters = updatedCharacters.filter(char => 
          !char.isWanted && 
          !char.isBackground &&
          char.zIndex > wantedCharacter.zIndex &&
          isPositionInZone({ x: char.x, y: char.y }, zone)
        );
        
        return blockingCharacters.length > 0;
      });
      
      // Vérifier si toutes les zones sont couvertes
      const allZonesCovered = zoneCoverageStatus.every(status => status === true);
      
      // Si toutes les zones sont couvertes, on doit libérer au moins une zone
      if (allZonesCovered) {
        // Priorités des zones à libérer
        const zonePriorities = [1, 0, 2]; // Centre, Haut, Bas
        
        for (const zoneIndex of zonePriorities) {
          const zone = wantedZones[zoneIndex];
          
          // Récupérer les personnages qui bloquent cette zone
          const blockingCharacters = updatedCharacters.filter(char => 
            !char.isWanted && 
            !char.isBackground &&
            char.zIndex > wantedCharacter.zIndex &&
            isPositionInZone({ x: char.x, y: char.y }, zone)
          );
          
          // Pour chaque personnage bloquant
          blockingCharacters.forEach(blocker => {
            const characterIndex = updatedCharacters.findIndex(c => c.id === blocker.id);
            if (characterIndex !== -1) {
              // Modifier la position pour déplacer le personnage hors de la zone
              let newX = blocker.x;
              let newY = blocker.y;
              
              const dx = blocker.x - zone.x;
              const dy = blocker.y - zone.y;
              
              const distance = Math.sqrt(dx * dx + dy * dy);
              const nx = distance > 0 ? dx / distance : (Math.random() * 2 - 1);
              const ny = distance > 0 ? dy / distance : (Math.random() * 2 - 1);
              
              // Force de déplacement plus importante
              const pushFactor = CELL_SIZE * 1.5;
              
              newX += nx * pushFactor;
              newY += ny * pushFactor;
              
              // S'assurer que le personnage reste dans les limites
              newX = Math.max(CELL_SIZE / 2, Math.min(GRID_SIZE_WIDTH - CELL_SIZE / 2, newX));
              newY = Math.max(CELL_SIZE / 2, Math.min(GRID_SIZE_HEIGHT - CELL_SIZE / 2, newY));
              
              updatedCharacters[characterIndex] = {
                ...updatedCharacters[characterIndex],
                x: newX,
                y: newY,
                noOverlapZones: [
                  {
                    x: newX,
                    y: newY,
                    radius: CELL_SIZE / 4,
                    characterId: blocker.id,
                    zoneIndex: 0,
                  },
                ],
              };
            }
          });
          
          // Une fois qu'on a libéré une zone, on peut sortir
          break;
        }
      }
      
      return updatedCharacters;
    };

    // Vérifier que le personnage recherché est visible
    const wantedCharacterObj = finalPlacedCharacters.find(char => char.isWanted);
    if (wantedCharacterObj) {
      const updatedPlacedCharacters = ensureWantedCharacterVisibility(
        finalPlacedCharacters,
        wantedCharacterObj
      );
      
      // Trier à nouveau par z-index
      updatedPlacedCharacters.sort((a, b) => a.zIndex - b.zIndex);
      setPlacedCharacters(updatedPlacedCharacters);
    } else {
      finalPlacedCharacters.sort((a, b) => a.zIndex - b.zIndex);
      setPlacedCharacters(finalPlacedCharacters);
    }
  };

  const animateCharacters = (timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;

    const deltaTime = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    if (gameState === GameStateEnum.END) {
      return;
    }

    if (isCorrectSelection) {
      animationFrameRef.current = requestAnimationFrame(animateCharacters);
      return;
    }

    setPlacedCharacters((prevCharacters) => {
      return prevCharacters.map((character) => {
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

  useEffect(() => {
    if (grid && wantedCharacter && !animationLevelLoading) {
      setDisableClick(true);
      setIsInitializing(true);

      placeCharacters();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      const initTimer = setTimeout(() => {
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
      };
    }
  },  [
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
    wantedCharacterSpeed,
    otherCharactersSpeed,
  ]);

  // Gestionnaire pour la fin de la sélection
  useEffect(() => {
    if (isCorrectSelection) {
      setTimeout(() => {
        setLevel(+1);
        setPauseTimer(false);
      }, 1000);
    }
  }, [isCorrectSelection]);

  if (!grid || animationLevelLoading) {
    return <div className="gridContainer"></div>;
  }

  const wantedCharacterWithZones = placedCharacters.find(
    (char) => char.isWanted
  );

  const showOnlyWantedCharacter =
    isCorrectSelection ||
    gameState === GameStateEnum.END ||
    gameState === GameStateEnum.FINISH;

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
            placedCharacters.map((character) => {
              if (
                selectedCharacterId === character.id &&
                !isCorrectSelection &&
                !blinkState
              ) {
                return null;
              }

              if (showOnlyWantedCharacter && !character.isWanted) {
                return null;
              }

              return (
                <Sprite
                  key={`character-${character.id}`}
                  image={character.imageSrc}
                  x={character.x - CELL_SIZE / 2}
                  y={character.y - CELL_SIZE / 2}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  eventMode={disableClick ? "none" : "static"}
                  pointerdown={!disableClick ? (e) => handleCharacterClick(e, character) : undefined}
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
      </Stage>
    </div>
  );
};

export default GridAnimated3;