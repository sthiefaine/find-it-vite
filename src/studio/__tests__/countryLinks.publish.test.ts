import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createStudioStore } from "../../../scripts/studioPlugin";
import type { Catalog, PublishedCharacter, Sprite } from "../model";
import { validateCatalog } from "../model";

const scratch: string[] = [];
afterEach(async () => { await Promise.all(scratch.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const themes: Catalog["themes"] = [
  { id: "politique", name: "Politique", category: "politics", destination: "game" },
  { id: "histoire", name: "Histoire", category: "history", destination: "game" },
  { id: "personnes", name: "Célébrités", category: "people", destination: "game" },
];

describe("liens pays dans l'atelier et la publication", () => {
  it("conserve le lien culturel de l'import au manifeste sans changer la source PNG", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "find-it-country-links-")); scratch.push(root);
    await mkdir(path.join(root, "content/sprites"), { recursive: true });
    await mkdir(path.join(root, "src/content"), { recursive: true });
    const base: Catalog = { version: 1, revision: 0, themes, sprites: [] };
    await writeFile(path.join(root, "content/sprites/catalog.json"), JSON.stringify(base));
    await writeFile(path.join(root, "src/content/publishedAnimals.json"), "[]");
    const store = createStudioStore(root);
    const asset = await store.upload(await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 100, g: 80, b: 70, alpha: 0.5 } } }).png().toBuffer());
    const portrait = (id: string, themeId: string, code?: string): Sprite => ({ id, label: id, subject: id, themeId, color: "brown", family: "brun", status: "ready", source: asset.source, notes: "", tags: ["portrait"],
      ...(code ? { countryLinks: [{ code, relation: "Contribution culturelle documentée ; ce champ ne présume pas la nationalité.", sourceUrl: "https://example.com/biography" }] } : {}) });
    const sprites = [portrait("politique-us", "politique", "US"), portrait("politique-br", "politique", "BR"), portrait("histoire-de", "histoire", "DE"), portrait("chef-br", "personnes", "BR"), portrait("ancien-portrait", "personnes")];
    const saved = await store.save({ ...base, sprites });
    expect((await store.read()).sprites.map(sprite => sprite.countryLinks)).toEqual(sprites.map(sprite => sprite.countryLinks));
    expect((await store.state()).catalog).toEqual(saved);
    const published = await store.publish(saved.revision);
    for (const sprite of sprites) {
      const character = published.find(person => person.name === sprite.id)!;
      expect(character.countryLinks).toEqual(sprite.countryLinks);
      expect(character.imageSrc).toMatch(/^\/assets\/images\/characters\/catalog\/[a-z0-9]+\.png$/);
    }
    const manifests = await Promise.all(["People", "History", "Celebrities"].map(async category => JSON.parse(await readFile(path.join(root, `src/content/published${category}.json`), "utf8")) as PublishedCharacter[]));
    expect(manifests.flat().map(person => person.countryLinks)).toEqual(published.map(person => person.countryLinks));
    expect((await store.state()).published).toEqual(published);
  });
  it("rejette les liens invalides avant de sauver tout en acceptant les vieux sprites", () => {
    const sprite: Sprite = { id: "ancien", themeId: "personnes", label: "Ancien", subject: "Ancien", color: "brown", family: "brun", status: "draft", source: null, notes: "" };
    expect(validateCatalog({ version: 1, revision: 0, themes, sprites: [sprite] }).sprites[0].countryLinks).toBeUndefined();
    expect(() => validateCatalog({ version: 1, revision: 0, themes, sprites: [{ ...sprite, countryLinks: [{ code: "BR", relation: "Lien culturel", sourceUrl: "http://example.com" }] }] })).toThrow("liens pays");
  });
});
