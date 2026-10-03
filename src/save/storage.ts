// Accès asynchrone au stockage, pour pouvoir passer plus tard à IndexedDB
// ou à un stockage natif sans toucher au reste.
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

// localStorage peut être absent ou bloqué (navigation privée, quota…)
export const localStorageAdapter: StorageAdapter = {
  async get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // stockage indisponible : on joue sans sauvegarde
    }
  },
  async remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // idem
    }
  },
};

export function createMemoryStorage(
  initial: Record<string, string> = {}
): StorageAdapter & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
  };
}
