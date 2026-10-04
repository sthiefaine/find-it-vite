import { BOARD, type LevelSpec } from "../../engine/types";
import { areaOf, layoutGrid, layoutScroll, placePile, placeSwarm } from "../../components/Game/Grid/layouts";
import { createScrollMovement, createSwarmMovement, scrollCrossAt, scrollOffsetAt, swarmCharacterAt } from "../../components/Game/Grid/movements";
import type { Look } from "../../components/Game/Grid/crowd";
import type { HitCandidate } from "../../helpers/hitTest";

export type MatchSprite = HitCandidate & { imageSrc: string; look: Look };
const modulo = (n: number, period: number) => ((n % period) + period) % period;

// Horloge absolue : un téléphone passé en arrière-plan retrouve la position
// courante à son retour. Le match ne peut pas être mis en pause localement.
function travel(initial: number, distance: number, length: number, size: number, wrap: boolean) {
  if (wrap) return modulo(initial + distance + size / 2, length + size) - size / 2;
  const span = length - size;
  const offset = modulo(initial - size / 2 + distance, span * 2);
  return size / 2 + (offset > span ? span * 2 - offset : offset);
}

export function createMatchBoard(spec: LevelSpec): (elapsedS: number) => MatchSprite[] {
  if (spec.layout === "grid") {
    const { cells, size } = layoutGrid(spec);
    const sprites = cells.map((cell, z) => ({ ...cell, imageSrc: cell.character.imageSrc, size, z }));
    return () => sprites;
  }
  if (spec.layout === "scroll") {
    const layout = layoutScroll(spec);
    const movement = createScrollMovement(spec, layout);
    return (elapsedS) => layout.slots.flatMap((slot, z) => {
      const main = modulo(slot.main + scrollOffsetAt(movement, slot.line, layout.speeds[slot.line], elapsedS), layout.period);
      const cross = scrollCrossAt(movement, slot, main, layout.period, layout.size);
      return [-layout.period, 0, layout.period].map(offset => ({
        id: slot.id, imageSrc: slot.character.imageSrc, look: slot.look, isWanted: slot.isWanted,
        size: layout.size, z,
        cx: layout.horizontal ? main + offset : cross,
        cy: layout.horizontal ? cross : main + offset,
      })).filter(sprite => sprite.cx + sprite.size / 2 >= 0 && sprite.cx - sprite.size / 2 <= BOARD.w &&
        sprite.cy + sprite.size / 2 >= 0 && sprite.cy - sprite.size / 2 <= BOARD.h);
    });
  }
  const placed = spec.layout === "pile" ? placePile(spec) : placeSwarm(spec);
  const convert = (characters: typeof placed) => characters.map((character, z) => ({
    id: character.id, imageSrc: character.imageSrc, look: character.look, isWanted: character.isWanted,
    cx: character.x, cy: character.y, size: spec.spriteSize, z,
  }));
  if (spec.layout === "pile") {
    const sprites = convert(placed);
    return () => sprites;
  }
  const swarm = placeSwarm(spec);
  const area = areaOf(spec);
  const routes = createSwarmMovement(spec, swarm, area);
  const edge = spec.params.edgeBehavior ?? "bounce";
  return (elapsedS) => convert(routes
    ? routes.map(route => swarmCharacterAt(route, elapsedS, area, edge))
    : swarm.map(character => ({ ...character,
      x: travel(character.x, character.velocityX * elapsedS * 60, area.w, area.size, edge === "wrap"),
      y: travel(character.y, character.velocityY * elapsedS * 60, area.h, area.size, edge === "wrap"),
    })));
}
