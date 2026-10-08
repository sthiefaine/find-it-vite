import { ADVENTURE_WORLD_IDS, DEFAULT_TIER, defaultSave, FRAME_IDS, PLAYER_TIERS, Save, SAVE_VERSION } from "./schema";
import type { FrameId, PlayerTier, SaveDaily } from "./schema";
import { validPurchasedPeople } from "../content/personUnlocks";

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
  // v6 : mondes ouverts par l'étape 10 du précédent ; ceux déjà ouverts avec
  // l'ancienne règle (total d'étoiles) restent ouverts
  5: (data) => {
    const adventure = isObject(data.adventure) ? data.adventure : {};
    const total = Object.values(sanitizeStars(adventure.stars)).reduce((a, b) => a + b, 0);
    const unlocked = Object.entries(LEGACY_UNLOCK_STARS)
      .filter(([, need]) => total >= need)
      .map(([id]) => id);
    return { ...data, version: 6, adventure: { ...adventure, unlocked } };
  },
  // v7 : la campagne passe de 10 à 20 étapes par monde. Ne refermer aucun monde
  // déjà ouvert, y compris une sauvegarde qui n'a conservé que ses étoiles.
  6: (data) => {
    const adventure = isObject(data.adventure) ? data.adventure : {};
    const stars = sanitizeStars(adventure.stars);
    const unlocked = new Set(sanitizeUnlocked(adventure.unlocked));
    for (let i = 1; i < ADVENTURE_WORLD_IDS.length; i++) {
      const world = ADVENTURE_WORLD_IDS[i];
      const prior = ADVENTURE_WORLD_IDS[i - 1];
      const alreadyPlayed = Object.entries(stars).some(([key, value]) => key.startsWith(`${world}:`) && value > 0);
      if ((stars[`${prior}:10`] ?? 0) > 0 || alreadyPlayed) unlocked.add(world);
    }
    return { ...data, version: 7, adventure: { ...adventure, stars, unlocked: [...unlocked] } };
  },
  7: (data) => {
    const collection = sanitizeCollection(data.collection);
    const stars = Object.values(collection).reduce((sum, value) => Math.min(Number.MAX_SAFE_INTEGER, sum + value), 0);
    return { ...data, version: 8, wallet: { stars, onlineRewards: {} }, purchasedPeople: [] };
  },
};

// Ancienne règle (v5) : étoiles à réunir pour ouvrir chaque monde
const LEGACY_UNLOCK_STARS: Record<string, number> = { ocean: 12, dinos: 24, halloween: 36, espace: 48 };

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

function sanitizeUnlocked(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return ADVENTURE_WORLD_IDS.filter((id) => raw.includes(id));
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
  const wallet = isObject(data.wallet) ? data.wallet : {};
  const onlineRewards = isObject(wallet.onlineRewards) ? Object.fromEntries(Object.entries(wallet.onlineRewards)
    .filter(([id, value]) => /^[A-Z0-9]+:[a-f0-9]+$/.test(id) && id.length < 80 && Number.isSafeInteger(value) && (value as number) >= 0)
    .slice(-100)) as Record<string, number> : {};
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
    adventure: {
      stars: sanitizeStars(isObject(data.adventure) ? data.adventure.stars : null),
      unlocked: sanitizeUnlocked(isObject(data.adventure) ? data.adventure.unlocked : null),
    },
    collection: sanitizeCollection(data.collection),
    daily: sanitizeDaily(data.daily),
    wallet: { stars: Math.min(Number.MAX_SAFE_INTEGER, count(wallet.stars, 0)), onlineRewards },
    purchasedPeople: validPurchasedPeople(data.purchasedPeople),
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
