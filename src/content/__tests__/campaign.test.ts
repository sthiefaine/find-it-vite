import { describe, expect, it } from "vitest";
import { CAMPAIGN_CHAPTERS, chapterLearningPool, chapterPool, chapterTargets, isChapterMissionUnlocked, nextChapterMission } from "../campaign";
import { defaultSave } from "../../save/schema";
import { generateChapterLevel } from "../../game/chapterRun";
import legacyAnimals from "../legacyAnimalIds.json";
import { getWorld } from "../worlds";
import { messages } from "../../i18n/messages";

describe("chapitres publiés", () => {
  it("réserve des identités stables avec de vrais portraits et dix étapes traduites", () => {
    expect(new Set(CAMPAIGN_CHAPTERS.map(c => c.id)).size).toBe(CAMPAIGN_CHAPTERS.length);
    for (const chapter of CAMPAIGN_CHAPTERS) {
      expect(chapterPool(chapter)).toHaveLength(chapter.cohortIds.length);
      expect(messages[chapter.label], chapter.label).toHaveLength(10);
      for (let mission = 1; mission <= 10; mission++) {
        const targets = chapterTargets(chapter, mission);
        expect(targets).toHaveLength(5);
        expect(new Set(targets).size).toBe(5);
        const learned = chapterLearningPool(chapter, mission).map(p => p.name);
        expect(targets.every(id => learned.includes(id))).toBe(true);
      }
      const discovered = new Set(Array.from({ length: 6 }, (_, i) => chapterTargets(chapter, i + 1)).flat());
      expect(chapter.cohortIds.every(id => discovered.has(id))).toBe(true);
    }
  });
  it("présente la cible prévue dans une foule rejouable, sans obstacle durant la découverte", () => {
    for (const chapter of CAMPAIGN_CHAPTERS) for (let mission = 1; mission <= 6; mission++) {
      const targets = chapterTargets(chapter, mission);
      for (let round = 1; round <= 5; round++) {
        const spec = generateChapterLevel(chapter.id, mission, round, "normal");
        expect(spec.wanted.name).toBe(targets[round - 1]);
        expect(spec.scene?.foliage).toBeUndefined();
        expect(spec.scene?.seagulls).toBe(false);
        expect(spec.accessories).toBeUndefined();
        expect(spec).toEqual(generateChapterLevel(chapter.id, mission, round, "normal"));
      }
    }
  });
  it("ouvre la première étape uniquement et garde le chapitre suivant indépendant", () => {
    const save = defaultSave(), id = CAMPAIGN_CHAPTERS[0].id;
    expect(nextChapterMission(save, id)).toBe(1);
    expect(isChapterMissionUnlocked(save, id, 1)).toBe(true);
    expect(isChapterMissionUnlocked(save, id, 2)).toBe(false);
    expect(isChapterMissionUnlocked(save, id, 11)).toBe(false);
    expect(isChapterMissionUnlocked(save, "absent", 1)).toBe(false);
    save.campaign.chapterStars[id] = { s01: 2 };
    expect(nextChapterMission(save, id)).toBe(2);
    expect(isChapterMissionUnlocked(save, id, 2)).toBe(true);
    expect(isChapterMissionUnlocked(save, CAMPAIGN_CHAPTERS[1].id, 2)).toBe(false);
  });
  it("fige les 182 animaux de la campagne classique lorsque le catalogue grandit", () => {
    expect(legacyAnimals).toHaveLength(182);
    expect(getWorld("animaux")!.characters.map(p => p.name)).toEqual(legacyAnimals);
  });
});
