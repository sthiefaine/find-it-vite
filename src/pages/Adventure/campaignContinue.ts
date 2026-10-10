import { chapterMapUrl, chapterStars, chapterUrl, CHAPTER_MISSIONS, getChapter, isChapterMissionUnlocked, nextChapterMission } from "../../content/campaign";
import { stepInfo } from "../../game/adventureRun";
import type { Save } from "../../save/schema";
import { levelUrl, nextLevel } from "./adventureMap";

export function classicContinueStep(save: Save): number {
  const checkpoint = save.campaign.legacyStep ?? (save.campaign.resume?.kind === "legacy" ? save.campaign.resume.step : null);
  if (checkpoint && (checkpoint <= 40 || save.campaign.legacyMixUnlocked)) return checkpoint;
  if (save.campaign.legacyMixUnlocked) return 41;
  const next = nextLevel(save);
  return (next.worldId === "ocean" ? 20 : 0) + next.level;
}

export function classicContinuePath(save: Save): string {
  const info = stepInfo(classicContinueStep(save));
  return info.worldId ? levelUrl(info.worldId, info.level) : `/game?mode=adventure&world=melange&step=${info.step}`;
}

export function campaignContinuePath(save: Save): string {
  const resume = save.campaign.resume;
  if (resume?.kind === "chapter" && getChapter(resume.chapterId)) {
    if (chapterStars(save, resume.chapterId, CHAPTER_MISSIONS) > 0) return chapterMapUrl(resume.chapterId);
    const mission = isChapterMissionUnlocked(save, resume.chapterId, resume.mission) ? resume.mission : nextChapterMission(save, resume.chapterId);
    return chapterUrl(resume.chapterId, mission);
  }
  if (resume?.kind === "legacy") {
    const info = stepInfo(resume.step);
    if (info.worldId) return levelUrl(info.worldId, info.level);
    if (save.campaign.legacyMixUnlocked) return `/game?mode=adventure&world=melange&step=${info.step}`;
  }
  return classicContinuePath(save);
}
