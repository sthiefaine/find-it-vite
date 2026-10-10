import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import provenance from "../../../content/sprites/enrichment-wave-01.provenance.json";
import catalog from "../../../content/sprites/catalog.json";
import { animalsPack, celebritiesPack, historyPack, peoplePack } from "../../helpers/characters";
import { CAMPAIGN_CHAPTERS } from "../campaign";
import { isCountryLink } from "../countryLinks";

describe("première vague internationale", () => {
  it("publie 80 identités uniques et garde les trois refus en brouillon sans image", async () => {
    expect(new Set(provenance.map(item => item.id)).size).toBe(provenance.length);
    const ready = provenance.filter(item => item.status === "ready");
    expect(ready).toHaveLength(80);
    expect(ready.filter(item => item.themeId === "animaux")).toHaveLength(24);
    expect(ready.filter(item => item.themeId !== "animaux")).toHaveLength(56);
    const published = [...animalsPack, ...celebritiesPack, ...historyPack, ...peoplePack];
    for (const item of provenance) {
      const sprite = catalog.sprites.find(sprite => sprite.id === item.id)!;
      expect(sprite.status).toBe(item.status);
      expect((await readFile(item.promptPath, "utf8")).length).toBeGreaterThan(100);
      if (item.status === "draft") {
        expect(sprite.source).toBeNull();
        expect(published.some(portrait => portrait.name === item.id)).toBe(false);
        continue;
      }
      const portrait = published.find(portrait => portrait.name === item.id)!;
      expect(portrait.detailImageSrc).toBe(sprite.source);
      expect(portrait.tags).not.toContain("influenceurs");
      expect(await sharp(`public${sprite.source}`).metadata()).toMatchObject({ width: 512, height: 512, hasAlpha: true, format: "png" });
      if (portrait.serie !== "animal") expect(portrait.countryLinks?.every(isCountryLink)).toBe(true);
    }
    expect(provenance.filter(item => item.status === "draft").map(item => item.id).sort()).toEqual(["michael-schumacher", "oprah-winfrey", "xuxa-meneghel"]);
  });
  it("intègre deux cohortes pays de vingt portraits réellement liés au pays", () => {
    expect(CAMPAIGN_CHAPTERS).toHaveLength(8);
    const published = [...peoplePack, ...historyPack, ...celebritiesPack];
    for (const code of ["US", "BR"]) {
      const chapter = CAMPAIGN_CHAPTERS.find(chapter => chapter.country === code)!;
      expect(chapter.cohortIds).toHaveLength(20);
      expect(chapter.cohortIds.every(id => published.find(portrait => portrait.name === id)?.countryLinks?.some(link => link.code === code))).toBe(true);
    }
  });
});
