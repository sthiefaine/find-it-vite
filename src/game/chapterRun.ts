import { chapterLearningPool, chapterTargets, CHAPTER_DIFFICULTY, getChapter } from "../content/campaign";
import { hash32 } from "../engine/rng";
import type { Tier } from "../engine/types";
import { sceneForIndex } from "../content/scenes";
import { generatePlayableLevel } from "./playableLevel";

export function generateChapterLevel(chapterId: string, mission: number, round: number, tier: Tier) {
  const chapter = getChapter(chapterId);
  if (!chapter) throw new Error("Chapitre inconnu");
  if (!Number.isInteger(round) || round < 1 || round > 5) throw new Error("Avis de chapitre invalide");
  const targets = chapterTargets(chapter, mission);
  const index = CHAPTER_DIFFICULTY[mission - 1];
  const definition = sceneForIndex(index);
  const discovery = mission <= 6;
  return generatePlayableLevel(index, {
    seed: hash32("chapter", chapter.id, chapter.version, mission, round), tier,
    pool: chapterLearningPool(chapter, mission), wantedId: targets[round - 1], allowedModifiers: [],
  }, {
    crowdVariants: false, accessories: !discovery,
    scene: { ...definition, id: `${chapter.id}:s${mission}`, background: chapter.background, accent: chapter.accent,
      hint: "Retrouve le portrait de l’avis de recherche.", ...(discovery && { foliage: undefined, seagulls: false }) },
  });
}
