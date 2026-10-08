import { useMemo } from "react";
import { LANGUAGES, localeTag, type Locale } from "./locales";
import { REGION_CODES } from "./regions";
import { messages } from "./messages";
import { useLanguageStore } from "./store";

export type TranslationParams = Record<string, string | number>;
const pluralRules = new Map<Locale, Intl.PluralRules>();
const regionNames = new Map<Locale, Intl.DisplayNames>();

export function translateFor(locale: Locale, key: string, params: TranslationParams = {}): string {
  if (!messages[key] && REGION_CODES[key] && locale !== "fr") {
    try {
      let names = regionNames.get(locale);
      if (!names) {
        names = new Intl.DisplayNames([localeTag(locale)], { type: "region" });
        regionNames.set(locale, names);
      }
      return names.of(REGION_CODES[key]) ?? key;
    } catch { /* Older browsers can keep the original country name. */ }
  }
  const row = messages[key];
  let text = row?.[LANGUAGES.findIndex(language => language.code === locale)] ?? key;
  if (typeof params.count === "number" && text.includes("|")) {
    let rules = pluralRules.get(locale);
    if (!rules) {
      rules = new Intl.PluralRules(localeTag(locale));
      pluralRules.set(locale, rules);
    }
    const forms = text.split("|");
    const category = rules.select(params.count);
    const index = category === "one" ? 0 : locale === "ru" && category === "few" ? 1 : forms.length - 1;
    text = forms[index];
  }
  return text.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder);
}

// For non-React formatters and event handlers. Components subscribe with the hook.
export function translate(key: string, params?: TranslationParams): string {
  return translateFor(useLanguageStore.getState().locale, key, params);
}

export function useTranslation() {
  const locale = useLanguageStore(state => state.locale);
  return useMemo(() => ({
    locale,
    languageTag: localeTag(locale),
    t: (key: string, params?: TranslationParams) => translateFor(locale, key, params),
  }), [locale]);
}
