import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../components/Game/Grid/layouts";
import type { LevelSpec } from "../engine/types";
import { generatePlayableLevel } from "../game/playableLevel";
import { animalsPack, peoplePack, playableFlagsPack } from "../helpers/characters";
import { getWorld } from "../content/worlds";
import type { CharacterDetails } from "../helpers/characters";
import type { MultiplayerTheme } from "./protocol";

export const MULTIPLAYER_THEMES: readonly MultiplayerTheme[] = ["animaux", "ferme", "foret", "savane", "ocean", "politique", "drapeaux"];

export function multiplayerPool(theme: MultiplayerTheme): CharacterDetails[] {
  if (theme === "politique") return peoplePack;
  if (theme === "drapeaux") return playableFlagsPack;
  if (theme === "ocean") {
    // Emoji portraits are drawn by the browser after receiving the spec. Do not
    // evaluate the DOM-backed getter while serializing on the Node server.
    return (getWorld("ocean")?.characters ?? []).map((animal) => ({ ...animal, imageSrc: "" }));
  }
  return theme === "animaux" ? animalsPack : animalsPack.filter((animal) => animal.tags?.includes(theme));
}

export function multiplayerLevel(index: number, seed: number, theme: MultiplayerTheme): LevelSpec {
  const spec = generatePlayableLevel(index, { seed, tier: "normal", pool: multiplayerPool(theme) }, { crowdVariants: false });
  // Multiplayer owns its clock and renderer, including their independent state.
  // The same four layouts/accessories stay deterministic on both devices.
  return { ...spec, scene: spec.scene ? { ...spec.scene, foliage: undefined, seagulls: false } : undefined };
}

export function levelCharacterIds(spec: LevelSpec): { all: Set<number>; wanted: Set<number> } {
  const characters = spec.layout === "grid" ? layoutGrid(spec).cells
    : spec.layout === "scroll" ? layoutScroll(spec).slots
      : spec.layout === "pile" ? placePile(spec) : placeSwarm(spec);
  return {
    all: new Set(characters.map((character) => character.id)),
    wanted: new Set(characters.filter((character) => character.isWanted).map((character) => character.id)),
  };
}
