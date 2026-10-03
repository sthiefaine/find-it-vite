import { BOARD } from "../engine/types";

// Plateau réel à l'écran. Tout le placement se fait sur le plateau logique FIXE BOARD
// (390×520), quelle que soit la taille de l'écran : même graine ⇒ même plateau.
// Le rendu est ensuite mis à l'échelle uniformément (× scale) et centré.
export type Board = { width: number; height: number; scale: number };

const HEADER_AND_BUTTONS = 256; // en-tête (avis de recherche) + barre de boutons, en px
const MAX_WIDTH = 450;

// Fonction pure : plateau pour une fenêtre de viewW × viewH px CSS
export function boardFor(viewW: number, viewH: number): Board {
  const availW = Math.max(1, Math.min(viewW, MAX_WIDTH));
  const availH = Math.max(1, viewH - HEADER_AND_BUTTONS);
  const scale = Math.min(availW / BOARD.w, availH / BOARD.h);
  return { width: BOARD.w * scale, height: BOARD.h * scale, scale };
}

export function getBoard(): Board {
  return boardFor(window.innerWidth, window.innerHeight);
}
