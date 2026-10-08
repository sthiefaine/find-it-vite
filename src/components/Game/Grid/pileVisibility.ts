import type { Rng } from "../../../engine/rng";
import { HIT_RADIUS_RATIO } from "../../../helpers/hitTest";
import type { Area, CrowdCharacter } from "./layouts";
import { accessoryRegionFor, portraitDistanceTo, portraitOverlapsRegion, regionInside, translateAccessoryRegion } from "./accessoryVisibility";
import type { AccessoryRegion, Bounds } from "./accessoryVisibility";

export type PileVisibilityRange = { min: number; max: number };
type Point = { x: number; y: number };

// Un morceau visible assez large pour viser ; la tolérance du toucher reste
// celle de toutes les autres grilles. Ce disque ne doit pas être recouvert.
export const PILE_TOUCH_RADIUS = 3;

const HEAD_SAMPLES: readonly Point[] = (() => {
  // Répartition uniforme sans colonnes alignées : déplacer un bord de sprite
  // ne masque pas une rangée entière d'échantillons d'un seul coup.
  const count = 384;
  const angleStep = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const radius = HIT_RADIUS_RATIO * Math.sqrt((index + .5) / count);
    const angle = index * angleStep;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
})();

// Dernière géométrie à trois zones de GridAnimated2 avant le moteur (643dae2).
export function pileDebugZones(x: number, y: number, size: number) {
  const half = size / 3.2;
  return [
    { x, y: y - half - 2, radius: half / 2, color: 0xff0000 },
    { x, y, radius: half / 1.6, color: 0x00ff00 },
    { x, y: y + half + 2, radius: half / 2, color: 0x0000ff },
  ];
}

const isAbove = (character: CrowdCharacter, wanted: CrowdCharacter) =>
  !character.isWanted && character.zIndex >= wanted.zIndex;

// Les carrés englobants sont volontairement conservateurs : une ouverture
// validée ne peut être cachée par les oreilles ou le museau d'un leurre.
function distanceToSprite(point: Point, character: CrowdCharacter, size: number): number {
  return portraitDistanceTo(point, character, size);
}

function blockersNear(characters: readonly CrowdCharacter[], wanted: CrowdCharacter, size: number) {
  return characters.filter((character) => isAbove(character, wanted)
    && distanceToSprite(wanted, character, size) <= size * HIT_RADIUS_RATIO);
}

function visibleRatio(wanted: Point, blockers: readonly CrowdCharacter[], size: number): number {
  let visible = 0;
  for (const sample of HEAD_SAMPLES) {
    const point = { x: wanted.x + sample.x * size, y: wanted.y + sample.y * size };
    if (blockers.every((blocker) => distanceToSprite(point, blocker, size) > 0)) visible++;
  }
  return visible / HEAD_SAMPLES.length;
}

function clearTouchPoint(wanted: Point, blockers: readonly CrowdCharacter[], size: number): Point | undefined {
  const innerRadius = size * HIT_RADIUS_RATIO - PILE_TOUCH_RADIUS;
  for (const sample of HEAD_SAMPLES) {
    const dx = sample.x * size;
    const dy = sample.y * size;
    if (dx * dx + dy * dy > innerRadius * innerRadius) continue;
    const point = { x: wanted.x + dx, y: wanted.y + dy };
    if (blockers.every((blocker) => distanceToSprite(point, blocker, size) >= PILE_TOUCH_RADIUS)) return point;
  }
  return undefined;
}

// Mesures partagées avec les tests et le debug, en coordonnées logiques.
export function pileHeadVisibility(characters: readonly CrowdCharacter[], wanted: CrowdCharacter, size: number): number {
  return visibleRatio(wanted, blockersNear(characters, wanted, size), size);
}

export function pileClearTouchPoint(characters: readonly CrowdCharacter[], wanted: CrowdCharacter, size: number): Point | undefined {
  return clearTouchPoint(wanted, blockersNear(characters, wanted, size), size);
}

export function pileAccessoryClear(characters: readonly CrowdCharacter[], wanted: CrowdCharacter, area: Area): boolean {
  const region = accessoryRegionFor(wanted, area.size);
  return !region || regionInside(region, area) && characters.every((character) =>
    !isAbove(character, wanted) || !portraitOverlapsRegion(character, area.size, region));
}

// Une ouverture locale autour de la tenue et d'un vrai point de toucher. On garde
// tous les personnages, et quatre portraits devant les autres parties de la cible.
function accessoryFallback(
  characters: CrowdCharacter[], wanted: CrowdCharacter, region: AccessoryRegion, desired: number, range: PileVisibilityRange, rng: Rng, area: Area,
): CrowdCharacter[] {
  const half = area.size / 2;
  const margin = Math.min(area.w / 2, area.h / 2, area.size * 2);
  const target = { ...wanted, x: Math.max(margin, Math.min(area.w - margin, wanted.x)), y: Math.max(margin, Math.min(area.h - margin, wanted.y)) };
  const protectedRegion = translateAccessoryRegion(region, target.x - wanted.x, target.y - wanted.y);
  const accessoryCenter = { x: (protectedRegion.bounds.left + protectedRegion.bounds.right) / 2, y: (protectedRegion.bounds.top + protectedRegion.bounds.bottom) / 2 };
  const dx = accessoryCenter.x - target.x;
  const dy = accessoryCenter.y - target.y;
  const distance = Math.hypot(dx, dy);
  const innerRadius = area.size * HIT_RADIUS_RATIO - PILE_TOUCH_RADIUS - 1;
  const factor = distance > innerRadius ? innerRadius / distance : 1;
  const touch = { x: target.x + dx * factor, y: target.y + dy * factor };
  const gap = PILE_TOUCH_RADIUS + .5;
  const safe: Bounds = {
    left: Math.min(protectedRegion.bounds.left - .5, touch.x - gap),
    right: Math.max(protectedRegion.bounds.right + .5, touch.x + gap),
    top: Math.min(protectedRegion.bounds.top - .5, touch.y - gap),
    bottom: Math.max(protectedRegion.bounds.bottom + .5, touch.y + gap),
  };
  const occluders = characters.filter((character) => isAbove(character, wanted) && !character.isBackground).slice(0, 4);
  const chosen = new Set(occluders.map((character) => character.id));
  const radius = area.size * HIT_RADIUS_RATIO;
  const result = characters.map((character) => {
    if (character.id === target.id) return target;
    if (chosen.has(character.id) || !isAbove(character, target)
      || distanceToSprite(target, character, area.size) > radius && !portraitOverlapsRegion(character, area.size, protectedRegion)) return character;
    let point = { x: target.x < area.w / 2 ? area.w - half : half, y: target.y < area.h / 2 ? area.h - half : half };
    for (let attempt = 0; attempt < 32; attempt++) {
      const candidate = { x: half + rng.next() * (area.w - area.size), y: half + rng.next() * (area.h - area.size) };
      const moved = { ...character, ...candidate };
      if (distanceToSprite(target, moved, area.size) > radius && !portraitOverlapsRegion(moved, area.size, protectedRegion)) {
        point = candidate;
        break;
      }
    }
    return { ...character, ...point };
  });
  const blockersAt = (expansion: number) => occluders.map((character, index) => {
    // Le rectangle du bloqueur est entier et orienté comme la foule classique.
    // Un portrait tourné occupe une enveloppe plus grande, également prise en compte.
    const extent = area.size * character.look.scale / 2 * (Math.abs(Math.cos(character.look.rotation)) + Math.abs(Math.sin(character.look.rotation)));
    const positions = [
      { x: safe.left - expansion - extent, y: target.y },
      { x: safe.right + expansion + extent, y: target.y },
      { x: target.x, y: safe.top - expansion - extent },
      { x: target.x, y: safe.bottom + expansion + extent },
    ];
    return { ...character,
      x: Math.max(extent, Math.min(area.w - extent, positions[index].x)),
      y: Math.max(extent, Math.min(area.h - extent, positions[index].y)),
    };
  });
  let low = 0;
  let high = area.size;
  let blockers = blockersAt(0);
  const initialRatio = visibleRatio(target, blockers, area.size);
  let error = initialRatio >= range.min && initialRatio <= range.max ? Math.abs(initialRatio - desired) : Infinity;
  for (let step = 0; step < 20; step++) {
    const expansion = (low + high) / 2;
    const candidates = blockersAt(expansion);
    const ratio = visibleRatio(target, candidates, area.size);
    if (ratio >= range.min && ratio <= range.max && Math.abs(ratio - desired) < error) { blockers = candidates; error = Math.abs(ratio - desired); }
    if (ratio < desired) low = expansion;
    else high = expansion;
  }
  const placed = new Map(blockers.map((blocker) => [blocker.id, blocker]));
  return result.map((character) => placed.get(character.id) ?? character);
}

// Cherche une cachette dans la foule existante, sans dégager tout le centre de
// la cible. La graine renouvelle à la fois son emplacement et son degré de masquage.
export function placeHiddenPileTarget(
  characters: CrowdCharacter[], wanted: CrowdCharacter, range: PileVisibilityRange, rng: Rng, area: Area,
): CrowdCharacter[] {
  const desired = range.min + rng.next() * (range.max - range.min);
  const above = characters.filter((character) => isAbove(character, wanted));
  const accessoryRegion = accessoryRegionFor(wanted, area.size);
  const half = area.size * wanted.look.scale / 2 * (Math.abs(Math.cos(wanted.look.rotation)) + Math.abs(Math.sin(wanted.look.rotation)));
  const clamp = (point: Point, margin = half): Point => ({
    x: Math.max(margin, Math.min(area.w - margin, point.x)),
    y: Math.max(margin, Math.min(area.h - margin, point.y)),
  });
  let best: CrowdCharacter | undefined;
  let bestError = Infinity;
  for (let attempt = 0; attempt < 160; attempt++) {
    let point: Point;
    if (attempt === 0) point = wanted;
    else if (above.length && attempt % 3 !== 0) {
      const neighbour = rng.pick(above);
      const angle = rng.next() * Math.PI * 2;
      const distance = area.size * (.15 + rng.next());
      point = clamp({ x: neighbour.x + Math.cos(angle) * distance, y: neighbour.y + Math.sin(angle) * distance });
    } else point = clamp({ x: rng.next() * area.w, y: rng.next() * area.h });
    const candidate = { ...wanted, ...point };
    if (accessoryRegion) {
      const region = translateAccessoryRegion(accessoryRegion, candidate.x - wanted.x, candidate.y - wanted.y);
      if (!regionInside(region, area) || above.some((character) => portraitOverlapsRegion(character, area.size, region))) continue;
    }
    const blockers = blockersNear(above, candidate, area.size);
    const ratio = visibleRatio(candidate, blockers, area.size);
    const error = Math.abs(ratio - desired);
    if (ratio < range.min || ratio > range.max || error >= bestError || !clearTouchPoint(candidate, blockers, area.size)) continue;
    best = candidate;
    bestError = error;
    if (error < .015) break;
  }
  if (best) {
    const target = best;
    return characters.map((character) => character.id === wanted.id ? target : character);
  }

  if (accessoryRegion) return accessoryFallback(characters, wanted, accessoryRegion, desired, range, rng, area);

  // Rare cas sans ouverture exploitable : ménage un seul bord du portrait.
  // On conserve tous les animaux et on laisse un leurre recouvrir la cible,
  // au lieu de supprimer les bloqueurs ou de rendre le centre toujours libre.
  const occluder = above.find((character) => !character.isBackground)
    ?? characters.find((character) => !character.isWanted && !character.isBackground);
  if (!occluder) return characters;
  const target = { ...wanted, ...clamp(wanted, area.size * 1.5) };
  const radius = area.size * HIT_RADIUS_RATIO;
  const result = characters.map((character) => {
    if (character.id === wanted.id) return target;
    if (character.id === occluder.id || !isAbove(character, target)
      || distanceToSprite(target, character, area.size) > radius) return character;
    let point: Point = {
      x: target.x < area.w / 2 ? area.w - half : half,
      y: target.y < area.h / 2 ? area.h - half : half,
    };
    for (let attempt = 0; attempt < 64; attempt++) {
      const candidate = clamp({ x: rng.next() * area.w, y: rng.next() * area.h });
      if (distanceToSprite(target, { ...character, ...candidate }, area.size) > radius) {
        point = candidate;
        break;
      }
    }
    return { ...character, ...point };
  });
  let low = -radius;
  let high = radius;
  let blocker = { ...occluder, y: target.y, zIndex: Math.max(occluder.zIndex, target.zIndex + 1) };
  for (let step = 0; step < 20; step++) {
    const edge = (low + high) / 2;
    blocker = { ...blocker, x: target.x + area.size * blocker.look.scale / 2 + edge };
    const ratio = visibleRatio(target, [blocker], area.size);
    if (ratio >= range.min && ratio <= range.max && Math.abs(ratio - desired) < .005) break;
    if (ratio < desired) low = edge;
    else high = edge;
  }
  return result.map((character) => character.id === blocker.id ? blocker : character);
}
