import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseTexture, Texture, utils } from "pixi.js";
import { ACCESSORIES, accessoryOutlineSource, getAccessory } from "../../content/accessories";
import { charactersDetails } from "../../helpers/characters";
import { createAssetReadiness, prepareLevelAssets } from "../assetReadiness";
import { generatePlayableLevel } from "../playableLevel";

class DecodedImage {
  static instances = 0;
  src = "";
  complete = true;
  naturalWidth = 512;
  naturalHeight = 512;
  decode = async () => undefined;
  constructor() { DecodedImage.instances++; }
}

beforeEach(() => {
  DecodedImage.instances = 0;
  vi.stubGlobal("Image", DecodedImage);
  vi.stubGlobal("HTMLImageElement", DecodedImage);
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {}, fillRect() {} }) }) });
});
afterEach(() => {
  for (const accessory of ACCESSORIES) for (const source of [accessory.imageSrc, accessoryOutlineSource(accessory.imageSrc)]) {
    const texture = utils.TextureCache[source];
    Texture.removeFromCache(source);
    BaseTexture.removeFromCache(source);
    texture?.destroy(true);
  }
  vi.unstubAllGlobals();
});

describe("fiabilité des accessoires après le préchargement", () => {
  it.each(["missing", "destroyed", "outline"])("recharge une texture devenue indisponible (%s)", async (loss) => {
    const url = getAccessory(loss === "outline" ? "moustache" : "cap")!.imageSrc;
    const preload = createAssetReadiness();
    await preload([url]);
    const previous = utils.TextureCache[url];
    if (loss === "destroyed") previous.destroy(true);
    else {
      const source = loss === "outline" ? accessoryOutlineSource(url) : url;
      const removed = utils.TextureCache[source];
      Texture.removeFromCache(source);
      BaseTexture.removeFromCache(source);
      removed.destroy(true);
    }
    await preload([url]);
    expect(DecodedImage.instances).toBe(2);
    expect(utils.TextureCache[url].valid).toBe(true);
    expect(utils.TextureCache[url]).not.toBe(previous);
    if (loss === "outline") expect(utils.TextureCache[accessoryOutlineSource(url)].valid).toBe(true);
  });

  it("attend aussi les accessoires des copies quand la cible est sans accessoire", async () => {
    const spec = generatePlayableLevel(21, { seed: 42, tier: "normal", pool: charactersDetails }, { forceVariant: "two-bare" });
    expect(spec.accessories?.target).toBeNull();
    let release!: () => void;
    const delayed = new Promise<void>(resolve => { release = resolve; });
    const last = getAccessory("clown-nose")!.imageSrc;
    const load = vi.fn(async (url: string) => { if (url === last) await delayed; });
    const preload = createAssetReadiness(load);
    const warmed = preload(ACCESSORIES.map(accessory => accessory.imageSrc));
    const ready = vi.fn();
    const level = prepareLevelAssets(spec, { signal: new AbortController().signal, minimumMs: 0 }, preload).then(ready);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ready).not.toHaveBeenCalled();
    release();
    await Promise.all([warmed, level]);
    expect(ready).toHaveBeenCalledOnce();
    expect(load.mock.calls.filter(([url]) => url === last)).toHaveLength(1);
  });
});
