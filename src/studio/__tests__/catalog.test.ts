import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createStudioStore, inspectImage } from "../../../scripts/studioPlugin";
import { gameSprites, spritePrompt, validateCatalog, validSource } from "../model";
import type { Catalog } from "../model";

const scratch: string[] = [];
afterEach(async () => { await Promise.all(scratch.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

function sample(): Catalog {
  return { version: 1, revision: 0, themes: [{ id: "animaux", name: "Animaux", category: "animals", destination: "game" }, { id: "drapeaux", name: "Drapeaux", category: "flags", destination: "fun" }], sprites: [] };
}
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "find-it-studio-test-")); scratch.push(root);
  await mkdir(path.join(root, "content/sprites"), { recursive: true });
  await mkdir(path.join(root, "src/content"), { recursive: true });
  await writeFile(path.join(root, "content/sprites/catalog.json"), JSON.stringify(sample()));
  await writeFile(path.join(root, "src/content/publishedAnimals.json"), "[]");
  return { root, store: createStudioStore(root) };
}
const transparentImage = () => sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 80, g: 120, b: 90, alpha: 0.5 } } }).png().toBuffer();

describe("catalogue local", () => {
  it("interdit une catégorie fun dans le jeu même si le client l’envoie", () => {
    const catalog = sample(); catalog.themes[1].destination = "game";
    expect(() => validateCatalog(catalog)).toThrow("Seuls les thèmes animaliers");
  });
  it("refuse les chemins arbitraires et les formats actifs", () => {
    for (const source of ["../../secret", "studio:../secret", "file:///etc/passwd", "https://example.com/image.png", "/assets/images/characters/animals/../secret.png", "studio:icon.svg"]) expect(validSource(source)).toBe(false);
  });
  it("préserve les brouillons et les thèmes fun hors du catalogue publié", () => {
    const catalog = sample();
    const sprite = { id: "chat", themeId: "animaux", label: "Chat", subject: "chat", color: "brown" as const, family: "brun", status: "ready" as const, source: "/assets/images/characters/animals/chat.png", notes: "" };
    catalog.sprites = [sprite, { ...sprite, id: "chien", status: "draft" }, { ...sprite, id: "france", themeId: "drapeaux" }];
    expect(gameSprites(validateCatalog(catalog)).map((s) => s.id)).toEqual(["chat"]);
  });
  it("détecte les écritures concurrentes et conserve les derniers changements", async () => {
    const { store } = await fixture();
    const current = await store.read();
    const updated = await store.save({ ...current, themes: [...current.themes, { id: "foret", name: "Forêt", category: "animals", destination: "game" }] });
    expect(updated.revision).toBe(1);
    await expect(store.save(current)).rejects.toThrow("autre onglet");
    expect((await store.read()).themes).toHaveLength(3);
  });
  it("importe, enregistre et publie des animaux avec leurs fichiers ; exclut le fun", async () => {
    const { root, store } = await fixture();
    const asset = await store.upload(await transparentImage());
    const catalog = sample();
    catalog.sprites = Array.from({ length: 6 }, (_, i) => ({ id: `animal-${i}`, themeId: i === 5 ? "drapeaux" : "animaux", label: `Animal ${i}`, subject: `animal ${i}`, color: "brown", family: "brun", status: "ready", source: asset.source, notes: "" }));
    const saved = await store.save(catalog);
    const published = await store.publish(saved.revision);
    expect(published).toHaveLength(5);
    expect(published.some((s) => s.name === "animal-5")).toBe(false);
    for (const animal of published) expect(await readFile(path.join(root, "public", animal.imageSrc))).toEqual(await transparentImage());
    expect(JSON.parse(await readFile(path.join(root, "src/content/publishedAnimals.json"), "utf8"))).toEqual(published);
    expect((await store.state()).assets[0]).toMatchObject({ width: 128, height: 128, transparent: true });
    await expect(store.publish(0)).rejects.toThrow("autre onglet");
  });
  it("une image opaque bloque la publication sans altérer le manifeste précédent", async () => {
    const { root, store } = await fixture();
    const asset = await store.upload(await sharp({ create: { width: 128, height: 128, channels: 3, background: "white" } }).png().toBuffer());
    const catalog = sample();
    catalog.sprites = Array.from({ length: 5 }, (_, i) => ({ id: `animal-${i}`, themeId: "animaux", label: `Animal ${i}`, subject: `animal ${i}`, color: "grey", family: "gris", status: "ready", source: asset.source, notes: "" }));
    const saved = await store.save(catalog);
    await expect(store.publish(saved.revision)).rejects.toThrow("fond transparent");
    expect(await readFile(path.join(root, "src/content/publishedAnimals.json"), "utf8")).toBe("[]");
  });
  it("refuse les images invalides, les SVG et les catalogues trop petits pour le jeu", async () => {
    const { store } = await fixture();
    await expect(inspectImage(Buffer.from("not an image"))).rejects.toThrow();
    await expect(inspectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"/>'))).rejects.toThrow("PNG ou WebP");
    await expect(inspectImage(await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer())).rejects.toThrow("aucun sprite visible");
    await expect(store.publish(0)).rejects.toThrow("5 animaux");
  });
});

describe("prompts réutilisables", () => {
  it("garde les contraintes du prompt animal et propose les deux fonds", () => {
    const white = spritePrompt("animals", "un hippopotame", false);
    expect(white).toContain("un hippopotame");
    expect(white).toContain("blanc pur");
    expect(white).toContain("Aucun ajout de cheveux");
    const alpha = spritePrompt("animals", "un hippopotame", true);
    expect(alpha).toContain("canal alpha");
    expect(alpha).not.toContain("blanc pur");
    expect(alpha).not.toContain("{sujet}");
  });
  it("ne traite pas les drapeaux ou les personnes comme des animaux", () => {
    expect(spritePrompt("flags", "France", true)).toContain("symboles officiels");
    expect(spritePrompt("flags", "France", true)).not.toContain("oreilles");
    expect(spritePrompt("history", "Marie Curie", true)).toContain("la coiffure");
    expect(spritePrompt("politics", "un personnage", true)).not.toContain("Aucun ajout de cheveux");
  });
});
