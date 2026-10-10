import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { animalsPack, celebritiesPack, historyPack, peoplePack } from "../../helpers/characters";
import { portraitDetailSource, portraitGameSource } from "../../helpers/portraitAssets";
import variants from "../portraitVariants.json";

describe("portraits de jeu compressés", () => {
  it("publie un dérivé alpha256 versionné pour chaque original, sans perdre le PNG de l’album", async () => {
    const portraits = [...animalsPack, ...celebritiesPack, ...historyPack, ...peoplePack];
    expect(Object.keys(variants)).toHaveLength(portraits.length);
    for (const portrait of portraits) {
      expect(portrait.detailImageSrc, portrait.name).toMatch(/\.png$/);
      expect(existsSync(`public${portrait.detailImageSrc}`), portrait.name).toBe(true);
      expect(portrait.imageSrc).toBe(portraitGameSource(portrait.detailImageSrc!));
      expect(portrait.imageSrc, portrait.name).toMatch(/\.[a-f0-9]{12}\.webp$/);
      const game = await readFile(`public${portrait.imageSrc}`);
      const checksum = createHash("sha256").update(game).digest("hex").slice(0, 12);
      expect(portrait.imageSrc).toContain(`.${checksum}.webp`);
      const metadata = await sharp(game).metadata();
      expect(metadata).toMatchObject({ width: 256, height: 256, hasAlpha: true, format: "webp" });
      expect(portraitDetailSource(portrait)).toMatch(/\.png\?v=[a-f0-9]{12}$/);
    }
  });
  it("conserve les autres images et revient au petit portrait quand il n’y a pas d’original", () => {
    expect(portraitGameSource("/other.png")).toBe("/other.png");
    expect(portraitDetailSource({ imageSrc: "/other.webp" })).toBe("/other.webp");
  });
});
