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
import "@pixi/events";
import { useCharacterInteraction } from "../../../hooks/useCharacterInteraction";

type NoOverlapZone = {
  x: number;
  y: number;
  radius: number;
  characterId: number;
  zoneIndex: number;
};

type CharacterType = {
  id: number;
  x: number;
  y: number;
  name: string;
  imageSrc: string;
  noOverlapZones: NoOverlapZone[];
  isWanted: boolean;
  zIndex: number;
  isBackground?: boolean;
};

interface GridAnimated2Props {
  difficulty?: number;
  characterCount?: number;
  useBackgroundGrid?: boolean;
  backgroundGridJitter?: number;
}

const GridAnimated2 = ({
  difficulty = 2,
  characterCount = 300,
  useBackgroundGrid = true,
  backgroundGridJitter = 2,
}: GridAnimated2Props) => {
  const stageRef = useRef<Stage>(null);
  const [placedCharacters, setPlacedCharacters] = useState<CharacterType[]>([]);
  const localCanvasRef = useRef<HTMLDivElement>(null);

  const {
    canvasRef,
    disableClick,
    setDisableClick,
    selectedCharacterId,
    blinkState,
    isCorrectSelection,
    handleCharacterClick: hookHandleCharacterClick,
  } = useCharacterInteraction();

  useEffect(() => {
    if (localCanvasRef.current) {
      canvasRef.current = localCanvasRef.current;
    }
  }, [localCanvasRef.current]);

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

  const adaptCharacterToHook = (character: CharacterType) => {
    return {
      id: character.id,
      name: character.name,
      imageSrc: character.imageSrc,
      position: {
        rowIndex: 0,
        colIndex: 0,
        offsetX: character.x,
        offsetY: character.y,
      },
      isWanted: character.isWanted,
      zIndex: character.zIndex,
    };
  };

  const handleCharacterClick = (
    e: FederatedPointerEvent,
    character: CharacterType
  ) => {
    if (disableClick) return;

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
    const halfSize = CELL_SIZE / 3.5;

    return [
      {
        x,
        y: y - halfSize - 2,
        radius: halfSize / 2,
        characterId,
        zoneIndex: 0,
      },
      { x, y, radius: halfSize / 1.6, characterId, zoneIndex: 1 },
      {
        x,
        y: y + halfSize + 2,
        radius: halfSize / 2,
        characterId,
        zoneIndex: 2,
      },
    ];
  };

  const generateRandomPosition = () => {
    const margin = CELL_SIZE / 2;
    const x = randomIntFromInterval(margin, GRID_SIZE_WIDTH - margin);
    const y = randomIntFromInterval(margin, GRID_SIZE_HEIGHT - margin);
    return { x, y };
  };

  const createBackgroundGrid = (
    availableCharacters: GridCell[],
    startId: number
  ): CharacterType[] => {
    const backgroundChars: CharacterType[] = [];

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
        });
      }
    }

    return backgroundChars;
  };

  const moveCharacterAwayFrom = (
    character: CharacterType,
    fromX: number,
    fromY: number,
    minDistance: number
  ): CharacterType => {
    let newX = character.x;
    let newY = character.y;

    const dx = character.x - fromX;
    const dy = character.y - fromY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      const nx = distance > 0 ? dx / distance : Math.random() * 2 - 1;
      const ny = distance > 0 ? dy / distance : Math.random() * 2 - 1;

      // Force de déplacement plus importante pour assurer qu'il sorte des deux zones
      const pushFactor = CELL_SIZE * Math.min(1, Math.random() * 0.5);

      newX += nx * pushFactor;
      newY += ny * pushFactor;

      newX = Math.max(
        CELL_SIZE / 2,
        Math.min(GRID_SIZE_WIDTH - CELL_SIZE / 2, newX)
      );
      newY = Math.max(
        CELL_SIZE / 2,
        Math.min(GRID_SIZE_HEIGHT - CELL_SIZE / 2, newY)
      );
    }

    return {
      ...character,
      x: newX,
      y: newY,
      noOverlapZones: [
        {
          x: newX,
          y: newY,
          radius: CELL_SIZE / 3.2,
          characterId: character.id,
          zoneIndex: 0,
        },
      ],
    };
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

    const wantedZIndex = difficulty <= 1 ? 90 : randomIntFromInterval(2, 80);

    const placedWanted: CharacterType = {
      id: wantedCell.id,
      x: wantedPosition.x,
      y: wantedPosition.y,
      name: wantedCell.name,
      imageSrc: wantedCell.imageSrc,
      noOverlapZones: wantedZones,
      isWanted: true,
      zIndex: wantedZIndex,
    };

    let allPlacedCharacters: CharacterType[] = [placedWanted];

    const backgroundAvailableCharacters = availableCharacters.filter(
      (char) => char?.name !== wantedCharacter.name
    );

    if (useBackgroundGrid) {
      const backgroundCharacters = createBackgroundGrid(
        backgroundAvailableCharacters,
        1000000
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

      const zIndex =
        difficulty <= 1
          ? randomIntFromInterval(10, 90)
          : randomIntFromInterval(10, 100);

      allPlacedCharacters.push({
        id: character.id + i * 1000,
        x: position.x,
        y: position.y,
        name: character.name,
        imageSrc: character.imageSrc,
        noOverlapZones: zones,
        isWanted: false,
        zIndex: zIndex,
      });
    }

    // Modification: On garde à la fois les personnages et le nombre de zones qu'ils couvrent
    const characterZoneCount = new Map<number, number>();
    const charactersInZones: CharacterType[][] = [[], [], []];

    allPlacedCharacters.forEach((character) => {
      if (character.isWanted) return;

      for (let zoneIndex = 0; zoneIndex < wantedZones.length; zoneIndex++) {
        const zone = wantedZones[zoneIndex];

        if (isPositionInZone({ x: character.x, y: character.y }, zone)) {
          charactersInZones[zoneIndex].push(character);

          // Incrémenter le compteur de zones pour ce personnage
          const currentCount = characterZoneCount.get(character.id) || 0;
          characterZoneCount.set(character.id, currentCount + 1);
        }
      }
    });

    const finalPlacedCharacters: CharacterType[] = [...allPlacedCharacters];

    // D'abord, déplacer les personnages qui sont dans 2 zones ou plus
    // Ces déplacements doivent être plus importants pour s'assurer qu'ils sortent complètement
    for (const [characterId, zoneCount] of characterZoneCount.entries()) {
      if (zoneCount >= 2) {
        const index = finalPlacedCharacters.findIndex(
          (c) => c.id === characterId
        );
        if (index !== -1) {
          // Déplacement plus fort pour les personnages dans plusieurs zones
          finalPlacedCharacters[index] = moveCharacterAwayFrom(
            finalPlacedCharacters[index],
            wantedPosition.x,
            wantedPosition.y,
            10
          );
        }
      }
    }

    // Ensuite, on traite les zones normales à dégager, sans traiter à nouveau les personnages déjà déplacés
    let zonesToClear: number;
    if (difficulty <= 0) {
      zonesToClear = 3;
    } else if (difficulty <= 1) {
      zonesToClear = 2;
    } else {
      zonesToClear = 1;
    }

    const zoneIndicesInOrderOfClearing = [1, 0, 2];

    if (zonesToClear > 0) {
      for (let i = 0; i < zonesToClear && i < 3; i++) {
        const zoneIndexToClear = zoneIndicesInOrderOfClearing[i];
        charactersInZones[zoneIndexToClear].forEach((character) => {
          // Ne pas traiter les personnages déjà déplacés car dans plusieurs zones
          if (characterZoneCount.get(character.id) ?? 0 >= 2) {
            return;
          }

          if (character.isBackground && difficulty <= 1) {
            const index = finalPlacedCharacters.findIndex(
              (c) => c.id === character.id
            );
            if (index !== -1) {
              finalPlacedCharacters.splice(index, 1);
            }
            return;
          }

          if (character.zIndex <= placedWanted.zIndex && difficulty > 1) {
            return;
          }

          const index = finalPlacedCharacters.findIndex(
            (c) => c.id === character.id
          );
          if (index === -1) return;

          const updatedCharacter = moveCharacterAwayFrom(
            finalPlacedCharacters[index],
            wantedPosition.x,
            wantedPosition.y,
            randomIntFromInterval(5, 10)
          );

          finalPlacedCharacters[index] = updatedCharacter;
        });
      }
    }

    let needsAdditionalCheck = true;
    let iterations = 0;
    const MAX_ITERATIONS = 3;

    while (needsAdditionalCheck && iterations < MAX_ITERATIONS) {
      iterations++;
      needsAdditionalCheck = false;

      const potentialBlockers = finalPlacedCharacters.filter(
        (char) =>
          !char.isWanted &&
          char.zIndex > placedWanted.zIndex &&
          Math.sqrt(
            Math.pow(char.x - wantedPosition.x, 2) +
              Math.pow(char.y - wantedPosition.y, 2)
          ) <
            CELL_SIZE * 0.8
      );

      if (potentialBlockers.length > 0) {
        needsAdditionalCheck = true;

        potentialBlockers.forEach((blocker) => {
          const index = finalPlacedCharacters.findIndex(
            (c) => c.id === blocker.id
          );
          if (index !== -1) {
            finalPlacedCharacters[index] = moveCharacterAwayFrom(
              blocker,
              wantedPosition.x,
              wantedPosition.y,
              CELL_SIZE / 1.2
            );
          }
        });
      }
    }

    const ensureWantedCharacterVisibility = (
      allCharacters: CharacterType[],
      wantedCharacter: CharacterType
    ): CharacterType[] => {
      const updatedCharacters = [...allCharacters];

      const wantedZones = wantedCharacter.noOverlapZones;

      const zoneCoverageStatus: boolean[] = wantedZones.map((zone) => {
        const blockingCharacters = updatedCharacters.filter(
          (char) =>
            !char.isWanted &&
            !char.isBackground &&
            char.zIndex > wantedCharacter.zIndex &&
            isPositionInZone({ x: char.x, y: char.y }, zone)
        );

        return blockingCharacters.length > 0;
      });

      const allZonesCovered = zoneCoverageStatus.every(
        (status) => status === true
      );

      if (allZonesCovered) {
        const zonePriorities = [1, 0, 2];

        for (const zoneIndex of zonePriorities) {
          const zone = wantedZones[zoneIndex];

          // Vérifier combien de zones couvrent chaque personnage bloquant
          const blockingCharacters = updatedCharacters.filter(
            (char) =>
              !char.isWanted &&
              !char.isBackground &&
              char.zIndex > wantedCharacter.zIndex &&
              isPositionInZone({ x: char.x, y: char.y }, zone)
          );

          // Pour la vérification finale, créer une nouvelle Map de comptage
          const finalCharacterZoneCount = new Map<number, number>();

          // Compter dans combien de zones chaque bloqueur se trouve
          blockingCharacters.forEach((blocker) => {
            let zoneCount = 0;
            for (const wantedZone of wantedZones) {
              if (
                isPositionInZone({ x: blocker.x, y: blocker.y }, wantedZone)
              ) {
                zoneCount++;
              }
            }
            finalCharacterZoneCount.set(blocker.id, zoneCount);
          });

          // D'abord, déplacer les personnages qui sont dans 2 zones ou plus
          const multiZoneBlockers = blockingCharacters.filter(
            (blocker) => finalCharacterZoneCount.get(blocker.id) ?? 0 >= 2
          );

          multiZoneBlockers.forEach((blocker) => {
            const characterIndex = updatedCharacters.findIndex(
              (c) => c.id === blocker.id
            );
            if (characterIndex !== -1) {
              updatedCharacters[characterIndex] = moveCharacterAwayFrom(
                blocker,
                wantedPosition.x,
                wantedPosition.y,
                CELL_SIZE / 4
              );
            }
          });

          // Ensuite, traiter les autres bloqueurs normalement
          const singleZoneBlockers = blockingCharacters.filter(
            (blocker) => finalCharacterZoneCount.get(blocker.id) === 1
          );

          singleZoneBlockers.forEach((blocker) => {
            const characterIndex = updatedCharacters.findIndex(
              (c) => c.id === blocker.id
            );
            if (characterIndex !== -1) {
              updatedCharacters[characterIndex] = moveCharacterAwayFrom(
                blocker,
                zone.x,
                zone.y,
                5
              );
            }
          });

          break;
        }
      }

      return updatedCharacters;
    };

    const wantedCharacterObj = finalPlacedCharacters.find(
      (char) => char.isWanted
    );
    if (wantedCharacterObj) {
      const updatedPlacedCharacters = ensureWantedCharacterVisibility(
        finalPlacedCharacters,
        wantedCharacterObj
      );

      updatedPlacedCharacters.sort((a, b) => a.zIndex - b.zIndex);

      setPlacedCharacters(updatedPlacedCharacters);
    } else {
      finalPlacedCharacters.sort((a, b) => a.zIndex - b.zIndex);
      setPlacedCharacters(finalPlacedCharacters);
    }
  };

  useEffect(() => {
    if (grid && wantedCharacter && !animationLevelLoading) {
      setDisableClick(false);
      placeCharacters();
    }
  }, [
    grid,
    wantedCharacter,
    difficulty,
    animationLevelLoading,
    characterCount,
    useBackgroundGrid,
    backgroundGridJitter,
  ]);

  if (!grid || animationLevelLoading) {
    return <div className="gridContainer"></div>;
  }

  const wantedCharacterWithZones = placedCharacters.find(
    (char) => char.isWanted
  );

  const showOnlyWantedCharacter =
    isCorrectSelection || gameState === GameStateEnum.END || gameState === GameStateEnum.FINISH;

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
          {placedCharacters.map((character) => {
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
                pointerdown={
                  !disableClick
                    ? (e) => handleCharacterClick(e, character)
                    : undefined
                }
                alpha={character.isBackground ? 1 : 1}
              />
            );
          })}

          {debug &&
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

export default GridAnimated2;
