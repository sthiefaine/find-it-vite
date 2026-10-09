// Duel shares volume, mute, voice limits and audio lifecycle with the solo game.
import { playLegacySound } from "../../audio/engine";
import { useGameStore } from "../../../store/store";

export function playDuelSound(src: string, volume = 1) {
  if (useGameStore.getState().sound) playLegacySound(src, volume);
}
