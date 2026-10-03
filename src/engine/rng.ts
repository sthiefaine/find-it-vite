// Aléatoire déterministe : tout le moteur passe par ici, jamais par Math.random.

export type HashPart = number | string;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a sur chaque partie (séparées), puis finaliseur murmur3 pour bien mélanger les bits.
export function hash32(...parts: HashPart[]): number {
  let h = 0x811c9dc5;
  const feed = (byte: number) => {
    h ^= byte & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  for (const part of parts) {
    if (typeof part === "number") {
      feed(0x4e);
      // entiers sur 32 bits ; les flottants passent par leur représentation texte
      if (Number.isInteger(part) && Math.abs(part) <= 0xffffffff) {
        const v = part >>> 0;
        feed(v);
        feed(v >>> 8);
        feed(v >>> 16);
        feed(v >>> 24);
        if (part < 0) feed(0x2d);
      } else {
        const s = String(part);
        for (let i = 0; i < s.length; i++) feed(s.charCodeAt(i));
      }
    } else {
      feed(0x53);
      for (let i = 0; i < part.length; i++) {
        const c = part.charCodeAt(i);
        feed(c);
        feed(c >>> 8);
      }
    }
    feed(0x7c);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface Rng {
  readonly seed: number;
  next(): number; // [0, 1)
  int(min: number, max: number): number; // bornes incluses
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  chance(p: number): boolean;
  fork(label: HashPart): Rng; // sous-flux indépendant de la consommation du flux courant
}

export function createRng(seed: number): Rng {
  const s = seed >>> 0;
  const next = mulberry32(s);
  const int = (min: number, max: number) => {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return lo + Math.floor(next() * (hi - lo + 1));
  };
  return {
    seed: s,
    next,
    int,
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error("rng.pick: tableau vide");
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle<T>(arr: readonly T[]): T[] {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
    chance(p: number) {
      return next() < p;
    },
    fork(label: HashPart) {
      return createRng(hash32(s, label));
    },
  };
}

// Tirage pondéré (poids ≤ 0 ignorés). Renvoie undefined si tout est nul.
export function weightedPick<T>(rng: Rng, items: readonly (readonly [T, number])[]): T | undefined {
  let total = 0;
  for (const [, w] of items) if (w > 0) total += w;
  if (total <= 0) return undefined;
  let r = rng.next() * total;
  for (const [item, w] of items) {
    if (w <= 0) continue;
    r -= w;
    if (r < 0) return item;
  }
  for (let i = items.length - 1; i >= 0; i--) if (items[i][1] > 0) return items[i][0];
  return undefined;
}

// ─── Seule source non déterministe du moteur : la graine d'une nouvelle partie ───
let fallbackCounter = 0;
export function randomSeed(): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  fallbackCounter++;
  return hash32("fallback", Date.now(), fallbackCounter);
}
// ────────────────────────────────────────────────────────────────────────────────

export function dailySeed(dateISO: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error(`dailySeed: date invalide « ${dateISO} »`);
  return hash32("daily", dateISO);
}

// Base32 de Crockford : pas de I, L, O, U (évite les confusions à la lecture).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 7; // 35 bits ≥ 32 bits de graine

export function seedToCode(seed: number): string {
  let v = seed >>> 0;
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out = ALPHABET[v % 32] + out;
    v = Math.floor(v / 32);
  }
  return out;
}

// Tolère minuscules, espaces, tirets et les confusions O/0, I/L/1. Renvoie null si invalide.
export function seedFromCode(code: string): number | null {
  const clean = code
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (clean.length === 0 || clean.length > CODE_LENGTH) return null;
  let v = 0;
  for (const ch of clean) {
    const d = ALPHABET.indexOf(ch);
    if (d < 0) return null;
    v = v * 32 + d;
  }
  if (v > 0xffffffff) return null;
  return v >>> 0;
}

// Nom demandé dans le cahier des charges : accepte les deux sens.
export function codeFromSeed(seed: number): string;
export function codeFromSeed(code: string): number | null;
export function codeFromSeed(x: number | string): string | number | null {
  return typeof x === "number" ? seedToCode(x) : seedFromCode(x);
}
