import { generateLevel } from "../engine/generateLevel";
import type { GenContext, LayoutParams, LevelScene, LevelSpec } from "../engine/types";
import { LIMITS } from "../engine/validate";
import { sceneForIndex } from "../content/scenes";
import type { SceneDefinition } from "../content/scenes";
import { planAccessories } from "./accessories";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const rounded = (n: number) => Math.round(n * 100) / 100;

function sceneParams(scene: SceneDefinition, index: number, easy: boolean): LayoutParams {
  // Les reprises restent bornées et les respirations conservent leur faible densité.
  const replay = scene.breather ? 0 : Math.min(.12, Math.floor((index - 1) / 40) * .03);
  const density = clamp((scene.density + replay) * (easy ? .68 : 1), 0, 1);
  switch (scene.layout) {
    case "grid":
      return { gridSize: clamp(Math.round(3 + density * 7), 3, easy ? (index === 1 ? 3 : LIMITS.grid.maxEasy) : LIMITS.grid.max) };
    case "scroll":
      return {
        movement: scene.movement,
        speed: clamp(rounded(.4 + density * 1.25), LIMITS.scroll.speedMin, easy ? LIMITS.scroll.speedMaxEasy : LIMITS.scroll.speedMax),
        scrollFill: clamp(easy ? .21 + density * .45 : .33 + density * .75, .15, 1),
        extraLines: clamp(Math.floor(density * 4), 0, LIMITS.scroll.extraLinesMax),
        scrollDirection: scene.direction ?? "horizontal",
        alternateDirection: scene.alternate ?? false,
      };
    case "pile":
      return {
        count: Math.round(30 + density * 100),
        jitter: rounded(2 + density * 4),
        wantedBelow: !easy && index >= LIMITS.pile.wantedBelowFrom && !scene.foliage,
        backgroundGrid: false,
      };
    case "swarm":
      return {
        movement: scene.movement,
        count: Math.round(20 + density * 40),
        speed: clamp(rounded(.2 + density * .5), LIMITS.swarm.speedMin, easy ? LIMITS.swarm.speedMaxEasy : LIMITS.swarm.speedMax),
        edgeBehavior: "bounce",
      };
  }
}

// La difficulté vient de la foule et de la visibilité. L'objectif reste toujours
// de retrouver l'unique animal de l'avis, dans tous les modes du jeu.
export function generatePlayableLevel(index: number, context: GenContext): LevelSpec {
  const definition = sceneForIndex(index);
  const easy = context.tier === "easy";
  const spec = generateLevel(index, {
    ...context,
    allowedRules: ["classic"],
    // Feuillage et oiseaux assurent les changements de visibilité. Aucun écran noir
    // ne s'ajoute à ces obstacles, et les respirations n'ajoutent pas de sosies.
    allowedModifiers: definition.breather ? [] : (context.allowedModifiers ?? ["lookalikes"]).filter((m) => m !== "flashlight"),
  });
  const scene: LevelScene = {
    id: definition.id, name: definition.name, hint: definition.hint,
    background: definition.background, accent: definition.accent,
    foliage: easy && definition.foliage === "dense" ? "light" : definition.foliage,
    // Enfant découvre chaque obstacle, mais n'a jamais à les cumuler.
    seagulls: definition.seagulls && !(easy && definition.foliage),
  };
  const playable = { ...spec, scene, layout: definition.layout, params: sceneParams(definition, index, easy) };
  const accessories = planAccessories(playable, context.tier, Boolean(definition.breather));
  return accessories ? { ...playable, accessories } : playable;
}
