import { BaseTexture, ImageResource, Texture, utils } from "pixi.js";
import { ACCESSORIES } from "../content/accessories";
import type { LevelSpec } from "../engine/types";
import { obstacleTheme } from "./obstacleTheme";

const ASSET_TIMEOUT_MS = 15_000;

const aborted = () => new DOMException("Chargement annulé", "AbortError");

// Annuler un niveau ne doit pas annuler un téléchargement partagé avec le suivant.
export function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason ?? aborted());
  return new Promise((resolve, reject) => {
    const cancel = () => { cleanup(); reject(signal.reason ?? aborted()); };
    const cleanup = () => signal.removeEventListener("abort", cancel);
    signal.addEventListener("abort", cancel, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

export async function loadDecodedImage(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  if (signal.aborted) throw signal.reason ?? aborted();
  const image = new Image();
  image.decoding = "async";
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", cancel);
    };
    const cancel = () => { cleanup(); image.removeAttribute("src"); reject(signal.reason ?? aborted()); };
    const loaded = () => {
      cleanup();
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve();
      else reject(new Error(`Image vide : ${url}`));
    };
    image.onload = loaded;
    image.onerror = () => { cleanup(); reject(new Error(`Image indisponible : ${url}`)); };
    signal.addEventListener("abort", cancel, { once: true });
    image.src = url;
    if (image.complete) loaded();
  });
  if (image.decode) await withAbort(image.decode(), signal);
  if (signal.aborted) throw signal.reason ?? aborted();
  return image;
}

async function loadTexture(url: string, signal: AbortSignal): Promise<void> {
  const image = await loadDecodedImage(url, signal);
  if (signal.aborted) throw signal.reason ?? aborted();
  // L'image est déjà décodée. Sans createBitmap, chaque nouveau renderer peut
  // l'envoyer au GPU dès sa première frame, sans traitement asynchrone tardif.
  const resource = new ImageResource(image, { autoLoad: false, createBitmap: false });
  const base = new BaseTexture(resource);
  const texture = new Texture(base);
  if (!texture.valid || !base.valid) throw new Error(`Texture indisponible : ${url}`);
  // Une texture créée ailleurs (Duel, ancien Stage) peut encore être utilisée.
  // On remplace les alias, sans jamais détruire sa texture partagée.
  Texture.removeFromCache(url);
  BaseTexture.removeFromCache(url);
  BaseTexture.addToCache(base, url);
  Texture.addToCache(texture, url);
}

type LoadAsset = (url: string, signal: AbortSignal) => Promise<void>;

// Une seule promesse par URL, y compris si préchargement, StrictMode et niveau
// demandent la même image simultanément. Un échec est évincé pour permettre Retry.
export function createAssetReadiness(load: LoadAsset = loadTexture, timeoutMs = ASSET_TIMEOUT_MS) {
  const pending = new Map<string, Promise<void>>();
  const ensure = (url: string): Promise<void> => {
    const existing = pending.get(url);
    if (existing) return existing;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error(`Chargement trop long : ${url}`)), timeoutMs);
    const promise = withAbort(Promise.resolve().then(() => load(url, controller.signal)), controller.signal)
      .catch(error => { if (pending.get(url) === promise) pending.delete(url); throw error; })
      .finally(() => clearTimeout(timeout));
    pending.set(url, promise);
    return promise;
  };
  return (urls: readonly string[], signal?: AbortSignal): Promise<void> => {
    if (signal?.aborted) return Promise.reject(signal.reason ?? aborted());
    return withAbort(Promise.all([...new Set(urls)].map(ensure)).then(() => undefined), signal);
  };
}

export const preloadImages = createAssetReadiness();

// Les obstacles Canvas utilisent exactement la source préparée pour le niveau,
// y compris après Retry, sans créer une seconde image susceptible d'échouer.
export function preparedImage(url: string): HTMLImageElement | undefined {
  const texture = utils.TextureCache[url];
  const resource = texture?.baseTexture?.resource;
  return texture?.valid && resource instanceof ImageResource ? resource.source as HTMLImageElement : undefined;
}

export function levelAssetUrls(spec: LevelSpec, previewBirds = false): string[] {
  const urls = [spec.wanted.imageSrc, ...spec.decoys.map(character => character.imageSrc)];
  const obstacles = obstacleTheme(spec.wanted.serie === "politics");
  // Les accessoires des leurres sont choisis dans le catalogue, indépendamment
  // de celui de la cible : attendre seulement ce dernier ne suffit pas.
  if (spec.accessories && spec.rule === "classic") urls.push(...ACCESSORIES.map(accessory => accessory.imageSrc));
  if (spec.scene?.foliage) urls.push(...obstacles.concealment.map(item => item.imageSrc));
  if (spec.rule === "classic" && !spec.modifiers.includes("flashlight") &&
      (previewBirds || (spec.scene?.seagulls ?? spec.index >= 4))) urls.push(...obstacles.passers);
  return [...new Set(urls)];
}

function minimumDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason ?? aborted());
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason ?? aborted()); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, Math.max(0, ms));
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export async function prepareLevelAssets(
  spec: LevelSpec,
  options: { signal: AbortSignal; minimumMs: number; previewBirds?: boolean },
  preload = preloadImages,
): Promise<void> {
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal.reason ?? aborted());
  options.signal.addEventListener("abort", cancel, { once: true });
  if (options.signal.aborted) cancel();
  try {
    await Promise.all([
      preload(levelAssetUrls(spec, options.previewBirds), controller.signal),
      minimumDelay(options.minimumMs, controller.signal),
    ]);
  } finally {
    options.signal.removeEventListener("abort", cancel);
    controller.abort();
  }
}

// Cycle utilisé par l'effet React : la résolution d'un ancien niveau ou d'une
// ancienne tentative ne peut ni démarrer le jeu ni remplacer le message actuel.
export function startLevelAssetLoad(
  spec: LevelSpec,
  options: { minimumMs: number; previewBirds?: boolean },
  callbacks: { isCurrent: () => boolean; onReady: () => void; onError: () => void },
  preload = preloadImages,
): () => void {
  const controller = new AbortController();
  const current = () => !controller.signal.aborted && callbacks.isCurrent();
  void prepareLevelAssets(spec, { ...options, signal: controller.signal }, preload).then(
    () => { if (current()) callbacks.onReady(); },
    () => { if (current()) callbacks.onError(); },
  );
  return () => controller.abort();
}
