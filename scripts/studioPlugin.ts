import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, copyFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import sharp from "sharp";
import { gameSprites, validateCatalog, validSource } from "../src/studio/model";
import type { AssetInfo, Catalog, PublishedCharacter } from "../src/studio/model";
import { normalizedAnimalMetadata } from "../src/content/animalTaxonomy";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
class StudioError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
async function atomicJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporary, file);
}
async function body(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new StudioError("Fichier trop volumineux (8 Mo maximum par image).", 413);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
const json = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(data));
};

export async function inspectImage(bytes: Buffer): Promise<Omit<AssetInfo, "source"> & { format: "png" | "webp" }> {
  if (bytes.length > MAX_IMAGE_BYTES) throw new StudioError("Image trop volumineuse (8 Mo maximum).");
  const image = sharp(bytes, { limitInputPixels: 4096 * 4096 });
  const metadata = await image.metadata();
  if (metadata.format !== "png" && metadata.format !== "webp") throw new StudioError("Importe une image PNG ou WebP.");
  if ((metadata.pages ?? 1) > 1) throw new StudioError("Les images animées ne sont pas prises en charge.");
  if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096) throw new StudioError("L’image doit mesurer au maximum 4096 × 4096 pixels.");
  const stats = await image.stats();
  if (metadata.hasAlpha && stats.channels[stats.channels.length - 1].max === 0) throw new StudioError("L’image est entièrement transparente : aucun sprite visible.");
  return { width: metadata.width, height: metadata.height, transparent: !!metadata.hasAlpha && !stats.isOpaque, format: metadata.format };
}

export function createStudioStore(root: string) {
  const catalogFile = path.join(root, "content/sprites/catalog.json");
  const imageDir = path.join(root, "content/sprites/images");
  const manifestFile = path.join(root, "src/content/publishedAnimals.json");
  const peopleManifestFile = path.join(root, "src/content/publishedPeople.json");
  const historyManifestFile = path.join(root, "src/content/publishedHistory.json");
  async function publishedExtra(file: string): Promise<PublishedCharacter[]> {
    try { return JSON.parse(await readFile(file, "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  };
  const read = async () => validateCatalog(JSON.parse(await readFile(catalogFile, "utf8")));
  const checkRevision = (catalog: Catalog, revision: number) => {
    if (catalog.revision !== revision) throw new StudioError("Le catalogue a changé dans un autre onglet. Recharge la page avant de réessayer.", 409);
  };
  async function sourcePath(source: string) {
    if (!validSource(source)) throw new StudioError("Chemin d’image invalide.");
    const directory = source.startsWith("studio:") ? imageDir
      : path.join(root, "public/assets/images/characters", path.basename(path.dirname(source)));
    const file = source.startsWith("studio:") ? source.slice(7) : path.basename(source);
    const resolved = await realpath(path.join(directory, file));
    const base = await realpath(directory);
    if (!resolved.startsWith(`${base}${path.sep}`)) throw new StudioError("Image située hors du catalogue.");
    return resolved;
  }
  async function info(source: string) {
    return { source, ...await inspectImage(await readFile(await sourcePath(source))) };
  }
  return {
    read,
    async state() {
      const catalog = await read();
      const sources = [...new Set(catalog.sprites.flatMap((sprite) => sprite.source ? [sprite.source] : []))];
      const assets = await Promise.all(sources.map(async (source) => {
        try { return await info(source); } catch { return { source, width: 0, height: 0, transparent: false }; }
      }));
      const published: PublishedCharacter[] = JSON.parse(await readFile(manifestFile, "utf8"));
      const [people, history] = await Promise.all([publishedExtra(peopleManifestFile), publishedExtra(historyManifestFile)]);
      return { catalog, assets, published: [...published, ...people, ...history] };
    },
    save(input: unknown) {
      return serialize(async () => {
        const candidate = validateCatalog(input);
        const current = await read();
        checkRevision(current, candidate.revision);
        // Ne pas retirer de personnages existants par un import ou un onglet périmé.
        for (const sprite of current.sprites) if (!candidate.sprites.some((s) => s.id === sprite.id)) throw new StudioError("Pour retirer un sprite du jeu, repasse-le en brouillon.");
        for (const sprite of candidate.sprites) if (sprite.source) await sourcePath(sprite.source);
        const next = { ...candidate, revision: current.revision + 1 };
        await atomicJson(catalogFile, next);
        return next;
      });
    },
    async upload(bytes: Buffer) {
      const metadata = await inspectImage(bytes);
      const filename = `${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}.${metadata.format}`;
      await mkdir(imageDir, { recursive: true });
      await writeFile(path.join(imageDir, filename), bytes, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
      return { source: `studio:${filename}`, ...metadata };
    },
    publish(revision: number) {
      return serialize(async () => {
        const catalog = await read();
        checkRevision(catalog, revision);
        const sprites = gameSprites(catalog);
        if (sprites.length < 5) throw new StudioError("Valide au moins 5 portraits pour les étapes de 5 recherches du jeu.");
        // Tout vérifier avant de modifier le manifeste consommé par le jeu.
        const checked = await Promise.all(sprites.map(async (sprite) => {
          const source = sprite.source!;
          const metadata = await info(source);
          if (!metadata.transparent || metadata.width !== metadata.height || metadata.width < 128) throw new StudioError(`${sprite.label} : il faut une image carrée d’au moins 128 pixels avec un fond transparent.`);
          if ((await readFile(await sourcePath(source))).length > 5 * 1024 * 1024) throw new StudioError(`${sprite.label} : l’image doit peser moins de 5 Mo pour le jeu hors ligne.`);
          return { sprite, file: await sourcePath(source) };
        }));
        const published: PublishedCharacter[] = [];
        const categories = new Map(catalog.themes.map((theme) => [theme.id, theme.category]));
        for (const { sprite, file } of checked) {
          let imageSrc = sprite.source!;
          if (imageSrc.startsWith("studio:")) {
            imageSrc = `/assets/images/characters/catalog/${imageSrc.slice(7)}`;
            const destination = path.join(root, "public", imageSrc.slice(1));
            await mkdir(path.dirname(destination), { recursive: true });
            await copyFile(file, destination);
          }
          const category = categories.get(sprite.themeId);
          const serie = category === "politics" ? "politics" : category === "history" ? "history" : "animal";
          published.push({ name: sprite.id, label: sprite.label, imageSrc, serie, color: sprite.color, family: sprite.family, ...normalizedAnimalMetadata(sprite) });
        }
        await atomicJson(manifestFile, published.filter((character) => character.serie === "animal"));
        await atomicJson(peopleManifestFile, published.filter((character) => character.serie === "politics"));
        await atomicJson(historyManifestFile, published.filter((character) => character.serie === "history"));
        return published;
      });
    },
    async image(filename: string) { return readFile(await sourcePath(`studio:${filename}`)); },
  };
}

export function studioPlugin(): Plugin {
  return {
    name: "find-it-local-studio",
    apply: "serve",
    configureServer(server) {
      const store = createStudioStore(server.config.root);
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__studio/")) return next();
        const run = async () => {
          const host = req.headers.host ?? "";
          if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new StudioError("L’atelier est accessible uniquement en local.", 403);
          if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new StudioError("Origine refusée.", 403);
          if (req.headers["sec-fetch-site"] === "cross-site") throw new StudioError("Origine refusée.", 403);
          const url = new URL(req.url!, `http://${host}`);
          if (req.method === "GET" && url.pathname === "/__studio/catalog") return json(res, 200, await store.state());
          if (req.method === "GET" && url.pathname.startsWith("/__studio/image/")) {
            const filename = url.pathname.slice("/__studio/image/".length);
            const bytes = await store.image(filename);
            res.writeHead(200, { "Content-Type": filename.endsWith(".webp") ? "image/webp" : "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=31536000, immutable" });
            return res.end(bytes);
          }
          if (req.method !== "POST") throw new StudioError("Route inconnue.", 404);
          // En-tête non simple : un site tiers ne peut pas écrire via un formulaire.
          if (req.headers["x-find-it-studio"] !== "1") throw new StudioError("Requête refusée.", 403);
          if (url.pathname === "/__studio/upload") return json(res, 200, await store.upload(await body(req, MAX_IMAGE_BYTES)));
          const input: unknown = JSON.parse((await body(req, 4 * 1024 * 1024)).toString("utf8"));
          if (url.pathname === "/__studio/catalog") return json(res, 200, await store.save(input));
          if (url.pathname === "/__studio/publish") return json(res, 200, await store.publish((input as { revision: number }).revision));
          throw new StudioError("Route inconnue.", 404);
        };
        void run().catch((error: unknown) => {
          const status = error instanceof StudioError ? error.status : 400;
          const message = error instanceof Error ? error.message : "Opération impossible.";
          json(res, status, { error: message });
        });
      });
    },
  };
}
