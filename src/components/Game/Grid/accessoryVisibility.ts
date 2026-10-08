import { getAccessory, getAccessoryBox } from "../../../content/accessories";
import type { Look } from "./crowd";

export type Point = { x: number; y: number };
export type Bounds = { left: number; right: number; top: number; bottom: number };
type Portrait = Point & { imageSrc: string; look: Look };
export type AccessoryRegion = { corners: readonly Point[]; bounds: Bounds };

export function boundsOf(points: readonly Point[]): Bounds {
  return {
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}

function worldPoint(character: Portrait, size: number, x: number, y: number): Point {
  const dx = (x - .5) * size * character.look.scale * (character.look.flip ? -1 : 1);
  const dy = (y - .5) * size * character.look.scale;
  const cos = Math.cos(character.look.rotation);
  const sin = Math.sin(character.look.rotation);
  return { x: character.x + dx * cos - dy * sin, y: character.y + dx * sin + dy * cos };
}

// Même rectangle ajusté à l'animal et même transformation que CrowdSprite.
// Le rectangle entier est protégé : une fine tranche d'une visière ne suffit pas.
export function accessoryRegionFor(character: Portrait, size: number): AccessoryRegion | undefined {
  const accessory = getAccessory(character.look.accessoryId);
  if (!accessory) return undefined;
  const box = getAccessoryBox(accessory, character.imageSrc);
  const corners = [
    worldPoint(character, size, box.x, box.y),
    worldPoint(character, size, box.x + box.width, box.y),
    worldPoint(character, size, box.x + box.width, box.y + box.height),
    worldPoint(character, size, box.x, box.y + box.height),
  ];
  return { corners, bounds: boundsOf(corners) };
}

export function translateAccessoryRegion(region: AccessoryRegion, dx: number, dy: number): AccessoryRegion {
  return {
    corners: region.corners.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    bounds: { left: region.bounds.left + dx, right: region.bounds.right + dx, top: region.bounds.top + dy, bottom: region.bounds.bottom + dy },
  };
}

export function regionInside(region: AccessoryRegion, area: { w: number; h: number }): boolean {
  return region.bounds.left >= 0 && region.bounds.right <= area.w && region.bounds.top >= 0 && region.bounds.bottom <= area.h;
}

export function portraitDistanceTo(point: Point, character: Portrait, size: number): number {
  if (character.look.rotation === 0) {
    const half = size * character.look.scale / 2;
    return Math.hypot(Math.max(0, Math.abs(point.x - character.x) - half), Math.max(0, Math.abs(point.y - character.y) - half));
  }
  const cos = Math.cos(character.look.rotation);
  const sin = Math.sin(character.look.rotation);
  const dx = point.x - character.x;
  const dy = point.y - character.y;
  const half = size * character.look.scale / 2;
  return Math.hypot(Math.max(0, Math.abs(dx * cos + dy * sin) - half), Math.max(0, Math.abs(-dx * sin + dy * cos) - half));
}

// Séparation de rectangles orientés, avec rejet rapide des carrés éloignés.
// Les accessoires restent dans le portrait : ce test inclut donc aussi ceux du bloqueur.
export function portraitOverlapsRegion(character: Portrait, size: number, region: AccessoryRegion): boolean {
  const half = size * character.look.scale / 2;
  const cos = Math.cos(character.look.rotation);
  const sin = Math.sin(character.look.rotation);
  const extent = half * (Math.abs(cos) + Math.abs(sin));
  if (character.x + extent <= region.bounds.left || character.x - extent >= region.bounds.right
    || character.y + extent <= region.bounds.top || character.y - extent >= region.bounds.bottom) return false;
  const corners = [worldPoint(character, size, 0, 0), worldPoint(character, size, 1, 0), worldPoint(character, size, 1, 1), worldPoint(character, size, 0, 1)];
  for (const polygon of [corners, region.corners]) {
    for (let index = 0; index < 2; index++) {
      const a = polygon[index];
      const b = polygon[index + 1];
      const axis = { x: a.y - b.y, y: b.x - a.x };
      const first = corners.map((point) => point.x * axis.x + point.y * axis.y);
      const second = region.corners.map((point) => point.x * axis.x + point.y * axis.y);
      if (Math.max(...first) <= Math.min(...second) + 1e-8 || Math.max(...second) <= Math.min(...first) + 1e-8) return false;
    }
  }
  return true;
}
