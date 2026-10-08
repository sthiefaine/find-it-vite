import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ACCESSORY_OUTLINE_OFFSETS, getAccessory, getAccessoryBox, needsAccessoryOutline } from "../../content/accessories";

const SIZE = 45;
const background = "#203238";

async function whiteSilhouette(imageSrc: string) {
  const { data, info } = await sharp(`public${imageSrc}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 255;
  return sharp(data, { raw: info }).png().toBuffer();
}

async function changedPixels(animal: string, accessoryId: "moustache" | "sunglasses", outlined: boolean) {
  const imageSrc = `/assets/images/characters/animals/${animal}.png`;
  const accessory = getAccessory(accessoryId)!;
  const box = getAccessoryBox(accessory, imageSrc);
  const width = Math.round(box.width * SIZE);
  const height = Math.round(box.height * SIZE);
  const image = await sharp(`public${accessory.imageSrc}`).resize(width, height).png().toBuffer();
  const outline = await sharp(await whiteSilhouette(accessory.imageSrc)).resize(width, height).png().toBuffer();
  const overlays = outlined && needsAccessoryOutline(accessory) ? ACCESSORY_OUTLINE_OFFSETS.map(offset => ({
    input: outline, left: Math.round((box.x + offset.x) * SIZE), top: Math.round((box.y + offset.y) * SIZE),
  })) : [];
  overlays.push({ input: image, left: Math.round(box.x * SIZE), top: Math.round(box.y * SIZE) });
  const plain = await sharp(`public${imageSrc}`).resize(SIZE, SIZE).flatten({ background }).raw().toBuffer();
  const png = await sharp(`public${imageSrc}`).resize(SIZE, SIZE).composite(overlays).png().toBuffer();
  const painted = await sharp(png).flatten({ background }).raw().toBuffer();
  let count = 0;
  for (let i = 0; i < plain.length; i += 3) {
    if ([0, 1, 2].some(channel => Math.abs(plain[i + channel] - painted[i + channel]) > 32)) count++;
  }
  return count;
}

describe("indice distinctif sur les portraits noirs à 45 px", () => {
  it.each(["mouton-suffolk", "manchot-empereur"])("rend perceptible la moustache sur %s, pour une cible habillée ou un leurre de cible nue", async animal => {
    // Sans contour, cette variante « tous pareils » n'offre presque aucun
    // indice : la moustache noire disparaît dans le visage noir.
    expect(await changedPixels(animal, "moustache", false)).toBeLessThan(20);
    expect(await changedPixels(animal, "moustache", true)).toBeGreaterThanOrEqual(50);
  });

  it.each(["mouton-suffolk", "manchot-empereur"])("garde aussi les lunettes perceptibles dans une foule mixte sur %s", async animal => {
    expect(await changedPixels(animal, "sunglasses", true)).toBeGreaterThanOrEqual(80);
  });
});
