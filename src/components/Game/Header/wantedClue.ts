import type { AccessoryId } from "../../../content/accessories";
import type { LevelSpec } from "../../../engine/types";

const ACCESSORY_CLUES: Record<AccessoryId, string> = {
  cap: "Avec une casquette",
  "bucket-hat": "Avec un bob",
  sunglasses: "Avec des lunettes de soleil",
  "bow-tie": "Avec un nœud papillon",
  moustache: "Avec une fausse moustache",
  "clown-nose": "Avec un nez de clown",
};

// Dans une foule de sosies, le nom seul ne décrit pas la cible unique.
export function wantedClue(spec: Pick<LevelSpec, "rule" | "crowdVariant" | "accessories"> | null): string | undefined {
  if (spec?.rule !== "classic" || !spec.crowdVariant) return undefined;
  if (spec.crowdVariant.dress === "bare") return "Sans accessoire";
  const target = spec.accessories?.target;
  return target ? ACCESSORY_CLUES[target] : undefined;
}
