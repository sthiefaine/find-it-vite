import { describe, expect, it } from "vitest";
import { campaignContinuePath, classicContinuePath } from "../campaignContinue";
import { defaultSave } from "../../../save/schema";

describe("reprendre la campagne", () => {
  it("reprend la mission choisie, même si le joueur rejoue un ancien niveau", () => {
    const save = defaultSave();
    save.adventure.stars = { "animaux:20": 3, "ocean:19": 3 };
    save.campaign.resume = { kind: "legacy", step: 4 };
    expect(campaignContinuePath(save)).toBe("/game?mode=adventure&world=animaux&level=4");
    save.campaign.legacyMixUnlocked = true;
    expect(classicContinuePath(save)).toBe("/game?mode=adventure&world=animaux&level=4");
    save.campaign.resume = { kind: "chapter", chapterId: "personnages-cinema-01", mission: 1 };
    save.campaign.chapterStars["personnages-cinema-01"] = { s01: 3, s02: 2 };
    expect(campaignContinuePath(save)).toBe("/game?mode=adventure&chapter=personnages-cinema-01&level=1");
    save.campaign.legacyStep = 68;
    expect(classicContinuePath(save)).toBe("/game?mode=adventure&world=melange&step=68");
  });
  it("garde la reprise du Grand Mélange et retourne à la carte après une finale", () => {
    const save = defaultSave();
    save.campaign.legacyMixUnlocked = true;
    save.campaign.resume = { kind: "legacy", step: 78 };
    expect(campaignContinuePath(save)).toBe("/game?mode=adventure&world=melange&step=78");
    save.campaign.resume = { kind: "chapter", chapterId: "personnages-cinema-01", mission: 10 };
    save.campaign.chapterStars["personnages-cinema-01"] = { s10: 3 };
    expect(campaignContinuePath(save)).toBe("/adventure?chapter=personnages-cinema-01");
  });
});
