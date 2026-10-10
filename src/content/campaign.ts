import definitions from "./campaignChapters.json";
import { animalsPack, celebritiesPack, historyPack, peoplePack } from "../helpers/characters";
import type { CharacterDetails } from "../helpers/characters";
import type { Save } from "../save/schema";

export const CHAPTER_MISSIONS = 10;
export const CHAPTER_COMPLETION_STARS = 10;
export type CampaignChapter = {
  id: string; label: string; family: string; version: number; cohortIds: string[];
  background: string; accent: string; country?: string;
};
const portraits = new Map([...animalsPack, ...peoplePack, ...historyPack, ...celebritiesPack].map(p => [p.name, p]));
export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[] = definitions;
export const getChapter = (id: string) => CAMPAIGN_CHAPTERS.find(chapter => chapter.id === id);
export const chapterPool = (chapter: CampaignChapter): CharacterDetails[] => chapter.cohortIds.map(id => {
  const portrait = portraits.get(id);
  if (!portrait) throw new Error(`Portrait absent du chapitre ${chapter.id} : ${id}`);
  return portrait;
});
export const chapterStars = (save: Pick<Save, "campaign">, id: string, mission: number) => save.campaign.chapterStars[id]?.[`s${String(mission).padStart(2, "0")}`] ?? 0;
export const isChapterMissionUnlocked = (save: Pick<Save, "campaign">, id: string, mission: number) =>
  !!getChapter(id) && Number.isInteger(mission) && mission >= 1 && mission <= CHAPTER_MISSIONS && (mission === 1 || chapterStars(save, id, mission - 1) > 0);
export function nextChapterMission(save: Pick<Save, "campaign">, id: string): number {
  for (let mission = 1; mission <= CHAPTER_MISSIONS; mission++) if (chapterStars(save, id, mission) < 1) return mission;
  return CHAPTER_MISSIONS;
}
export const chapterUrl = (id: string, mission: number) => `/game?mode=adventure&chapter=${encodeURIComponent(id)}&level=${mission}`;
export const chapterMapUrl = (id: string) => `/adventure?chapter=${encodeURIComponent(id)}`;
export const completionReceipt = (chapter: CampaignChapter) => `chapter:${chapter.id}:complete:v${chapter.version}`;

// Deux portraits d'appui, puis trois découvertes et deux révisions par mission.
// L'ordre appartient au manifeste publié, jamais au catalogue global qui grandit.
export function chapterTargets(chapter: CampaignChapter, mission: number): string[] {
  if (!Number.isInteger(mission) || mission < 1 || mission > CHAPTER_MISSIONS) throw new Error("Mission de chapitre invalide");
  const ids = chapter.cohortIds;
  if (ids.length < 5 || ids.length > 20 || new Set(ids).size !== ids.length) throw new Error("Cohorte invalide");
  const start = 2 + (mission - 1) * 3;
  const fresh = mission <= 6 ? ids.slice(start, start + 3) : [];
  const learned = ids.slice(0, Math.min(ids.length, Math.max(2, start)));
  const result = [...fresh];
  const offset = (mission - 1) * 2;
  for (let k = 0; result.length < 5 && k < learned.length; k++) {
    const id = learned[(offset + k) % learned.length];
    if (!result.includes(id)) result.push(id);
  }
  if (result.length !== 5) throw new Error("Cinq cibles distinctes sont nécessaires");
  return result;
}
export function chapterLearningPool(chapter: CampaignChapter, mission: number): CharacterDetails[] {
  return chapterPool(chapter).slice(0, mission <= 6 ? Math.min(chapter.cohortIds.length, 2 + mission * 3) : chapter.cohortIds.length);
}
export const CHAPTER_DIFFICULTY = [1, 2, 3, 4, 7, 12, 13, 15, 18, 20] as const;
