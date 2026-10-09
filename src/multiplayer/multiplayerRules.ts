import { layoutGrid, layoutScroll, placePile, placeSwarm } from "../components/Game/Grid/layouts";
import type { LevelSpec } from "../engine/types";
import { generatePlayableLevel } from "../game/playableLevel";
import type { CharacterDetails } from "../helpers/characters";
import type { MultiplayerTheme } from "./protocol";
import { unlockedPeople } from "../content/personUnlocks";
import { PLAY_THEMES, publishedThemePool } from "../content/playThemes";

export const MULTIPLAYER_THEMES: readonly MultiplayerTheme[] = PLAY_THEMES
  .filter(theme => !theme.comingSoon).map(theme => theme.id as MultiplayerTheme);

export function multiplayerPool(theme: MultiplayerTheme, purchasedPeople: readonly string[] = []): CharacterDetails[] {
  const pool = publishedThemePool(theme);
  return PLAY_THEMES.find(item => item.id === theme)?.family === "personnages"
    ? unlockedPeople({ purchasedPeople }, pool) : pool;
}

export function multiplayerLevel(index: number, seed: number, theme: MultiplayerTheme, purchasedPeople: readonly string[] = []): LevelSpec {
  const spec = generatePlayableLevel(index, { seed, tier: "normal", pool: multiplayerPool(theme, purchasedPeople) }, { crowdVariants: false });
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
