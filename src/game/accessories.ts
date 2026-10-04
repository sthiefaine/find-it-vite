import { ACCESSORIES, isAccessoryId, type AccessoryId } from "../content/accessories";
import { createRng } from "../engine/rng";
import type { LevelSpec, Tier } from "../engine/types";

export type AccessoryPlan = { target: AccessoryId | null; decoyChance: number };

export function readAccessoryPreview(search: string, development: boolean): AccessoryId | undefined {
  if (!development) return undefined;
  const value = new URLSearchParams(search).get("accessory");
  return value && isAccessoryId(value) ? value : undefined;
}

export function withAccessoryPreview(spec: LevelSpec, id: AccessoryId | undefined): LevelSpec {
  return id && spec.rule === "classic" ? { ...spec, accessories: { target: id, decoyChance: .6 } } : spec;
}

// Flux séparé : les tenues ne déplacent jamais la cible ni les autres animaux.
export function planAccessories(spec: LevelSpec, tier: Tier, breather: boolean): AccessoryPlan | undefined {
  const first = tier === "easy" ? 23 : 13;
  if (spec.index < first || breather || spec.rule !== "classic") return undefined;
  const rng = createRng(spec.seed).fork("accessories");
  // Une introduction garantie, puis des passages espacés. Les tas restent sobres.
  const chance = tier === "easy" ? .32 : tier === "expert" ? .8 : .58;
  if (spec.index !== first && !rng.chance(chance)) return undefined;
  const target = rng.pick(ACCESSORIES).id;
  return { target, decoyChance: spec.layout === "pile" ? .32 : tier === "easy" ? .36 : tier === "expert" ? .72 : .52 };
}

type Dressed = { id: number; isWanted: boolean; look: { accessoryId?: AccessoryId } };

// Habille une partie de la foule visible. Au moins deux leurres partagent
// l'accessoire recherché : une casquette isolée ne doit pas révéler la cible.
export function dressCrowd<T extends Dressed>(spec: LevelSpec, crowd: T[]): T[] {
  const plan = spec.accessories;
  if (!plan || spec.rule !== "classic") return crowd;
  const rng = createRng(spec.seed).fork("accessory-crowd");
  const decoys = rng.shuffle(crowd.filter((item) => !item.isWanted));
  const count = Math.min(decoys.length, Math.max(plan.target ? 2 : 0, Math.round(decoys.length * plan.decoyChance)));
  const looks = new Map<number, AccessoryId>();
  decoys.slice(0, count).forEach((item, index) => {
    looks.set(item.id, index < 2 && plan.target ? plan.target : rng.pick(ACCESSORIES).id);
  });
  return crowd.map((item) => {
    const accessoryId = item.isWanted ? plan.target : looks.get(item.id);
    return accessoryId ? { ...item, look: { ...item.look, accessoryId } } : item;
  });
}
