// Sons du duel : jamais bloquants, le jeu marche sans
import { useGameStore } from "../../../store/store";

export function playDuelSound(src: string, volume = 0.6) {
  try {
    if (!useGameStore.getState().sound) return;
    const audio = new Audio(src);
    audio.volume = volume;
    const p = audio.play();
    if (p) p.catch(() => {});
  } catch {
    // pas de son disponible
  }
}
