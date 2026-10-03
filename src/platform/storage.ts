import { Preferences } from "@capacitor/preferences";
import { localStorageAdapter } from "../save/storage";
import type { StorageAdapter } from "../save/storage";
import { isNative } from "./native";

// Stockage natif : la WebView peut vider son localStorage, pas les Preferences
export const preferencesAdapter: StorageAdapter = {
  async get(key) {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      await Preferences.set({ key, value });
    } catch {
      // stockage indisponible : on joue sans sauvegarde
    }
  },
  async remove(key) {
    try {
      await Preferences.remove({ key });
    } catch {
      // idem
    }
  },
};

export function platformStorage(): StorageAdapter {
  return isNative() ? preferencesAdapter : localStorageAdapter;
}
