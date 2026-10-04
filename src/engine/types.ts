// Contrat du moteur de niveaux : TypeScript pur, sans React, Pixi ni DOM.
import type { CharacterDetails } from "../helpers/characters";
import type { AccessoryPlan } from "../game/accessories";

export const GEN_VERSION = 1;

// Plateau logique de référence (le renderer met à l'échelle de l'écran)
export const BOARD = { w: 390, h: 520 } as const;

// Taille d'une tête en px logiques : celle du jeu d'origine (ancien CELL_SIZE = 45).
// Fixe pour toutes les dispositions et tous les tiers : la difficulté ne joue pas dessus.
export const SPRITE_SIZE = 45;

// Disposition de la foule (les 4 grilles existantes)
export type Layout = "grid" | "scroll" | "pile" | "swarm";

// Ce que le joueur doit faire
export type Rule =
  | "classic" // trouver le perso de l'avis
  | "memory" // l'avis se retourne après quelques secondes
  | "silhouette" // l'avis montre une ombre
  | "oddOneOut" // tous identiques sauf un (à l'envers / teinté)
  | "findAll" // trouver les N exemplaires
  | "goldRush"; // bonus : toucher un maximum de persos dorés

// Ce qui gêne, combinable avec une règle
export type Modifier = "flashlight" | "lookalikes";

// Place du niveau dans une zone de 10
export type Slot = "intro" | "normal" | "breather" | "boss";

export type Tier = "easy" | "normal" | "expert";

export type GameMode = "endless" | "daily" | "adventure";

export type MovementPattern = "linear" | "wave" | "stopGo" | "orbit" | "crossing" | "scatter";

// Variantes de foule (toujours une seule cible) :
// - species "same" : toute la foule est de l'espèce recherchée ; "two" : elle et un sosie ;
// - dress "single" (A) : seule la cible porte l'accessoire de l'avis parmi son espèce ;
//   "bare" (B) : toute son espèce est habillée sauf la cible, qui n'a rien ;
//   "mixed" (C) : toute la foule est habillée, son espèce porte d'autres accessoires.
export type CrowdSpecies = "same" | "two";
export type CrowdDress = "single" | "bare" | "mixed";
export type CrowdVariant = { species: CrowdSpecies; dress: CrowdDress; partner?: string };

export type LevelScene = {
  id: string;
  name: string;
  hint: string;
  background: string;
  accent: string;
  foliage?: "light" | "dense";
  seagulls: boolean;
};

export type LayoutParams = {
  movement?: MovementPattern;
  // grid
  gridSize?: number; // côté de la grille (gridSize × gridSize)
  fullGrid?: boolean; // remplit le plateau rectangulaire avec des têtes à taille fixe
  staggered?: boolean; // fullGrid : rangées en quinconce, demi-leurres sur les côtés
  // scroll
  scrollDirection?: "horizontal" | "vertical";
  alternateDirection?: boolean;
  extraLines?: number;
  edgeRows?: boolean; // demi-rangées supplémentaires aux deux bords transverses
  scrollFill?: number; // occupation des cases, de 0.15 à 1 ; absent = foule historique
  // pile + swarm
  count?: number; // nombre de persos
  backgroundGrid?: boolean;
  jitter?: number;
  wantedBelow?: boolean; // le recherché peut être partiellement recouvert
  pileVisibility?: { min: number; max: number }; // part visible variable quand la cible est sous la foule
  // scroll + swarm : vitesse en px par frame à 60 fps (≈ ancienne échelle)
  speed?: number;
  edgeBehavior?: "bounce" | "wrap";
};

export interface LevelSpec {
  accessories?: AccessoryPlan;
  crowdVariant?: CrowdVariant; // foule à une ou deux espèces ; decoys contient alors le recherché
  scene?: LevelScene;
  genVersion: number;
  seed: number; // graine du niveau (dérivée de la graine de partie + index)
  index: number; // numéro du niveau dans la partie, à partir de 1
  zone: number; // bloc de 10 niveaux (1, 2, …)
  slot: Slot;
  layout: Layout;
  rule: Rule;
  modifiers: Modifier[];
  wanted: CharacterDetails;
  // Leurres possibles, avec répétition : un perso présent 3 fois sort 3 fois plus souvent
  decoys: CharacterDetails[];
  params: LayoutParams;
  spriteSize: number; // taille d'une tête en px logiques
  findCount: number; // nombre d'exemplaires à trouver (findAll), 1 sinon
  rewardS: number; // secondes gagnées sur une bonne réponse
  penaltyS: number; // secondes perdues sur une erreur
  durationS?: number; // durée imposée (goldRush)
  lookalikeRatio?: number; // part ρ des leurres pris dans la famille du recherché
  budget?: number; // budget de difficulté utilisé (debug)
}

export interface GenContext {
  seed: number; // graine de la partie
  tier: Tier;
  pool: CharacterDetails[]; // persos disponibles (thème / déblocages)
  allowedRules?: Rule[]; // règles débloquées (par défaut : toutes)
  allowedModifiers?: Modifier[];
}
