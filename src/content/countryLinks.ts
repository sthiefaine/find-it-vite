import type { CountryLink } from "../helpers/characters";
import { REGION_CODES } from "../i18n/regions";

const countryCodes = new Set(Object.values(REGION_CODES));

export function isCountryLink(value: unknown): value is CountryLink {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const link = value as Record<string, unknown>;
  if (typeof link.code !== "string" || !/^[A-Z]{2}$/.test(link.code) || !countryCodes.has(link.code)) return false;
  if (typeof link.relation !== "string" || !link.relation.trim() || link.relation.length > 240) return false;
  if (typeof link.sourceUrl !== "string" || link.sourceUrl.length > 2048 || !/^https:\/\//i.test(link.sourceUrl)) return false;
  try { return new URL(link.sourceUrl).protocol === "https:"; } catch { return false; }
}

/** Validate and copy only the documented fields; preserve the source's description. */
export function validatedCountryLinks(value: unknown): CountryLink[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every(isCountryLink)) throw new Error("Les liens pays doivent contenir un code pays à deux lettres, une relation documentée et une source HTTPS.");
  return value.map(({ code, relation, sourceUrl }) => ({ code, relation: relation.trim(), sourceUrl }));
}
