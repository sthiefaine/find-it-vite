// Test de toucher commun à toutes les grilles.
// Les sprites ne reçoivent plus d'événements : un seul pointerdown sur la scène
// appelle pickCharacterAt avec la liste des persos affichés.

export type HitCandidate = {
  id: number;
  cx: number; // centre en px (repère du canvas)
  cy: number;
  size: number; // taille affichée du sprite en px
  z: number; // ordre d'affichage : plus grand = dessiné au-dessus
  isWanted: boolean;
};

// Les têtes occupent ~85 % du carré de l'image : on teste un disque, pas le carré.
export const HIT_RADIUS_RATIO = 0.42;

export function isInside(x: number, y: number, c: HitCandidate, extra = 0) {
  const r = c.size * HIT_RADIUS_RATIO + extra;
  const dx = x - c.cx;
  const dy = y - c.cy;
  return dx * dx + dy * dy <= r * r;
}

// Priorité au perso recherché : si le doigt est sur lui (même en partie caché),
// c'est lui qui est touché. Sinon, le perso le plus haut sous le doigt.
// Un toucher dans le vide ne renvoie rien (aucune pénalité).
export function pickCharacterAt<T extends HitCandidate>(
  x: number,
  y: number,
  candidates: readonly T[],
  wantedTolerance = 6
): T | null {
  let best: T | null = null;
  for (const c of candidates) {
    if (c.isWanted && isInside(x, y, c, wantedTolerance)) return c;
    if (isInside(x, y, c) && (!best || c.z >= best.z)) best = c;
  }
  return best;
}
