export const LANGUAGES = [
  { code: "fr", label: "Français", tag: "fr-FR", flag: "/assets/images/characters/flags/fr.png" },
  { code: "en", label: "English", tag: "en-GB", flag: "/assets/images/characters/flags/gb.png" },
  { code: "pt_BR", label: "Português (Brasil)", tag: "pt-BR", flag: "/assets/images/characters/flags/br.png" },
  { code: "es", label: "Español", tag: "es-ES", flag: "/assets/images/characters/flags/es.png" },
  { code: "it", label: "Italiano", tag: "it-IT", flag: "/assets/images/characters/flags/it.png" },
  { code: "ru", label: "Русский", tag: "ru-RU", flag: "/assets/images/characters/flags/ru.png" },
  { code: "ku", label: "Kurdî (Kurmancî)", tag: "ku-Latn", flag: "/assets/images/languages/kurdistan.svg" },
  { code: "ckb", label: "کوردی (سۆرانی)", tag: "ckb", direction: "rtl", flag: "/assets/images/languages/kurdistan.svg" },
  { code: "zh", label: "中文（简体）", tag: "zh-CN", flag: "/assets/images/characters/flags/cn.png" },
  { code: "de", label: "Deutsch", tag: "de-DE", flag: "/assets/images/characters/flags/de.png" },
] as const;

// Keep the translation-column order above; sort only the visible choices.
export const LANGUAGE_OPTIONS = [...LANGUAGES].sort((left, right) =>
  left.label.localeCompare(right.label, "fr", { sensitivity: "base" }));

export type Locale = typeof LANGUAGES[number]["code"];
export function isLocale(value: unknown): value is Locale {
  return LANGUAGES.some(language => language.code === value);
}
export function localeTag(locale: Locale): string {
  return LANGUAGES.find(language => language.code === locale)!.tag;
}

export const localeDirection = (locale: Locale): "ltr" | "rtl" => locale === "ckb" ? "rtl" : "ltr";
