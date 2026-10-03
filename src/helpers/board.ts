import { BOARD } from "../engine/types";

// Plateau réel à l'écran. Le moteur raisonne sur un plateau logique 390×520 :
// tout ce qui vient d'une LevelSpec (spriteSize, vitesses en px) est multiplié par `scale`.
export type Board = { width: number; height: number; scale: number };

const HEADER_AND_BUTTONS = 256; // en-tête (avis de recherche) + barre de boutons, en px

export function getBoard(): Board {
  const width = Math.min(window.innerWidth, 450);
  const idealHeight = (width * BOARD.h) / BOARD.w;
  const available = Math.max(width, window.innerHeight - HEADER_AND_BUTTONS);
  const height = Math.floor(Math.min(idealHeight, available));
  return { width, height, scale: width / BOARD.w };
}
