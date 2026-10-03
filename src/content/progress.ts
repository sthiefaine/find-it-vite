// Progression du joueur, calculée à partir de la sauvegarde (fonctions pures).
import type { FrameId, Save } from "../save/schema";
import { starsKey } from "../save/schema";
import { getWorld, LEVELS_PER_WORLD } from "./worlds";
import type { World } from "./worlds";

export type { FrameId };
export type Mastery = "none" | "caught" | "bronze" | "silver" | "gold";

type StarsSave = Pick<Save, "adventure">;

export function totalStars(save: StarsSave): number {
  return Object.values(save.adventure.stars).reduce((sum, s) => sum + s, 0);
}

export function starsFor(save: StarsSave, worldId: string, level: number): number {
  return save.adventure.stars[starsKey(worldId, level)] ?? 0;
}

export function isWorldUnlocked(save: StarsSave, world: World): boolean {
  return totalStars(save) >= world.unlockStars;
}

// Niveau 1 d'un monde ouvert, ou niveau précédent réussi (1★ au moins)
export function isLevelUnlocked(save: StarsSave, worldId: string, level: number): boolean {
  const world = getWorld(worldId);
  if (!world || !Number.isInteger(level) || level < 1 || level > LEVELS_PER_WORLD) return false;
  if (!isWorldUnlocked(save, world)) return false;
  return level === 1 || starsFor(save, worldId, level - 1) >= 1;
}

export function masteryOf(count: number): Mastery {
  if (count >= 10) return "gold";
  if (count >= 6) return "silver";
  if (count >= 3) return "bronze";
  if (count >= 1) return "caught";
  return "none";
}

export const FRAMES: { id: FrameId; name: string; unlockStars: number }[] = [
  { id: "classic", name: "Classique", unlockStars: 0 },
  { id: "neon", name: "Néon", unlockStars: 10 },
  { id: "gold", name: "Or", unlockStars: 25 },
  { id: "ice", name: "Glace", unlockStars: 40 },
];

export function isFrameUnlocked(save: StarsSave, id: FrameId): boolean {
  const frame = FRAMES.find((f) => f.id === id);
  return frame !== undefined && totalStars(save) >= frame.unlockStars;
}

// Date locale au format AAAA-MM-JJ
export function todayISO(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
