import { describe, expect, it } from "vitest";
import { historyPack, peoplePack } from "../../helpers/characters";
import { isPersonUnlocked, PERSON_PRICE, STARTER_HISTORY_IDS, STARTER_POLITICAL_IDS, unlockedPeople } from "../personUnlocks";
import { applyCollection, applyOnlineScore, applyPersonPurchase, createSaveStore } from "../../save/saveStore";
import { migrate } from "../../save/migrations";
import { defaultSave } from "../../save/schema";
import { createMemoryStorage } from "../../save/storage";
import { playThemePool } from "../playThemes";
import { isAlbumCharacterUnlocked } from "../../pages/Album/albumLogic";

describe("portraits achetés avec des étoiles", () => {
  it("offre exactement 12 personnages valides et distincts dans chaque thème", () => {
    for (const [ids, pack] of [[STARTER_HISTORY_IDS, historyPack], [STARTER_POLITICAL_IDS, peoplePack]] as const) {
      expect(ids).toHaveLength(12);
      expect(new Set(ids).size).toBe(12);
      expect(ids.every(id => pack.some(person => person.name === id))).toBe(true);
      expect(unlockedPeople(defaultSave(), pack)).toHaveLength(12);
    }
  });
  it("verrouille un portrait non acheté même s’il a déjà été trouvé", () => {
    const save = { ...defaultSave(), collection: { hypatie: 250 } };
    expect(isPersonUnlocked(save, "hypatie")).toBe(false);
    expect(isAlbumCharacterUnlocked(save, historyPack.find(person => person.name === "hypatie")!)).toBe(false);
  });
  it("débite une seule fois et débloque le portrait sans inventer de capture", () => {
    const save = applyCollection(defaultSave(), "chat", PERSON_PRICE);
    const purchase = applyPersonPurchase(save, "hypatie");
    expect(purchase.result).toBe("purchased");
    expect(purchase.save.wallet.stars).toBe(0);
    expect(purchase.save.collection.hypatie).toBeUndefined();
    expect(applyPersonPurchase(purchase.save, "hypatie").save).toBe(purchase.save);
    for (const mode of ["endless", "duel"] as const) expect(playThemePool(mode, "histoire", purchase.save)).toHaveLength(13);
  });
  it("refuse un solde insuffisant, un personnage de départ et un identifiant inconnu", () => {
    for (const [id, result] of [["hypatie", "not-enough-stars"], [STARTER_HISTORY_IDS[0], "already-unlocked"], ["inconnu", "unknown-character"]]) {
      const save = defaultSave();
      expect(applyPersonPurchase(save, id)).toEqual({ save, result });
    }
  });
  it("reprend les trouvailles existantes en monnaie sans transformer les captures en achats", () => {
    const save = migrate({ ...defaultSave(), version: 7, collection: { chat: 40, hypatie: 7 } });
    expect(save.wallet.stars).toBe(47);
    expect(save.purchasedPeople).toEqual([]);
    expect(save.collection.hypatie).toBe(7);
    expect(migrate(save)).toEqual(save);
  });
  it("nettoie les achats invalides et les soldes corrompus", () => {
    const save = migrate({ ...defaultSave(), purchasedPeople: ["hypatie", "hypatie", "chat", "inconnu"], wallet: { stars: -5, onlineRewards: {} } });
    expect(save.purchasedPeople).toEqual(["hypatie"]);
    expect(save.wallet.stars).toBe(0);
  });
  it("ne récompense pas deux fois un score en ligne reçu après reconnexion", () => {
    const first = applyOnlineScore(defaultSave(), "ABCDE:012abc", 5);
    expect(first.wallet.stars).toBe(5);
    expect(applyOnlineScore(first, "ABCDE:012abc", 5)).toBe(first);
    expect(applyOnlineScore(first, "ABCDE:012abc", 6).wallet.stars).toBe(6);
  });
  it("persiste l’achat et son solde après rechargement", async () => {
    const storage = createMemoryStorage();
    const store = createSaveStore(storage);
    await store.getState().load();
    store.getState().recordCollection("chat", PERSON_PRICE);
    expect(store.getState().purchasePerson("hypatie")).toBe("purchased");
    expect(store.getState().purchasePerson("hypatie")).toBe("already-unlocked");
    await store.getState().flush();
    const reloaded = createSaveStore(storage);
    await reloaded.getState().load();
    expect(reloaded.getState().save.purchasedPeople).toEqual(["hypatie"]);
    expect(reloaded.getState().save.wallet.stars).toBe(0);
  });
});
