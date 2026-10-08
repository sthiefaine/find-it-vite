import { generateLevel } from "../engine/generateLevel";
import { difficultyFloor } from "../engine/difficultyFloor";
import { createRng, hash32 } from "../engine/rng";
import type { GenContext, LayoutParams, LevelScene, LevelSpec, MovementPattern, Tier } from "../engine/types";
import { LIMITS } from "../engine/validate";
import { ADVANCED_SCENES, SCENES, sceneForIndex, type SceneDefinition } from "../content/scenes";
import { planAccessories } from "./accessories";
import { applyCrowdVariant, crowdVariantAt } from "./crowdVariants";
import type { CrowdVariantKind, VariantStream } from "./crowdVariants";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const rounded = (n: number) => Math.round(n * 100) / 100;

// Dispersion (« scatter ») : chacun part dans sa direction. À partir de 20 en Normal
// (30 en Enfant) ; avant, une scène de dispersion garde un défilé linéaire.
export const SCATTER_FROM = { easy: 30, normal: 20, expert: 20 } as const;

type ScrollPlayback = Pick<LayoutParams, "movement" | "scrollDirection" | "alternateDirection">;

// Une reprise conserve sa densité et ses obstacles, mais renouvelle le trajet.
// Le premier cycle avancé et le mode Enfant gardent leur mise en scène d'origine.
export function scrollPlaybackFor(scene: SceneDefinition, index: number, tier: Tier): ScrollPlayback {
  const original: ScrollPlayback = {
    movement: scene.movement,
    scrollDirection: scene.direction ?? "horizontal",
    alternateDirection: scene.alternate ?? false,
  };
  const cycle = Math.floor((index - SCENES.length - 1) / ADVANCED_SCENES.length);
  if (tier === "easy" || cycle < 1) return original;
  // Une parade linéaire devient alternativement une vague ou une marche-arrêt ;
  // les scènes qui introduisent ces motifs conservent leur identité.
  const movement = original.movement === "linear"
    ? (hash32("scroll-replay", scene.id) + cycle) % 2 === 0 ? "wave" : "stopGo"
    : original.movement;
  return {
    movement,
    // L'axe est conservé : le pivoter enlèverait des cases à certaines reprises.
    scrollDirection: original.scrollDirection,
    alternateDirection: original.alternateDirection || cycle % 3 !== 0,
  };
}

// Mouvement d'une foule mobile. Après le premier cycle de reprises, les traversées et défilés deviennent
// de plus en plus souvent des rondes ou des dispersions (tirage fixe par niveau).
export function swarmMovementFor(scene: SceneDefinition, index: number, tier: Tier): MovementPattern | undefined {
  const start = SCATTER_FROM[tier];
  if (scene.movement === "scatter") return index >= start ? "scatter" : "linear";
  // Le premier cycle avancé (41–56) présente chaque foule telle quelle.
  if (scene.layout !== "swarm" || index <= 56 || scene.movement === "orbit") return scene.movement;
  const ramp = Math.min(.35, (index - 56) / 200);
  const roll = createRng(hash32("swarm-movement", scene.id, index)).next();
  if (index >= start && roll < ramp) return "scatter";
  if (roll < 2 * ramp) return "orbit";
  return scene.movement;
}

export function sceneParams(scene: SceneDefinition, index: number, tier: Tier): LayoutParams {
  const easy = tier === "easy";
  const floor = difficultyFloor(index, tier, scene.breather);
  // Les reprises restent bornées et les respirations conservent leur faible densité.
  const replay = scene.breather ? 0 : Math.min(.12, Math.floor((index - 1) / 40) * .03);
  const density = clamp((scene.density + replay) * (easy ? .68 : tier === "expert" ? 1.18 : 1), 0, 1);
  switch (scene.layout) {
    case "grid": {
      const max = easy ? (index === 1 ? LIMITS.grid.maxEasyLevel1 : LIMITS.grid.maxEasy) : LIMITS.grid.max;
      const fullGrid = !easy && (scene.fullGrid || floor.fullGrid);
      return {
        gridSize: clamp(Math.max(Math.round(3 + density * 7), floor.gridSize), 3, max),
        ...(fullGrid ? { fullGrid: true, staggered: scene.staggered ?? false } : {}),
      };
    }
    case "scroll":
      return {
        ...scrollPlaybackFor(scene, index, tier),
        speed: clamp(Math.max(rounded(.4 + density * 1.25), floor.scrollSpeed), LIMITS.scroll.speedMin, easy ? LIMITS.scroll.speedMaxEasy : LIMITS.scroll.speedMax),
        // Les trois premières découvertes restent aérées ; ensuite les lignes
        // retrouvent leur occupation historique, même en vagues ou en arrêts.
        scrollFill: scene.fullRows || index >= 13 ? 1
          : clamp(Math.max(easy ? .21 + density * .45 : .33 + density * .75, floor.scrollFill), .15, 1),
        extraLines: clamp(Math.max(Math.floor(density * 4), floor.extraLines), scene.edgeRows && !easy ? 1 : 0, LIMITS.scroll.extraLinesMax),
        ...(scene.edgeRows && !easy ? { edgeRows: true } : {}),
      };
    case "pile": {
      const raw = Math.round(easy || index < 20 ? 30 + density * 130 : 120 + density * 220);
      const count = clamp(Math.max(raw, floor.pileCount), LIMITS.pile.countMin, LIMITS.pile.countMax);
      const wantedBelow = !easy && index >= LIMITS.pile.wantedBelowFrom && !scene.foliage;
      return {
        count,
        jitter: rounded(2 + density * 4),
        wantedBelow,
        ...(wantedBelow ? { pileVisibility: tier === "expert" ? { min: .15, max: .5 } : { min: .18, max: .65 } } : {}),
        backgroundGrid: !easy && count >= LIMITS.pile.backgroundGridFrom,
      };
    }
    case "swarm": {
      const movement = swarmMovementFor(scene, index, tier);
      // Les rondes sont plus denses et s'accélèrent un peu avec le niveau.
      const raw = easy ? 20 + density * 55
        : movement === "orbit" ? (index >= 20 ? 75 + density * 120 : 40 + density * 100)
          : movement === "crossing" ? (index <= 40 ? 34 + density * 65 : 60 + density * 85)
            : movement === "scatter" ? 50 + density * 100
              : 32 + density * 88;
      const boost = !easy && movement === "orbit" ? Math.min(.1, Math.max(0, index - 20) * .002) : 0;
      return {
        movement,
        count: clamp(Math.round(Math.max(raw, floor.swarmCount)), LIMITS.swarm.countMin, easy ? LIMITS.swarm.countMaxEasy : LIMITS.swarm.countMax),
        speed: clamp(Math.max(rounded(.2 + density * .5 + boost), floor.swarmSpeed), LIMITS.swarm.speedMin, easy ? LIMITS.swarm.speedMaxEasy : LIMITS.swarm.speedMax),
        edgeBehavior: "bounce",
      };
    }
  }
}

export type PlayableOptions = {
  // Rang de l'avis dans la partie (par défaut : la graine et l'index du niveau)
  variantStream?: VariantStream;
  // false : jamais de variante de foule (salons en ligne : l'avis distant n'a pas le badge)
  crowdVariants?: boolean;
  // Aperçu de développement : impose une variante (hors respirations comprises)
  forceVariant?: CrowdVariantKind;
};

// La difficulté vient de la foule et de la visibilité. L'objectif reste toujours
// de retrouver l'unique animal de l'avis, dans tous les modes du jeu.
export function generatePlayableLevel(index: number, context: GenContext, options: PlayableOptions = {}): LevelSpec {
  const definition = sceneForIndex(index);
  const easy = context.tier === "easy";
  const params = sceneParams(definition, index, context.tier);
  const spec = generateLevel(index, {
    ...context,
    allowedRules: ["classic"],
    // Feuillage et oiseaux assurent les changements de visibilité. Aucun écran noir
    // ne s'ajoute à ces obstacles, et les respirations n'ajoutent pas de sosies.
    allowedModifiers: definition.breather ? [] : (context.allowedModifiers ?? ["lookalikes"]).filter((m) => m !== "flashlight"),
  });
  const scene: LevelScene = {
    id: definition.id, name: definition.name,
    hint: definition.layout === "scroll" && !easy && index > SCENES.length + ADVANCED_SCENES.length
      ? params.movement === "stopGo" ? "Profite des arrêts des rangées."
        : params.movement === "wave" ? "Suis les animaux dans les vagues."
          : "Suis les rangées qui se croisent."
      : definition.hint,
    background: definition.background, accent: definition.accent,
    foliage: easy && definition.foliage === "dense" ? "light" : definition.foliage,
    // Enfant découvre chaque obstacle, mais n'a jamais à les cumuler.
    seagulls: definition.seagulls && !(easy && definition.foliage),
  };
  const playable = { ...spec, scene, layout: definition.layout, params };
  // Les lunettes et coiffures des personnalités font partie de leur identité.
  // Les déguisements restent réservés aux portraits animaliers.
  if (spec.wanted.serie === "politics") return { ...playable, scene: { ...scene,
    hint: scene.foliage ? "Écarte les avocats et les CRS pour retrouver le portrait."
      : scene.seagulls ? "Retrouve le portrait entre les passages de foule."
        : "Retrouve le portrait de l’avis de recherche.",
  } };
  const kind = options.forceVariant ?? (options.crowdVariants === false ? undefined
    : crowdVariantAt(index, context.tier, definition.layout, options.variantStream ?? { seed: context.seed, position: index }, definition.breather));
  if (kind && playable.rule === "classic") {
    const varied = applyCrowdVariant(playable, kind, context.pool, context.tier);
    if (varied.crowdVariant) return varied;
  }
  const accessories = planAccessories(playable, context.tier, Boolean(definition.breather));
  return accessories ? { ...playable, accessories } : playable;
}
