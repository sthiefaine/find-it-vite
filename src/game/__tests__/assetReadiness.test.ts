import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseTexture, CanvasResource, ImageResource, Texture, utils } from "pixi.js";
import { generateLevel } from "../../engine";
import { charactersDetails } from "../../helpers/characters";
import { ACCESSORIES, accessoryOutlineSource, getAccessory } from "../../content/accessories";
import { SCENES } from "../../content/scenes";
import { peoplePack } from "../../helpers/characters";
import { createAssetReadiness, levelAssetUrls, loadDecodedImage, preparedAccessoryOutline, preparedImage, prepareLevelAssets, startLevelAssetLoad } from "../assetReadiness";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const spec = generateLevel(1, { seed: 42, tier: "normal", pool: charactersDetails });
const flush = async () => { await vi.advanceTimersByTimeAsync(0); };

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("ressources du niveau", () => {
  it("attend la cible, tous les leurres et accessoires possibles, et seulement les obstacles pertinents", () => {
    const plain = { ...spec, index: 1, scene: undefined, accessories: undefined };
    expect(new Set(levelAssetUrls(plain))).toEqual(new Set([plain.wanted.imageSrc, ...plain.decoys.map(c => c.imageSrc)]));
    const decorated = { ...plain, accessories: { target: "moustache" as const, decoyChance: .6 } };
    expect(levelAssetUrls(decorated)).toEqual(expect.arrayContaining(ACCESSORIES.map(a => a.imageSrc)));
    expect(levelAssetUrls({ ...plain, index: 4 })).toContain("/assets/images/obstacles/seagull.png");
    expect(levelAssetUrls(plain, true)).toContain("/assets/images/obstacles/seagull.png");
    const foliage = { ...plain, index: 6, scene: SCENES.find(scene => !!scene.foliage)! };
    expect(levelAssetUrls(foliage)).toContain("/assets/images/obstacles/foliage.png");
    expect(levelAssetUrls(foliage)).not.toContain("/assets/images/obstacles/seagull.png");
    expect(levelAssetUrls({ ...plain, index: 4, modifiers: ["flashlight"] })).not.toContain("/assets/images/obstacles/seagull.png");
  });

  it("prépare les avocats et CRS des cachettes et les trois silhouettes de foule politique", () => {
    const political = { ...spec, wanted: peoplePack[0], decoys: peoplePack.slice(1, 4), accessories: undefined };
    const concealment = levelAssetUrls({ ...political, scene: SCENES.find(scene => !!scene.foliage)! });
    expect(concealment).toContain("/assets/images/obstacles/politics-lawyer.png");
    expect(concealment).toContain("/assets/images/obstacles/politics-crs.png");
    expect(concealment).not.toContain("/assets/images/obstacles/foliage.png");
    const crowd = levelAssetUrls({ ...political, scene: SCENES.find(scene => scene.seagulls)! });
    expect(crowd).toEqual(expect.arrayContaining(["politics-crs", "politics-police", "politics-yellow-vest"].map(id => `/assets/images/obstacles/${id}.png`)));
    expect(crowd).not.toContain("/assets/images/obstacles/seagull.png");
    expect(crowd).not.toContain("/assets/images/obstacles/politics-lawyer.png");
    const quiet = levelAssetUrls({ ...political, scene: undefined, index: 1 });
    expect(quiet.every(url => !url.includes("/obstacles/"))).toBe(true);
  });

  it("partage un chargement concurrent et garde le téléchargement utile après l'annulation d'un niveau", async () => {
    const image = deferred();
    const load = vi.fn(() => image.promise);
    const preload = createAssetReadiness(load);
    const abort = new AbortController();
    const previous = preload(["chat.png", "chat.png"], abort.signal);
    const result = previous.catch(error => error);
    const next = preload(["chat.png"]);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    abort.abort();
    expect((await result).name).toBe("AbortError");
    image.resolve();
    await next;
    await preload(["chat.png"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("respecte les 3 s à chaque niveau et attend davantage une image lente", async () => {
    for (const minimumMs of [3000, 0]) {
      const image = deferred();
      const done = vi.fn();
      const ready = prepareLevelAssets(spec, { signal: new AbortController().signal, minimumMs }, () => image.promise).then(done);
      await vi.advanceTimersByTimeAsync(minimumMs + 2000);
      expect(done).not.toHaveBeenCalled();
      image.resolve();
      await ready;
      expect(done).toHaveBeenCalledTimes(1);

      const instant = vi.fn();
      const waiting = prepareLevelAssets(spec, { signal: new AbortController().signal, minimumMs }, async () => undefined).then(instant);
      if (minimumMs > 0) {
        await vi.advanceTimersByTimeAsync(minimumMs - 1);
        expect(instant).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
      } else await flush();
      await waiting;
      expect(instant).toHaveBeenCalledTimes(1);
    }
  });

  it("un échec ou un délai dépassé permet de réessayer sans recharger les images déjà prêtes", async () => {
    const hung = deferred();
    const load = vi.fn((url: string) => url === "lent" ? hung.promise : Promise.resolve());
    const preload = createAssetReadiness(load, 500);
    const failure = preload(["prêt", "lent"]).catch(error => error);
    await vi.advanceTimersByTimeAsync(500);
    expect((await failure).message).toContain("trop long");
    expect(load.mock.calls).toHaveLength(2);
    load.mockImplementation(async () => undefined);
    await preload(["prêt", "lent"]);
    expect(load.mock.calls.map(call => call[0])).toEqual(["prêt", "lent", "lent"]);
    hung.resolve();
    await flush();

    const network = createAssetReadiness(vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined));
    await expect(network(["autre"])).rejects.toThrow("offline");
    await expect(network(["autre"])).resolves.toBeUndefined();
  });

  it("ignore les fins et erreurs obsolètes (unmount, reset, nouveau niveau, StrictMode) et reprend après Retry", async () => {
    const old = deferred();
    const callbacks = { isCurrent: () => true, onReady: vi.fn(), onError: vi.fn() };
    const cancel = startLevelAssetLoad(spec, { minimumMs: 1000 }, callbacks, () => old.promise);
    cancel();
    const next = deferred();
    const cancelNext = startLevelAssetLoad(spec, { minimumMs: 1000 }, callbacks, () => next.promise);
    old.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    expect(callbacks.onReady).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    next.reject(new Error("offline"));
    await flush();
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    cancelNext();
    startLevelAssetLoad(spec, { minimumMs: 0 }, callbacks, async () => undefined);
    await flush();
    expect(callbacks.onReady).toHaveBeenCalledTimes(1);

    const stale = deferred();
    let current = true;
    startLevelAssetLoad(spec, { minimumMs: 0 }, { ...callbacks, isCurrent: () => current }, () => stale.promise);
    current = false;
    stale.resolve();
    await flush();
    expect(callbacks.onReady).toHaveBeenCalledTimes(1);
  });
});

class TestImage {
  static instances: TestImage[] = [];
  src = "";
  decoding = "auto";
  crossOrigin = "";
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoded = deferred();
  decode = vi.fn(() => this.decoded.promise);
  constructor() { TestImage.instances.push(this); }
  removeAttribute() { this.src = ""; }
  loaded() { this.complete = true; this.naturalWidth = this.naturalHeight = 512; this.onload?.(); }
}

describe("images décodées et textures Pixi 7", () => {
  beforeEach(() => {
    TestImage.instances = [];
    vi.stubGlobal("Image", TestImage);
    vi.stubGlobal("HTMLImageElement", TestImage);
  });

  it("prépare le contour clair des accessoires sombres avant l'ouverture de la grille, une fois par image", async () => {
    const context = { drawImage: vi.fn(), fillRect: vi.fn(), globalCompositeOperation: "", fillStyle: "" };
    const canvas = { width: 0, height: 0, getContext: () => context };
    const createElement = vi.fn(() => canvas);
    vi.stubGlobal("document", { createElement });
    const preload = createAssetReadiness();
    const url = getAccessory("moustache")!.imageSrc;
    const loading = preload([url]);
    await flush();
    expect(preparedAccessoryOutline(url)).toBeUndefined();
    const image = TestImage.instances[0];
    image.loaded();
    image.decoded.resolve();
    await loading;

    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0);
    expect(context.globalCompositeOperation).toBe("source-in");
    expect(context.fillStyle).toBe("#ffffff");
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 512, 512);
    const outlineSource = accessoryOutlineSource(url);
    const outline = Texture.from(outlineSource);
    expect(outline.valid).toBe(true);
    expect(outline.baseTexture.resource).toBeInstanceOf(CanvasResource);
    expect(preparedAccessoryOutline(url)).toBe(canvas);
    await preload([url]);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect(Texture.from(outlineSource)).toBe(outline);
    for (const source of [url, outlineSource]) {
      const texture = Texture.from(source);
      Texture.removeFromCache(source);
      BaseTexture.removeFromCache(source);
      texture.destroy(true);
    }
  });

  it("ne publie la texture qu'après decode, valide dès la première frame et partagée par URL", async () => {
    const preload = createAssetReadiness();
    const ready = vi.fn();
    const url = "/test-decoded.png";
    const loading = preload([url]).then(ready);
    await flush();
    const image = TestImage.instances[0];
    image.loaded();
    await flush();
    expect(image.decode).toHaveBeenCalledTimes(1);
    expect(ready).not.toHaveBeenCalled();
    expect(utils.TextureCache[url]).toBeUndefined();
    image.decoded.resolve();
    await loading;
    const texture = Texture.from(url);
    expect(texture.valid).toBe(true);
    expect(texture.baseTexture.valid).toBe(true);
    expect(texture.baseTexture.resource).toBeInstanceOf(ImageResource);
    expect((texture.baseTexture.resource as ImageResource).createBitmap).toBe(false);
    expect((texture.baseTexture.resource as ImageResource).source).toBe(image);
    expect(preparedImage(url)).toBe(image);
    await preload([url]);
    expect(Texture.from(url)).toBe(texture);
    expect(TestImage.instances).toHaveLength(1);
    Texture.removeFromCache(url);
    BaseTexture.removeFromCache(url);
    texture.destroy(true);
  });

  it("un decode expiré ne remplace jamais la texture obtenue après Retry et ne détruit pas les textures partagées", async () => {
    const preload = createAssetReadiness(undefined, 500);
    const url = "/test-retry.png";
    const oldImage = new TestImage();
    oldImage.loaded();
    const previousTexture = new Texture(new BaseTexture(new ImageResource(oldImage as unknown as HTMLImageElement, { autoLoad: false })));
    Texture.addToCache(previousTexture, url);
    const failure = preload([url]).catch(error => error);
    await flush();
    const stalledImage = TestImage.instances[1];
    stalledImage.loaded();
    await vi.advanceTimersByTimeAsync(500);
    expect((await failure).message).toContain("trop long");
    expect(Texture.from(url)).toBe(previousTexture);

    const retry = preload([url]);
    await flush();
    const nextImage = TestImage.instances[2];
    nextImage.loaded();
    nextImage.decoded.resolve();
    await retry;
    const texture = Texture.from(url);
    expect(texture).not.toBe(previousTexture);
    expect(previousTexture.valid).toBe(true);
    expect(previousTexture.baseTexture.destroyed).toBe(false);
    expect(preparedImage(url)).toBe(nextImage);
    stalledImage.decoded.resolve();
    await flush();
    expect(Texture.from(url)).toBe(texture);
    Texture.removeFromCache(url);
    BaseTexture.removeFromCache(url);
    texture.destroy(true);
    previousTexture.destroy(true);
  });

  it("gère les erreurs decode, les images vides et l'annulation pendant decode sans texture tardive", async () => {
    const controller = new AbortController();
    const cancelled = loadDecodedImage("/cancel.png", controller.signal).catch(error => error);
    TestImage.instances[0].loaded();
    await flush();
    controller.abort();
    expect((await cancelled).name).toBe("AbortError");
    TestImage.instances[0].decoded.resolve();

    const decoded = loadDecodedImage("/decode.png", new AbortController().signal).catch(error => error);
    const bad = TestImage.instances[1];
    bad.loaded();
    await flush();
    bad.decoded.reject(new Error("decode failed"));
    expect((await decoded).message).toBe("decode failed");

    const empty = loadDecodedImage("/empty.png", new AbortController().signal).catch(error => error);
    TestImage.instances[2].onload?.();
    expect((await empty).message).toContain("vide");
  });
});
