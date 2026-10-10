import { useNavigate, useSearchParams } from "react-router-dom";
import { useLayoutEffect, useRef } from "react";
import { ArrowLeft, Check, Lock, Play, BookOpen } from "lucide-react";
import { CAMPAIGN_CHAPTERS, chapterMapUrl, chapterPool, chapterStars, chapterTargets, chapterUrl, CHAPTER_MISSIONS, getChapter, isChapterMissionUnlocked, nextChapterMission } from "../../content/campaign";
import { useSaveStore } from "../../save/saveStore";
import { useTranslation } from "../../i18n";
import { isPortraitUnlocked } from "../../content/portraitUnlocks";
import { campaignContinuePath } from "./campaignContinue";
import "./Campaign.css";

export default function Campaign() {
  const { t: tr } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const save = useSaveStore(state => state.save);
  const loaded = useSaveStore(state => state.loaded);
  const chapter = getChapter(params.get("chapter") ?? "");
  const resume = save.campaign.resume;
  const continuePath = campaignContinuePath(save);
  const screen = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { screen.current?.scrollTo(0, 0); }, [chapter?.id]);

  if (chapter) {
    const pool = chapterPool(chapter);
    const current = nextChapterMission(save, chapter.id);
    const finished = chapterStars(save, chapter.id, CHAPTER_MISSIONS) > 0;
    const preview = chapterTargets(chapter, current).map(id => pool.find(p => p.name === id)!);
    return <div ref={screen} className="fi-screen campaign-screen" style={{ background: chapter.background }}>
      <header className="campaign-heading">
        <button type="button" className="campaign-back" onClick={() => navigate("/adventure")}><ArrowLeft size={18} aria-hidden="true" />{tr("Chapitres")}</button>
        <h1>{tr(chapter.label)}</h1>
        <p>{tr("{{count}} portraits à découvrir", { count: pool.length })}</p>
      </header>
      <section className="campaign-preview" aria-label={tr("Les prochains portraits")}>
        <h2>{tr(finished ? "Réviser les portraits" : "Les prochains portraits")}</h2>
        <div className="campaign-portraits">{preview.map(p => <figure key={p.name}><img src={p.imageSrc} alt="" /><figcaption>{tr(p.label)}</figcaption></figure>)}</div>
      </section>
      <div className="campaign-missions" aria-label={tr("Étapes du chapitre")}>
        {Array.from({ length: CHAPTER_MISSIONS }, (_, i) => {
          const mission = i + 1;
          const open = isChapterMissionUnlocked(save, chapter.id, mission);
          const stars = chapterStars(save, chapter.id, mission);
          return <button key={mission} type="button" className={`campaign-mission${mission === current ? " is-current" : ""}`} disabled={!loaded || !open} onClick={() => navigate(chapterUrl(chapter.id, mission))} aria-label={`${tr("Étape {{level}}", { level: mission })}, ${stars}/3`}>
            <span className="campaign-mission-number">{open ? mission : <Lock size={18} aria-hidden="true" />}</span>
            <span>{tr(mission === 10 ? "Finale" : mission <= 6 ? "Découvrir" : "Réviser les portraits")}</span>
            <span className="campaign-stars" aria-hidden="true">{"★".repeat(stars)}{"☆".repeat(3 - stars)}</span>
          </button>;
        })}
      </div>
      <button type="button" className="campaign-play" disabled={!loaded} onClick={() => navigate(chapterUrl(chapter.id, current))}><Play size={20} fill="currentColor" aria-hidden="true" />{tr(finished ? "Réviser les portraits" : "Continuer le chapitre")}</button>
      <p className="campaign-note">{tr("Les portraits trouvés dans ce chapitre se débloquent gratuitement.")}</p>
    </div>;
  }

  return <div ref={screen} className="fi-screen campaign-screen">
    <header className="campaign-heading"><h1>{tr("Choisis ton chapitre")}</h1><p>{tr("Découvre les portraits, puis retrouve-les dans la foule.")}</p></header>
    {resume && <button type="button" className="campaign-play" disabled={!loaded} onClick={() => navigate(continuePath)}><Play size={20} fill="currentColor" aria-hidden="true" />{tr("Continuer l'aventure")}</button>}
    <div className="campaign-chapters">
      {CAMPAIGN_CHAPTERS.map(c => {
        const pool = chapterPool(c);
        const completed = Array.from({ length: CHAPTER_MISSIONS }, (_, i) => chapterStars(save, c.id, i + 1)).filter(Boolean).length;
        const discovered = pool.filter(p => isPortraitUnlocked(save, p.name)).length;
        return <button type="button" key={c.id} className="campaign-chapter" onClick={() => navigate(chapterMapUrl(c.id))}>
          <div className="campaign-cover" style={{ background: c.background }}>{pool.slice(0, 3).map(p => <img key={p.name} src={p.imageSrc} alt="" loading="lazy" />)}{completed === CHAPTER_MISSIONS && <Check size={24} aria-hidden="true" />}</div>
          <strong>{tr(c.label)}</strong>
          <span>{tr("{{count}} portraits à découvrir", { count: pool.length })}</span>
          <span className="campaign-chapter-progress">{tr("{{found}}/{{total}} découverts", { found: discovered, total: pool.length })} · {completed}/{CHAPTER_MISSIONS}</span>
        </button>;
      })}
    </div>
    <button type="button" className="campaign-legacy" onClick={() => navigate("/adventure?track=legacy")}><BookOpen size={20} aria-hidden="true" /><span><strong>{tr("Campagne classique")}</strong><small>{tr("Retrouve tes étapes et ton Grand Mélange.")}</small></span></button>
  </div>;
}
