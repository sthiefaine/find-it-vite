import { describe, expect, it } from "vitest";
import { applyCollection, applyPortraitPurchase, createSaveStore } from "../../save/saveStore";
import { defaultSave } from "../../save/schema";
import { migrate } from "../../save/migrations";
import { createMemoryStorage } from "../../save/storage";
import { playThemePool } from "../playThemes";
import { isPortraitUnlocked, PORTRAIT_PRICE } from "../portraitUnlocks";
import { caughtCount, unlockedAlbumCount } from "../../pages/Album/albumLogic";

describe("achat de tous les portraits", () => {
  it("débloque un animal en Infini et dans l’album, sans capture ni médaille inventée", () => {
    const save = applyCollection(defaultSave(), "chat", PORTRAIT_PRICE);
    const purchased = applyPortraitPurchase(save, "dauphin");
    expect(purchased.result).toBe("purchased");
    expect(purchased.save.wallet.stars).toBe(0);
    expect(purchased.save.purchasedAnimals).toEqual(["dauphin"]);
    expect(purchased.save.collection.dauphin).toBeUndefined();
    expect(isPortraitUnlocked(purchased.save, "dauphin")).toBe(true);
    expect(playThemePool("endless", "animaux", purchased.save).some(animal => animal.name === "dauphin")).toBe(true);
    expect(unlockedAlbumCount(purchased.save).caught).toBe(unlockedAlbumCount(save).caught + 1);
    expect(caughtCount(purchased.save)).toEqual(caughtCount(save));
    expect(applyPortraitPurchase(purchased.save, "dauphin")).toEqual({ save: purchased.save, result: "already-unlocked" });
  });
  it("protège le solde et conserve les achats de personnages", () => {
    const save = defaultSave();
    for (const [id, result] of [["dauphin", "not-enough-stars"], ["vache", "already-unlocked"], ["inconnu", "unknown-character"]]) {
      expect(applyPortraitPurchase(save, id)).toEqual({ save, result });
    }
    const rich = { ...save, wallet: { ...save.wallet, stars: PORTRAIT_PRICE } };
    expect(applyPortraitPurchase(rich, "hypatie").save.purchasedPeople).toEqual(["hypatie"]);
    expect(applyPortraitPurchase({ ...rich, collection: { dauphin: 1 } }, "dauphin").result).toBe("already-unlocked");
  });
  it("migre les sauvegardes v10 sans retirer d’achat ou de récompense déjà obtenue", () => {
    const previous = { ...defaultSave(), version: 10, wallet: { stars: 25, onlineRewards: {} }, purchasedPeople: ["hypatie"], dailyRewards: { "2026-10-08": "hypatie" } };
    const migrated = migrate(previous);
    expect(migrated).toMatchObject({ purchasedAnimals: [], purchasedPeople: ["hypatie"], wallet: { stars: 25 }, dailyRewards: previous.dailyRewards });
    expect(migrate({ ...migrated, purchasedAnimals: ["dauphin", "dauphin", "vache", "hypatie", "inconnu", 1] }).purchasedAnimals).toEqual(["dauphin"]);
  });
  it("persiste achat et solde et bloque les mutations avant chargement ou en lecture seule", async () => {
    const storage = createMemoryStorage();
    const store = createSaveStore(storage);
    expect(store.getState().purchasePortrait("dauphin")).toBe("unavailable");
    await store.getState().load();
    store.getState().recordCollection("chat", PORTRAIT_PRICE);
    store.setState({ readOnly: true });
    expect(store.getState().purchasePortrait("dauphin")).toBe("unavailable");
    store.setState({ readOnly: false });
    expect(store.getState().purchasePortrait("dauphin")).toBe("purchased");
    await store.getState().flush();
    const restored = createSaveStore(storage);
    await restored.getState().load();
    expect(restored.getState().save.wallet.stars).toBe(0);
    expect(isPortraitUnlocked(restored.getState().save, "dauphin")).toBe(true);
  });
});
