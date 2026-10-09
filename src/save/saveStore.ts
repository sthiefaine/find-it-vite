import { create } from "zustand";
import { defaultSave, Save, SAVE_KEY, SAVE_VERSION, starsKey } from "./schema";
import type { FrameId, PlayerTier } from "./schema";
import { getSaveVersion, migrate } from "./migrations";
import type { StorageAdapter } from "./storage";
import { platformStorage } from "../platform/storage";
import { isPerson, isPersonUnlocked, PERSON_PRICE } from "../content/personUnlocks";
import { dailyRewardClaimed, dailyRewardPerson, DAILY_REWARD_TARGET, DAILY_COMPLETE_COLLECTION_STARS } from "../game/dailyReward";
import type { CharacterDetails } from "../helpers/characters";

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
  setProfileTier: (tier: PlayerTier) => void;
  markMechanicsSeen: (mechanics: string[]) => void;
  setCalm: (calm: boolean) => void;
  setFrame: (frame: FrameId) => void;
  recordStars: (worldId: string, level: number, stars: number) => void;
  recordCollection: (name: string, n?: number) => void;
  purchasePerson: (id: string) => PurchaseResult;
  awardStreakBonus: (stars: number) => number;
  claimDailyReward: (date: string, found: number) => DailyRewardOutcome | null;
  recordOnlineScore: (matchId: string, score: number) => void;
  recordDaily: (dateISO: string, score: number) => void;
  flush: () => Promise<void>;
  reset: () => Promise<void>;
  // efface toute la progression (alias de reset)
  resetSave: () => Promise<void>;
};

export type SaveStore = SaveState & SaveActions;
export type PurchaseResult = "purchased" | "already-unlocked" | "not-enough-stars" | "unknown-character" | "unavailable";
export type DailyRewardOutcome = { person: CharacterDetails | null; stars: number };

export function applyPersonPurchase(save: Save, id: string): { save: Save; result: PurchaseResult } {
  if (!isPerson(id)) return { save, result: "unknown-character" };
  if (isPersonUnlocked(save, id)) return { save, result: "already-unlocked" };
  if (save.wallet.stars < PERSON_PRICE) return { save, result: "not-enough-stars" };
  return { result: "purchased", save: { ...save, wallet: { ...save.wallet, stars: save.wallet.stars - PERSON_PRICE }, purchasedPeople: [...save.purchasedPeople, id] } };
}

export function applyDailyReward(save: Save, date: string, found: number): { save: Save; reward: DailyRewardOutcome | null } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isSafeInteger(found) || found < DAILY_REWARD_TARGET || dailyRewardClaimed(save, date)) return { save, reward: null };
  const person = dailyRewardPerson(save, date);
  const stars = person ? 0 : DAILY_COMPLETE_COLLECTION_STARS;
  return { reward: { person, stars }, save: {
    ...save,
    dailyRewards: { ...save.dailyRewards, [date]: person?.name ?? null },
    purchasedPeople: person ? [...save.purchasedPeople, person.name] : save.purchasedPeople,
    wallet: { ...save.wallet, stars: Math.min(Number.MAX_SAFE_INTEGER, save.wallet.stars + stars) },
  } };
}

export function applyOnlineScore(save: Save, matchId: string, score: number): Save {
  if (!/^[A-Z0-9]+:[a-f0-9]+$/.test(matchId) || matchId.length >= 80 || !Number.isSafeInteger(score) || score < 0) return save;
  const previous = save.wallet.onlineRewards[matchId] ?? 0;
  if (score <= previous) return save;
  const onlineRewards = Object.fromEntries([...Object.entries(save.wallet.onlineRewards).filter(([id]) => id !== matchId), [matchId, score]].slice(-100));
  return { ...save, wallet: { stars: Math.min(Number.MAX_SAFE_INTEGER, save.wallet.stars + score - previous), onlineRewards } };
}

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

// Garde le meilleur nombre d'étoiles (0 à 3) d'un niveau d'Aventure
export function applyStars(save: Save, worldId: string, level: number, stars: number): Save {
  const key = starsKey(worldId, level);
  const value = Math.max(0, Math.min(3, Math.floor(stars)));
  const previous = save.adventure.stars[key];
  if (!Number.isFinite(value) || (previous !== undefined && previous >= value)) return save;
  return { ...save, adventure: { ...save.adventure, stars: { ...save.adventure.stars, [key]: value } } };
}

export function applyCollection(save: Save, name: string, n = 1): Save {
  const add = Math.floor(n);
  if (!name || !Number.isSafeInteger(add) || !(add > 0)) return save;
  return { ...save, collection: { ...save.collection, [name]: (save.collection[name] ?? 0) + add },
    wallet: { ...save.wallet, stars: Math.min(Number.MAX_SAFE_INTEGER, save.wallet.stars + add) } };
}

// Défi du jour : meilleur score et nombre de parties, remis à zéro chaque nouveau jour
export function applyDaily(save: Save, dateISO: string, score: number): Save {
  const s = Math.max(0, Math.floor(score) || 0);
  const daily = save.daily;
  if (daily && daily.date === dateISO) {
    return { ...save, daily: { date: dateISO, best: Math.max(daily.best, s), played: daily.played + 1 } };
  }
  return { ...save, daily: { date: dateISO, best: s, played: 1 } };
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

    const update = (save: Save) => {
      if (save === get().save) return;
      set({ save });
      scheduleWrite();
    };

    const reset = async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      set({ save: defaultSave(), readOnly: false });
      await storage.remove(SAVE_KEY);
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

      setProfileTier: (tier) => {
        if (get().save.profile.tier === tier) return;
        set({ save: { ...get().save, profile: { ...get().save.profile, tier } } });
        scheduleWrite();
      },

      markMechanicsSeen: (mechanics) => {
        const seen = get().save.seenMechanics;
        const added = mechanics.filter((m, i) => !seen.includes(m) && mechanics.indexOf(m) === i);
        if (added.length === 0) return;
        set({ save: { ...get().save, seenMechanics: [...seen, ...added] } });
        scheduleWrite();
      },

      setCalm: (calm) => {
        if (get().save.settings.calm === calm) return;
        set({ save: { ...get().save, settings: { ...get().save.settings, calm } } });
        scheduleWrite();
      },

      setFrame: (frame) => {
        if (get().save.settings.frame === frame) return;
        set({ save: { ...get().save, settings: { ...get().save.settings, frame } } });
        scheduleWrite();
      },

      recordStars: (worldId, level, stars) => update(applyStars(get().save, worldId, level, stars)),
      recordCollection: (name, n = 1) => update(applyCollection(get().save, name, n)),
      purchasePerson: (id) => {
        if (!get().loaded || get().readOnly) return "unavailable";
        const purchase = applyPersonPurchase(get().save, id);
        update(purchase.save);
        return purchase.result;
      },
      awardStreakBonus: (stars) => {
        if (!get().loaded || get().readOnly || (stars !== 5 && stars !== 10)) return 0;
        const save = get().save;
        update({ ...save, wallet: { ...save.wallet, stars: Math.min(Number.MAX_SAFE_INTEGER, save.wallet.stars + stars) } });
        return stars;
      },
      claimDailyReward: (date, found) => {
        if (!get().loaded || get().readOnly) return null;
        const result = applyDailyReward(get().save, date, found);
        update(result.save);
        return result.reward;
      },
      recordOnlineScore: (matchId, score) => update(applyOnlineScore(get().save, matchId, score)),
      recordDaily: (dateISO, score) => update(applyDaily(get().save, dateISO, score)),

      flush: () => (timer ? write() : Promise.resolve()),

      reset,
      resetSave: reset,
    };
  });
}

// localStorage sur le web, Preferences dans l'app native
export const useSaveStore = createSaveStore(platformStorage());

if (typeof window !== "undefined") {
  void useSaveStore.getState().load();
  // le navigateur mobile peut tuer l'onglet sans prévenir : on écrit tout de suite
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void useSaveStore.getState().flush();
  });
}
