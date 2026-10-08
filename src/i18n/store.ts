import { create } from "zustand";
import { platformStorage } from "../platform/storage";
import type { StorageAdapter } from "../save/storage";
import { isLocale, type Locale } from "./locales";

export const LANGUAGE_KEY = "find-it:language:v1";

// Independent of progress, so choosing a language never migrates or resets a save.
export function createLanguageStore(storage: StorageAdapter) {
  let revision = 0;
  let writes = Promise.resolve();
  return create<{
    locale: Locale;
    load: () => Promise<void>;
    setLocale: (locale: Locale) => void;
    flush: () => Promise<void>;
  }>((set) => ({
    locale: "fr",
    load: async () => {
      const startedAt = revision;
      try {
        const value = await storage.get(LANGUAGE_KEY);
        if (revision === startedAt && isLocale(value)) set({ locale: value });
      } catch { /* Play normally when storage is unavailable. */ }
    },
    setLocale: (locale) => {
      if (!isLocale(locale)) return;
      revision++;
      set({ locale });
      // Serialize writes so rapid changes cannot persist an older selection.
      writes = writes.then(() => storage.set(LANGUAGE_KEY, locale)).catch(() => undefined);
    },
    flush: () => writes,
  }));
}

export const useLanguageStore = createLanguageStore(platformStorage());
if (typeof window !== "undefined") void useLanguageStore.getState().load();
