import type { LevelSpec, Modifier, Rule } from "./types";

// Nombre d'exemplaires « cibles » placés par le renderer (isWanted = true)
export function targetCount(spec: LevelSpec): number {
  switch (spec.rule) {
    case "findAll":
      return Math.max(1, spec.findCount);
    case "goldRush":
      return GOLD_RUSH_TARGETS;
    default:
      return 1;
  }
}

export const GOLD_RUSH_TARGETS = 10;
export const GOLD_TINT = 0xffd54a;

// Le niveau se termine-t-il au premier bon toucher ?
// findAll : quand toutes les cibles sont trouvées ; goldRush : à la fin du chrono du bonus.
export function levelDoneAfter(spec: LevelSpec, found: number): boolean {
  if (spec.rule === "goldRush") return false;
  return found >= targetCount(spec);
}

// Pas de pénalité pendant un bonus
export function hasPenalty(spec: LevelSpec): boolean {
  return spec.rule !== "goldRush";
}

// Icône affichée sur le tampon de l'avis de recherche
export const RULE_ICON: Record<Rule, string> = {
  classic: "⚠️",
  memory: "🧠",
  silhouette: "👤",
  oddOneOut: "≠",
  findAll: "×",
  goldRush: "⭐",
};

export const MODIFIER_ICON: Record<Modifier, string> = {
  flashlight: "🔦",
  lookalikes: "👯",
};

// Consigne très courte (lue à voix haute plus tard), affichée à la découverte
export const RULE_HINT: Record<Rule, string> = {
  classic: "Trouve-le !",
  memory: "Retiens-le bien !",
  silhouette: "Qui est cette ombre ?",
  oddOneOut: "Trouve l'intrus !",
  findAll: "Trouve-les tous !",
  goldRush: "Touche les dorés !",
};

export const MODIFIER_HINT: Record<Modifier, string> = {
  flashlight: "Éclaire avec ton doigt !",
  lookalikes: "Attention aux sosies !",
};

// Mécanique « nouvelle » d'un niveau, pour l'écran de découverte
export function mechanicsOf(spec: LevelSpec): string[] {
  const list: string[] = [`layout:${spec.layout}`];
  if (spec.rule !== "classic") list.push(`rule:${spec.rule}`);
  for (const m of spec.modifiers) if (m !== "lookalikes") list.push(`modifier:${m}`);
  return list;
}
