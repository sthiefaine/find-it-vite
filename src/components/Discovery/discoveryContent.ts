import type { Layout, LevelSpec, Modifier, Rule } from "../../engine/types";
import {
  MODIFIER_HINT,
  MODIFIER_ICON,
  RULE_HINT,
  RULE_ICON,
  mechanicsOf,
} from "../../engine/rules";

export type Gesture = "tap" | "swipe";
export type DiscoveryContent = { icon: string; hint: string; gesture: Gesture };

const LAYOUT_CONTENT: Record<Layout, { icon: string; hint: string }> = {
  grid: { icon: "🔍", hint: RULE_HINT.classic },
  scroll: { icon: "🎢", hint: "Ils défilent !" },
  pile: { icon: "🥞", hint: "Ils sont tous en tas !" },
  swarm: { icon: "🐝", hint: "Ils bougent !" },
};

// Espace insécable avant « ! » et « ? » pour ne pas les laisser seuls à la ligne
export const nbsp = (text: string) => text.replace(/ ([!?])/g, "\u00a0$1");

// Ce qu'on présente : une règle ou un modificateur NOUVEAU en priorité,
// sinon la disposition nouvelle. Une mécanique déjà vue n'est jamais montrée
// (sauf si rien n'est nouveau : alors la première mécanique du niveau).
export function discoveryContent(
  spec: LevelSpec,
  freshMechanics: readonly string[] = mechanicsOf(spec)
): DiscoveryContent {
  const fresh = mechanicsOf(spec).filter((m) => freshMechanics.includes(m));
  const pool = fresh.length > 0 ? fresh : mechanicsOf(spec);
  const main = pool.find((m) => !m.startsWith("layout:")) ?? pool[0];
  const [kind, value] = main.split(":");
  if (kind === "rule") {
    const rule = value as Rule;
    const icon = rule === "findAll" ? `×${spec.findCount}` : RULE_ICON[rule];
    return { icon, hint: RULE_HINT[rule], gesture: "tap" };
  }
  if (kind === "modifier") {
    const mod = value as Modifier;
    return {
      icon: MODIFIER_ICON[mod],
      hint: MODIFIER_HINT[mod],
      gesture: mod === "flashlight" ? "swipe" : "tap",
    };
  }
  return { ...LAYOUT_CONTENT[spec.layout], gesture: "tap" };
}
