import { create } from "zustand";
import { defaultSave, Save, SAVE_KEY, SAVE_VERSION } from "./schema";
import { getSaveVersion, migrate } from "./migrations";
import { localStorageAdapter, StorageAdapter } from "./storage";

export type GameResult = {
  score: number;
  level: number;
  found: number;
};

export type RecordOutcome = {
  isNewRecord: boolean;
  previousBest: number;
  bestScore: number;
};

type SaveState = {
  save: Save;
  loaded: boolean;
  // sauvegarde venant d'une version plus récente du jeu : on ne l'écrase pas
  readOnly: boolean;
};

type SaveActions = {
  load: () => Promise<void>;
  recordGame: (result: GameResult) => RecordOutcome;
  setSound: (sound: boolean) => void;
  flush: () => Promise<void>;
  reset: () => Promise<void>;
};

export type SaveStore = SaveState & SaveActions;

export function applyGameResult(save: Save, result: GameResult): Save {
  const { progress } = save;
  return {
    ...save,
    progress: {
      ...progress,
      bestScore: Math.max(progress.bestScore, result.score),
      bestLevel: Math.max(progress.bestLevel, result.level),
      gamesPlayed: progress.gamesPlayed + 1,
      totalFound: progress.totalFound + Math.max(0, result.found),
    },
  };
}

export function createSaveStore(
  storage: StorageAdapter,
  { debounceMs = 400 }: { debounceMs?: number } = {}
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let loading: Promise<void> | null = null;

  return create<SaveStore>((set, get) => {
    const write = async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (get().readOnly) return;
      await storage.set(SAVE_KEY, JSON.stringify(get().save));
    };

    const scheduleWrite = () => {
      if (get().readOnly) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void write(), debounceMs);
    };

    return {
      save: defaultSave(),
      loaded: false,
      readOnly: false,

      load: () => {
        loading ??= (async () => {
          const raw = await storage.get(SAVE_KEY);
          if (raw === null) {
            set({ loaded: true });
            return;
          }
          const version = getSaveVersion(raw);
          const readOnly = version !== null && version > SAVE_VERSION;
          set({ save: migrate(raw), readOnly, loaded: true });
          // ancienne version migrée : on la réécrit au nouveau format
          if (version !== null && version < SAVE_VERSION) scheduleWrite();
        })();
        return loading;
      },

      recordGame: (result) => {
        const previousBest = get().save.progress.bestScore;
        const save = applyGameResult(get().save, result);
        set({ save });
        scheduleWrite();
        return {
          isNewRecord: result.score > 0 && result.score > previousBest,
          previousBest,
          bestScore: save.progress.bestScore,
        };
      },

      setSound: (sound) => {
        if (get().save.settings.sound === sound) return;
        set({ save: { ...get().save, settings: { ...get().save.settings, sound } } });
        scheduleWrite();
      },

      flush: () => (timer ? write() : Promise.resolve()),

      reset: async () => {
        if (timer) clearTimeout(timer);
        timer = null;
        set({ save: defaultSave(), readOnly: false });
        await storage.remove(SAVE_KEY);
      },
    };
  });
}

export const useSaveStore = createSaveStore(localStorageAdapter);

if (typeof window !== "undefined") {
  void useSaveStore.getState().load();
  // le navigateur mobile peut tuer l'onglet sans prévenir : on écrit tout de suite
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void useSaveStore.getState().flush();
  });
}
