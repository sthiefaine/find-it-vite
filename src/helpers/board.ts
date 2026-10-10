import { BOARD } from "../engine/types";

// Plateau réel à l'écran. Tout le placement se fait sur le plateau logique FIXE BOARD
// (390×520), quelle que soit la taille de l'écran : même graine ⇒ même plateau.
// Le rendu est ensuite mis à l'échelle uniformément (× scale) et centré.
export type Board = { width: number; height: number; scale: number };

const HEADER_AND_BUTTONS = 286; // estimation initiale ; la partie mesure ensuite son espace réel
const MAX_WIDTH = 450;

// L'espace réservé au plateau par le layout, après l'en-tête, les commandes et les insets.
// La géométrie logique reste fixe ; seul le rendu et les coordonnées de toucher changent.
export function boardWithin(availableW: number, availableH: number): Board {
  const width = Math.max(1, Math.min(availableW, MAX_WIDTH));
  const height = Math.max(1, availableH);
  const scale = Math.min(width / BOARD.w, height / BOARD.h);
  return { width: BOARD.w * scale, height: BOARD.h * scale, scale };
}

// Fonction pure : plateau pour une fenêtre de viewW × viewH px CSS
export function boardFor(viewW: number, viewH: number): Board {
  return boardWithin(viewW, viewH - HEADER_AND_BUTTONS);
}

export function getBoard(): Board {
  const style = getComputedStyle(document.documentElement);
  const inset = (side: string) => parseFloat(style.getPropertyValue(`--safe-${side}`)) || 0;
  return boardFor(
    window.innerWidth - inset("left") - inset("right"),
    window.innerHeight - inset("top") - inset("bottom"),
  );
}
