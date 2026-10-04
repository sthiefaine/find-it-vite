import { DEFAULT_TIER, defaultSave, FRAME_IDS, PLAYER_TIERS, Save, SAVE_VERSION } from "./schema";
import type { FrameId, PlayerTier, SaveDaily } from "./schema";

type RawObject = Record<string, unknown>;

// Migrations d'une version à la suivante : migrations[1] transforme une v1 en v2, etc.
const migrations: Record<number, (data: RawObject) => RawObject> = {
  // v2 : ajout du profil « Qui joue ? », pas encore choisi
  1: (data) => ({ ...data, version: 2, profile: { tier: null } }),
  // v3 : mécaniques découvertes, aucune pour un joueur existant
  2: (data) => ({ ...data, version: 3, seenMechanics: [] }),
  // v4 : réglages calme/cadre, Aventure, collection et défi du jour vierges
  3: (data) => ({
    ...data,
    version: 4,
    settings: { ...(isObject(data.settings) ? data.settings : {}), calm: false, frame: "classic" },
    adventure: { stars: {} },
    collection: {},
    daily: null,
  }),
  // v5 : plus de « Qui joue ? » au lancement ; profil absent ou Expert (retiré) → Normal
  4: (data) => {
    const profile = isObject(data.profile) ? data.profile : {};
    return { ...data, version: 5, profile: { ...profile, tier: toPlayerTier(profile.tier) } };
  },
};

// Seuls Enfant (easy) et Normal sont proposés : tout le reste devient Normal
const toPlayerTier = (tier: unknown): PlayerTier =>
  PLAYER_TIERS.includes(tier as PlayerTier) ? (tier as PlayerTier) : DEFAULT_TIER;

const isObject = (value: unknown): value is RawObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parse(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readVersion(data: unknown): number | null {
  if (!isObject(data)) return null;
  const { version } = data;
  return typeof version === "number" && Number.isInteger(version) && version > 0
    ? version
    : null;
}

// Version de la donnée brute, ou null si illisible
export function getSaveVersion(raw: unknown): number | null {
  return readVersion(parse(raw));
}

export function isFutureVersion(raw: unknown): boolean {
  const version = getSaveVersion(raw);
  return version !== null && version > SAVE_VERSION;
}

const count = (value: unknown, fallback: number, min = 0) =>
  typeof value === "number" && Number.isFinite(value) && value >= min
    ? Math.floor(value)
    : fallback;

const STARS_KEY = /^[a-z]+:([1-9]\d*)$/;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeStars(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!STARS_KEY.test(key)) continue;
    const stars = count(value, -1);
    if (stars >= 0) out[key] = Math.min(3, stars);
  }
  return out;
}

function sanitizeCollection(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(raw)) return out;
  for (const [name, value] of Object.entries(raw)) {
    const n = count(value, 0);
    if (name.length > 0 && n > 0) out[name] = n;
  }
  return out;
}

function sanitizeDaily(raw: unknown): SaveDaily | null {
  if (!isObject(raw) || typeof raw.date !== "string" || !DATE_ISO.test(raw.date)) return null;
  return { date: raw.date, best: count(raw.best, 0), played: count(raw.played, 0) };
}

// Garde les champs valides, remplace les autres par la valeur par défaut
function sanitize(data: RawObject): Save {
  const base = defaultSave();
  const settings = isObject(data.settings) ? data.settings : {};
  const progress = isObject(data.progress) ? data.progress : {};
  const profile = isObject(data.profile) ? data.profile : {};
  return {
    version: SAVE_VERSION,
    settings: {
      sound:
        typeof settings.sound === "boolean" ? settings.sound : base.settings.sound,
      calm: typeof settings.calm === "boolean" ? settings.calm : base.settings.calm,
      frame: FRAME_IDS.includes(settings.frame as FrameId)
        ? (settings.frame as FrameId)
        : base.settings.frame,
    },
    progress: {
      bestScore: count(progress.bestScore, base.progress.bestScore),
      bestLevel: count(progress.bestLevel, base.progress.bestLevel, 1),
      gamesPlayed: count(progress.gamesPlayed, base.progress.gamesPlayed),
      totalFound: count(progress.totalFound, base.progress.totalFound),
    },
    profile: { tier: toPlayerTier(profile.tier) },
    seenMechanics: Array.isArray(data.seenMechanics)
      ? [...new Set(data.seenMechanics.filter((m): m is string => typeof m === "string" && m.length > 0))]
      : [],
    adventure: { stars: sanitizeStars(isObject(data.adventure) ? data.adventure.stars : null) },
    collection: sanitizeCollection(data.collection),
    daily: sanitizeDaily(data.daily),
  };
}

// Accepte la chaîne JSON stockée ou l'objet déjà lu.
// Une version future est lue au mieux (sans être réécrite : voir isFutureVersion).
export function migrate(raw: unknown): Save {
  let data = parse(raw);
  let version = readVersion(data);
  if (!isObject(data) || version === null) return defaultSave();

  while (version < SAVE_VERSION) {
    const step = migrations[version];
    if (!step) return defaultSave();
    try {
      data = step(data as RawObject);
    } catch {
      return defaultSave();
    }
    version++;
  }
  return sanitize(data as RawObject);
}
