// Variantes de foule : « tous pareils » et « deux espèces », combinées aux trois
// plans d'accessoires (A : un seul porte l'accessoire, B : la cible n'a rien,
// C : tout le monde est habillé). Logique pure et déterministe.
import { ACCESSORIES } from "../content/accessories";
import { animalConfusionRisk, animalSimilarity } from "../engine/animalSimilarity";
import { visualConfusionBudget } from "../engine/curve";
import { createRng, hash32, weightedPick } from "../engine/rng";
import type { Rng } from "../engine/rng";
import type { CrowdDress, CrowdSpecies, CrowdVariant, Layout, LevelSpec, Tier } from "../engine/types";
import type { CharacterDetails } from "../helpers/characters";

export type CrowdVariantKind = `${CrowdSpecies}-${CrowdDress}`;
export const CROWD_VARIANT_KINDS: readonly CrowdVariantKind[] = [
  "same-single", "two-single", "same-bare", "two-bare", "same-mixed", "two-mixed",
];
export const isCrowdVariantKind = (value: string): value is CrowdVariantKind =>
  (CROWD_VARIANT_KINDS as readonly string[]).includes(value);

// Aperçu de développement : /game?seed=42&level=30&variant=same-bare
export function readVariantPreview(search: string, development: boolean): CrowdVariantKind | undefined {
  if (!development) return undefined;
  const value = new URLSearchParams(search).get("variant");
  return value && isCrowdVariantKind(value) ? value : undefined;
}

export const kindOfVariant = (variant: CrowdVariant): CrowdVariantKind => `${variant.species}-${variant.dress}`;
const parseKind = (kind: CrowdVariantKind) => {
  const [species, dress] = kind.split("-") as [CrowdSpecies, CrowdDress];
  return { species, dress };
};

// Arrivée progressive en Normal/Expert ; Enfant découvre chaque variante dix niveaux plus tard.
const UNLOCK: Record<CrowdVariantKind, number> = {
  "same-single": 15, "two-single": 20, "same-bare": 25, "two-bare": 25, "same-mixed": 35, "two-mixed": 35,
};
export const EASY_VARIANT_DELAY = 10;
export const variantUnlockedAt = (kind: CrowdVariantKind, tier: Tier) =>
  UNLOCK[kind] + (tier === "easy" ? EASY_VARIANT_DELAY : 0);

// Probabilité qu'un niveau éligible utilise une variante : elle monte avec le niveau.
export function crowdVariantChance(index: number, tier: Tier): number {
  const first = variantUnlockedAt("same-single", tier);
  if (index < first) return 0;
  const [start, cap] = tier === "easy" ? [.35, .55] : tier === "expert" ? [.5, .75] : [.45, .7];
  return Math.min(cap, start + (index - first) * .004);
}

// Suite de parties : graine et rang d'avis consécutifs (Infini : l'index ; Aventure : le
// compteur d'avis de la partie, car les cinq avis d'une étape partagent le même index).
export type VariantStream = { seed: number; position: number };

// Positions groupées par trois : les cases 0 et 2 d'un triplet piochent dans une moitié
// des variantes, la case 1 dans l'autre. Trois positions consécutives couvrent toujours
// deux cases d'un même triplet, de moitiés différentes ou non adjacentes : une même
// variante ne revient donc jamais trois fois de suite.
export function crowdVariantAt(
  index: number, tier: Tier, layout: Layout, stream: VariantStream, breather = false,
): CrowdVariantKind | undefined {
  if (breather) return undefined;
  const position = Math.max(1, Math.floor(stream.position));
  const triad = Math.floor((position - 1) / 3);
  const slot = (position - 1) % 3;
  const order = createRng(hash32("crowd-variant", stream.seed >>> 0, triad)).shuffle(CROWD_VARIANT_KINDS);
  const group = slot === 1 ? order.slice(3) : order.slice(0, 3);
  const own = createRng(hash32("crowd-variant", stream.seed >>> 0, "position", position));
  if (!own.chance(crowdVariantChance(index, tier))) return undefined;
  // Les tas se chevauchent : un chapeau caché ferait passer un leurre pour « sans accessoire ».
  const candidates = group.filter((kind) => index >= variantUnlockedAt(kind, tier)
    && !((layout === "pile" || layout === "swarm") && kind.endsWith("-bare")));
  // Une variante toute neuve sort plus souvent pendant ses dix premiers niveaux.
  return weightedPick(own, candidates.map((kind) => [kind, 1 + 2 * Math.max(0, 1 - (index - variantUnlockedAt(kind, tier)) / 10)] as const));
}

// Sosie de la cible autorisé à ce niveau (selon le budget de confusion), sinon l'animal le plus proche.
export function pickPartner(wanted: CharacterDetails, pool: CharacterDetails[], rng: Rng, index: number, tier: Tier): CharacterDetails | undefined {
  const budget = visualConfusionBudget(index, tier);
  const allowed = budget.close > 0 ? 3 : budget.breed > 0 ? 2 : budget.related > 0 ? 1 : 0;
  const ranked = pool.filter((animal) => animal.name !== wanted.name)
    .map((animal) => ({ animal, risk: animalConfusionRisk(wanted, animal), score: animalSimilarity(wanted, animal) }));
  if (!ranked.length) return undefined;
  const permitted = ranked.filter(({ risk }) => risk <= allowed);
  const usable = permitted.length ? permitted : ranked.filter(({ risk }) => risk === Math.min(...ranked.map((r) => r.risk)));
  const value = ({ risk, score }: { risk: number; score: number }) => risk * 100 + score;
  const best = Math.max(...usable.map(value));
  return rng.pick(usable.filter((entry) => value(entry) >= best - 1)).animal;
}

// Applique une variante à une spec classique. Sans sosie possible, la spec reste classique.
export function applyCrowdVariant(spec: LevelSpec, kind: CrowdVariantKind, pool: CharacterDetails[], tier: Tier): LevelSpec {
  if (spec.rule !== "classic" || spec.wanted.serie === "flags") return spec;
  const rng = createRng(spec.seed).fork("crowd-variant");
  const { species, dress } = parseKind(kind);
  // Une tenue cachée dans un tas ou un essaim ferait passer un leurre pour la
  // cible nue. Cette combinaison reste aussi interdite dans les aperçus forcés.
  if (dress === "bare" && (spec.layout === "pile" || spec.layout === "swarm")) return spec;
  const partner = species === "two" ? pickPartner(spec.wanted, pool, rng.fork("partner"), spec.index, tier) : undefined;
  if (species === "two" && !partner) return spec;
  // Variantes lisibles : la cible n'est jamais cachée sous la foule, et pas de demi-têtes
  // coupées quand l'absence d'accessoire est l'indice.
  const params = { ...spec.params };
  delete params.wantedBelow;
  delete params.pileVisibility;
  if (dress === "bare") {
    delete params.edgeRows;
    if (spec.layout === "scroll") params.extraLines = 0;
    else delete params.extraLines;
    delete params.staggered;
    // Des vagues rapprochent les rangées : une moustache ou un nœud peut être
    // caché par le voisin même quand les positions de départ sont sûres.
    if (params.movement === "wave") params.movement = "linear";
  }
  return {
    ...spec,
    params,
    decoys: partner ? [spec.wanted, partner] : [spec.wanted],
    crowdVariant: { species, dress, ...(partner ? { partner: partner.name } : {}) },
    accessories: { target: dress === "bare" ? null : rng.pick(ACCESSORIES).id, decoyChance: 1 },
  };
}
