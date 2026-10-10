import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../../../content/sprites/catalog.json";
import { animalsPack, celebritiesPack } from "../../helpers/characters";
import { generatePlayableLevel } from "../../game/playableLevel";
import { multiplayerPool } from "../../multiplayer/multiplayerRules";
import { ALBUM_COLLECTIONS, isAlbumCharacterUnlocked } from "../../pages/Album/albumLogic";
import { defaultSave } from "../../save/schema";
import { applyPersonPurchase } from "../../save/saveStore";
import { validateCatalog } from "../../studio/model";
import { playThemeFromSearch, playThemePool, publishedThemePool, themeOptions } from "../playThemes";
import { isPersonUnlocked, PERSON_PRICE, STARTER_CELEBRITY_IDS, unlockedPeople } from "../personUnlocks";

describe("portraits de célébrités", () => {
  it("publie les portraits validés du catalogue et garde les fiches sans image en brouillon", () => {
    expect(() => validateCatalog(catalog)).not.toThrow();
    const sprites = catalog.sprites.filter(sprite => sprite.themeId === "personnes");
    expect(sprites.length).toBeGreaterThanOrEqual(150);
    expect(new Set(sprites.map(sprite => sprite.id)).size).toBe(sprites.length);
    expect(celebritiesPack.map(person => person.name).sort()).toEqual(sprites.filter(sprite => sprite.status === "ready").map(sprite => sprite.id).sort());
    for (const sprite of sprites.filter(sprite => sprite.status === "draft")) expect(sprite.source).toBeNull();
    for (const person of celebritiesPack) {
      expect(person.serie).toBe("celebrity");
      expect(person.tags).toContain("celebrites");
      expect(person.detailImageSrc).toMatch(/^\/assets\/images\/characters\/celebrities\/[a-z0-9-]+\.png$/);
      expect(existsSync(`public${person.imageSrc}`), person.name).toBe(true);
      expect(sprites.find(sprite => sprite.id === person.name)).toMatchObject({ label: person.label, status: "ready", source: person.detailImageSrc });
    }
    expect(celebritiesPack.length).toBeGreaterThanOrEqual(3);
  });

  it("propose les mêmes célébrités débloquées en Infini, Duel et salons, sans animaux", () => {
    const save = defaultSave();
    const unlocked = unlockedPeople(save, celebritiesPack);
    expect(playThemeFromSearch("?theme=personnes")).toBe("personnes");
    expect(publishedThemePool("personnes")).toEqual(celebritiesPack);
    expect(publishedThemePool("personnages")).toEqual(expect.arrayContaining(celebritiesPack));
    expect(multiplayerPool("personnes")).toEqual(unlocked);
    for (const mode of ["endless", "duel"] as const) {
      expect(themeOptions(mode, save).find(option => option.theme.id === "personnes")).toMatchObject({ enabled: true, availableCount: unlocked.length, totalCount: celebritiesPack.length });
      expect(playThemePool(mode, "personnes", save)).toEqual(unlocked);
    }
    expect(unlocked).toHaveLength(12);
    expect(unlocked.map(person => person.name).sort()).toEqual([...STARTER_CELEBRITY_IDS].sort());
    const spec = generatePlayableLevel(1, { seed: 42, tier: "normal", pool: unlocked });
    for (const person of [spec.wanted, ...spec.decoys]) {
      expect(unlocked).toContain(person);
      expect(animalsPack).not.toContain(person);
    }
  });

  it("achète une célébrité dans l’album sans inventer de capture ni contourner son prix", () => {
    const person = celebritiesPack.find(person => !isPersonUnlocked(defaultSave(), person.name))!;
    expect(person).toBeDefined();
    expect(ALBUM_COLLECTIONS.find(collection => collection.id === "personnes")?.characters).toContain(person);
    const save = { ...defaultSave(), collection: { [person.name]: 50 } };
    expect(isAlbumCharacterUnlocked(save, person)).toBe(false);
    expect(applyPersonPurchase(save, person.name).result).toBe("not-enough-stars");
    const funded = { ...defaultSave(), wallet: { ...defaultSave().wallet, stars: PERSON_PRICE } };
    const purchase = applyPersonPurchase(funded, person.name);
    expect(purchase.result).toBe("purchased");
    expect(purchase.save.wallet.stars).toBe(0);
    expect(purchase.save.collection[person.name]).toBeUndefined();
    expect(isAlbumCharacterUnlocked(purchase.save, person)).toBe(true);
    expect(multiplayerPool("personnes", purchase.save.purchasedPeople)).toContain(person);
  });
});
