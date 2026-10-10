import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../../../content/sprites/catalog.json";
import { animalsPack } from "../../helpers/characters";
import { messages } from "../../i18n/messages";
import { multiplayerPool } from "../../multiplayer/multiplayerRules";
import { ALBUM_COLLECTIONS, isAlbumCharacterUnlocked } from "../../pages/Album/albumLogic";
import { defaultSave } from "../../save/schema";
import { applyPortraitPurchase } from "../../save/saveStore";
import { validateCatalog } from "../../studio/model";
import { animalCategoryLabel, matchesAnimalSearch } from "../animalTaxonomy";
import { publishedThemePool, playThemePool } from "../playThemes";
import { PORTRAIT_PRICE } from "../portraitUnlocks";

const NEW_IDS = [
  "kangourou-roux", "wombat", "ornithorynque", "echidne", "diable-de-tasmanie", "dingo", "quokka", "fennec", "dromadaire", "chameau-de-bactriane",
  "baleine-bleue", "poisson-clown", "meduse", "calamar", "seiche", "murene", "poisson-lune", "poisson-lion", "lamantin", "dugong",
  "abeille", "bourdon", "coccinelle", "papillon-monarque", "mante-religieuse", "libellule", "fourmi", "scarabee-rhinoceros", "escargot", "araignee-sauteuse",
  "chimpanze", "gibbon", "jaguar", "ocelot", "salamandre-tachetee", "triton-crete", "crapaud-commun", "harfang-des-neiges", "boeuf-musque", "lagopede-alpin",
] as const;

describe("40 espèces complémentaires", () => {
  it("publie quarante espèces distinctes, avec vrais assets et noms traduits, dans le jeu et l’album", () => {
    expect(() => validateCatalog(catalog)).not.toThrow();
    const added = animalsPack.filter(animal => NEW_IDS.includes(animal.name as typeof NEW_IDS[number]));
    expect(added).toHaveLength(40);
    expect(new Set(added.map(animal => animal.species)).size).toBe(40);
    for (const animal of added) {
      expect(animal.serie).toBe("animal");
      expect(animal.breed).toBe("");
      expect(existsSync(`public${animal.imageSrc}`), animal.name).toBe(true);
      expect(catalog.sprites.find(sprite => sprite.id === animal.name)).toMatchObject({ status: "ready", source: animal.detailImageSrc });
      expect(messages[animal.label], animal.name).toHaveLength(10);
      expect(publishedThemePool("animaux")).toContain(animal);
      expect(playThemePool("duel", "animaux", defaultSave())).toContain(animal);
      expect(multiplayerPool("animaux")).toContain(animal);
      expect(ALBUM_COLLECTIONS.find(collection => collection.id === "animaux")?.characters).toContain(animal);
    }
  });

  it("complète les catégories marines, polaires, jungle et les nouveaux filtres sans perdre les anciens tags", () => {
    const find = (id: string) => animalsPack.find(animal => animal.name === id)!;
    for (const id of ["manchot-empereur", "phoque", "morse", "beluga", "macareux", "harfang-des-neiges", "boeuf-musque", "lagopede-alpin"]) {
      expect(publishedThemePool("polaires")).toContain(find(id));
    }
    expect(find("phoque").tags).toEqual(expect.arrayContaining(["ocean", "polaires"]));
    for (const id of ["ara-bleu", "ara-rouge", "perroquet-gris-du-gabon", "perroquet-amazone", "iguane", "singe", "chimpanze", "gibbon", "jaguar", "ocelot"]) {
      expect(publishedThemePool("jungle")).toContain(find(id));
    }
    expect(find("ara-bleu").tags).toEqual(expect.arrayContaining(["domestiques", "oiseaux", "jungle"]));
    expect(find("koala").tags).toEqual(expect.arrayContaining(["sauvages", "australie"]));
    expect(find("araignee-sauteuse").tags).toContain("arachnides");
    expect(find("araignee-sauteuse").tags).not.toContain("insectes");
    expect(find("escargot").tags).not.toContain("insectes");
    for (const tag of ["australie", "desert", "insectes", "arachnides", "invertebres"]) {
      expect(animalsPack.some(animal => animal.tags?.includes(tag))).toBe(true);
      expect(messages[animalCategoryLabel(tag)]).toHaveLength(10);
    }
    expect(matchesAnimalSearch(find("fennec"), "désert")).toBe(true);
    expect(matchesAnimalSearch(find("kangourou-roux"), "Australie")).toBe(true);
  });

  it("garde le déblocage normal des nouveaux portraits en Infini et ne crée pas de captures lors d’un achat", () => {
    const animal = animalsPack.find(animal => animal.name === "kangourou-roux")!;
    const save = defaultSave();
    expect(isAlbumCharacterUnlocked(save, animal)).toBe(false);
    expect(playThemePool("endless", "animaux", save)).not.toContain(animal);
    const funded = { ...save, wallet: { ...save.wallet, stars: PORTRAIT_PRICE } };
    const purchase = applyPortraitPurchase(funded, animal.name);
    expect(purchase.result).toBe("purchased");
    expect(purchase.save.wallet.stars).toBe(0);
    expect(purchase.save.collection[animal.name]).toBeUndefined();
    expect(isAlbumCharacterUnlocked(purchase.save, animal)).toBe(true);
    expect(playThemePool("endless", "animaux", purchase.save)).toContain(animal);
  });
});
