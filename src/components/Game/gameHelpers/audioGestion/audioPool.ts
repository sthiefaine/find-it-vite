// Logique pure du petit pool d'éléments audio.

// play() interrompu par un nouveau src ou un pause() : à ignorer
export function isPlayInterrupted(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

// Élément à utiliser : le premier libre à partir de `start`, sinon `start` (le plus ancien)
export function nextPoolIndex(free: readonly boolean[], start: number): number {
  const n = free.length;
  if (n === 0) return 0;
  const from = ((start % n) + n) % n;
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n;
    if (free[i]) return i;
  }
  return from;
}
