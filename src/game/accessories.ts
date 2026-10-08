import { ACCESSORIES, ACCESSORY_LOOKALIKES, isAccessoryId, type AccessoryId } from "../content/accessories";
import { createRng } from "../engine/rng";
import type { LevelSpec, Tier } from "../engine/types";

// target null : la cible n'a rien (variante B, l'avis l'indique par un badge).
export type AccessoryPlan = { target: AccessoryId | null; decoyChance: number };

export function readAccessoryPreview(search: string, development: boolean): AccessoryId | undefined {
  if (!development) return undefined;
  const value = new URLSearchParams(search).get("accessory");
  return value && isAccessoryId(value) ? value : undefined;
}

export function withAccessoryPreview(spec: LevelSpec, id: AccessoryId | undefined): LevelSpec {
  if (!id || spec.rule !== "classic" || spec.wanted.serie === "flags") return spec;
  // Une variante garde son plan : seule la tenue de la cible change, jamais son absence.
  if (spec.crowdVariant) return spec.crowdVariant.dress === "bare" ? spec : { ...spec, accessories: { target: id, decoyChance: 1 } };
  return { ...spec, accessories: { target: id, decoyChance: .6 } };
}

// Flux séparé : le choix des tenues ne consomme pas l'aléatoire du placement.
// Les dispositions protègent ensuite l'accessoire de la cible si nécessaire.
export function planAccessories(spec: LevelSpec, tier: Tier, breather: boolean): AccessoryPlan | undefined {
  if (spec.wanted.serie === "flags") return undefined;
  const first = tier === "easy" ? 23 : 13;
  if (spec.index < first || breather || spec.rule !== "classic") return undefined;
  const rng = createRng(spec.seed).fork("accessories");
  // Une introduction garantie, puis des passages espacés. Les tas restent sobres.
  const chance = tier === "easy" ? .32 : tier === "expert" ? .8 : .58;
  if (spec.index !== first && !rng.chance(chance)) return undefined;
  const target = rng.pick(ACCESSORIES).id;
  return { target, decoyChance: spec.layout === "pile" ? .32 : tier === "easy" ? .36 : tier === "expert" ? .72 : .52 };
}

type Dressed = {
  id: number;
  isWanted: boolean;
  look: { accessoryId?: AccessoryId };
  character?: { name: string; imageSrc: string };
  imageSrc?: string;
};

const ACCESSORY_IDS = ACCESSORIES.map((accessory) => accessory.id);

// Même espèce que la cible : en cas de doute, on la traite comme telle (contrainte plus forte).
const sameSpeciesAsWanted = (spec: LevelSpec, item: Dressed) =>
  item.character ? item.character.name === spec.wanted.name : item.imageSrc === spec.wanted.imageSrc;

// Variantes de foule. Aucun leurre de l'espèce recherchée ne reproduit l'avis :
// A ni C ne lui donnent l'accessoire de la cible, B l'habille toujours.
function dressVariant<T extends Dressed>(spec: LevelSpec, crowd: T[], target: AccessoryId | null): T[] {
  const variant = spec.crowdVariant!;
  const rng = createRng(spec.seed).fork("variant-crowd");
  const others = ACCESSORY_IDS.filter((id) => id !== target);
  const similar = target ? ACCESSORY_LOOKALIKES[target] : [];
  const pickFor = (item: T): AccessoryId | undefined => {
    if (item.isWanted) return target ?? undefined;
    if (sameSpeciesAsWanted(spec, item)) {
      if (variant.dress === "single") return undefined;
      if (variant.dress === "bare") return rng.pick(ACCESSORY_IDS);
      return similar.length && rng.chance(.4) ? rng.pick(similar) : rng.pick(others);
    }
    // Le sosie peut porter l'accessoire de l'avis : seule l'espèce le trahit.
    if (variant.dress === "single") return target && rng.chance(.5) ? target : undefined;
    if (variant.dress === "bare") return rng.chance(.6) ? rng.pick(ACCESSORY_IDS) : undefined;
    return target && rng.chance(.4) ? target : rng.pick(ACCESSORY_IDS);
  };
  return crowd.map((item) => {
    const accessoryId = pickFor(item);
    if (accessoryId === item.look.accessoryId) return item;
    const look = { ...item.look };
    if (accessoryId) look.accessoryId = accessoryId;
    else delete look.accessoryId;
    return { ...item, look };
  });
}

// Habille une partie de la foule visible. Au moins deux leurres partagent
// l'accessoire recherché : une casquette isolée ne doit pas révéler la cible.
export function dressCrowd<T extends Dressed>(spec: LevelSpec, crowd: T[]): T[] {
  const plan = spec.accessories;
  if (!plan || spec.rule !== "classic") return crowd;
  if (spec.crowdVariant) return dressVariant(spec, crowd, plan.target);
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
