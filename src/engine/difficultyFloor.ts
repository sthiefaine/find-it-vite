// Plancher de difficulté : quelle que soit la densité d'une scène, la foule ne
// redescend jamais sous ce minimum, qui monte avec le niveau. Pur et testable.
import type { Tier } from "./types";
import { LIMITS } from "./validate";

export type DifficultyFloor = {
  gridSize: number; // côté minimal d'une grille compacte
  fullGrid: boolean; // grille pleine imposée (hors Enfant)
  pileCount: number; // persos minimum dans un tas
  swarmCount: number; // persos minimum dans un essaim
  scrollSpeed: number; // vitesse minimale du défilement
  swarmSpeed: number; // vitesse minimale d'une foule mobile
  scrollFill: number; // remplissage minimum des rangées de défilement
  extraLines: number; // rangées supplémentaires minimum en défilement
};

// Un tas Enfant reste lisible : son plancher plafonne bien sous celui du Normal.
const EASY_PILE_FLOOR_MAX = 180;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const rounded = (n: number) => Math.round(n * 100) / 100;

// Normal / Expert : pas de grille sous 6×6 après 10, ni sous 7×7 après 20.
// Enfant monte plus doucement. Les respirations enlèvent les obstacles et les
// accessoires ; elles gardent au moins 7×7 après 20 en Normal / Expert.
export function difficultyFloor(index: number, tier: Tier, breather = false): DifficultyFloor {
  const n = Math.max(1, Math.floor(index));
  const easy = tier === "easy";
  const pace = (easy ? .7 : tier === "expert" ? 1.15 : 1) * (breather ? .85 : 1);
  const speeds = {
    scrollSpeed: clamp(rounded(.4 + .02 * (n - 1) * pace), LIMITS.scroll.speedMin, easy ? LIMITS.scroll.speedMaxEasy : LIMITS.scroll.speedMax),
    swarmSpeed: clamp(rounded(.2 + .008 * (n - 1) * pace), LIMITS.swarm.speedMin, easy ? LIMITS.swarm.speedMaxEasy : LIMITS.swarm.speedMax),
  };
  if (easy) {
    const grid = clamp(3 + Math.floor((n - 1) / 6), 3, n === 1 ? LIMITS.grid.maxEasyLevel1 : LIMITS.grid.maxEasy);
    const light = breather ? .75 : 1;
    return {
      gridSize: breather ? Math.max(n > 20 ? 5 : 3, grid - 1) : grid,
      fullGrid: false,
      pileCount: clamp(Math.round(Math.min(EASY_PILE_FLOOR_MAX, 30 + 2 * (n - 1)) * light), LIMITS.pile.countMin, LIMITS.pile.countMax),
      swarmCount: clamp(Math.round((20 + (n - 1)) * light), LIMITS.swarm.countMin, LIMITS.swarm.countMaxEasy),
      ...speeds,
      scrollFill: clamp(.15 + .03 * n, LIMITS.scroll.fillMin, 1),
      extraLines: clamp(Math.floor((n - 15) / 25) - (breather ? 1 : 0), 0, LIMITS.scroll.extraLinesMax),
    };
  }
  const grid = n <= 10 ? 3 + Math.floor((n - 1) / 3) : n <= 20 ? 6 : n <= 35 ? 7 : LIMITS.grid.max;
  const light = breather ? .75 : 1;
  return {
    gridSize: clamp(breather ? Math.max(n > 20 ? 7 : 3, grid - 1) : grid, 3, LIMITS.grid.max),
    fullGrid: !breather && n > 50,
    pileCount: clamp(Math.round((30 + 4 * (n - 1)) * light), LIMITS.pile.countMin, LIMITS.pile.countMax),
    swarmCount: clamp(Math.round((20 + 2.5 * (n - 1)) * light), LIMITS.swarm.countMin, LIMITS.swarm.countMax),
    ...speeds,
    scrollFill: clamp(.25 + .05 * n, LIMITS.scroll.fillMin, 1),
    extraLines: clamp(n < 20 ? 0 : Math.floor((n - 5) / 15) - (breather ? 1 : 0), 0, LIMITS.scroll.extraLinesMax),
  };
}
