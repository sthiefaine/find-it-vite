import { defaultSave, Save, SAVE_VERSION, TIERS } from "./schema";
import type { Tier } from "../engine/types";

type RawObject = Record<string, unknown>;

// Migrations d'une version à la suivante : migrations[1] transforme une v1 en v2, etc.
const migrations: Record<number, (data: RawObject) => RawObject> = {
  // v2 : ajout du profil « Qui joue ? », pas encore choisi
  1: (data) => ({ ...data, version: 2, profile: { tier: null } }),
  // v3 : mécaniques découvertes, aucune pour un joueur existant
  2: (data) => ({ ...data, version: 3, seenMechanics: [] }),
};

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

// Garde les champs valides, remplace les autres par la valeur par défaut
function sanitize(data: RawObject): Save {
  const base = defaultSave();
  const settings = isObject(data.settings) ? data.settings : {};
  const progress = isObject(data.progress) ? data.progress : {};
  const profile = isObject(data.profile) ? data.profile : {};
  const tier = TIERS.includes(profile.tier as Tier) ? (profile.tier as Tier) : null;
  return {
    version: SAVE_VERSION,
    settings: {
      sound:
        typeof settings.sound === "boolean" ? settings.sound : base.settings.sound,
    },
    progress: {
      bestScore: count(progress.bestScore, base.progress.bestScore),
      bestLevel: count(progress.bestLevel, base.progress.bestLevel, 1),
      gamesPlayed: count(progress.gamesPlayed, base.progress.gamesPlayed),
      totalFound: count(progress.totalFound, base.progress.totalFound),
    },
    profile: { tier },
    seenMechanics: Array.isArray(data.seenMechanics)
      ? [...new Set(data.seenMechanics.filter((m): m is string => typeof m === "string" && m.length > 0))]
      : [],
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
