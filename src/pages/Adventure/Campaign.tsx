import { useNavigate, useSearchParams } from "react-router-dom";
import { useLayoutEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { CAMPAIGN_CHAPTERS, chapterMapUrl, chapterPool, chapterStars, chapterTargets, chapterUrl, CHAPTER_MISSIONS, getChapter, isChapterMissionUnlocked, nextChapterMission } from "../../content/campaign";
import type { CampaignChapter } from "../../content/campaign";
import type { CharacterDetails } from "../../helpers/characters";
import { GameIcon } from "../../components/Icons/GameIcon";
import { useSaveStore } from "../../save/saveStore";
import { useTranslation } from "../../i18n";
import { isPortraitUnlocked } from "../../content/portraitUnlocks";
import { campaignContinuePath } from "./campaignContinue";
import "./Campaign.css";

const MISSION_X = [50, 73, 37, 65, 27, 52, 74, 35, 67, 50];
const MISSION_GAP = 132;
const MAP_HEIGHT = CHAPTER_MISSIONS * MISSION_GAP + 50;
const MISSION_PATH = MISSION_X.map((x, i) => {
  const y = 75 + i * MISSION_GAP;
  return i === 0 ? `M ${x} ${y}` : `C ${MISSION_X[i - 1]} ${y - MISSION_GAP / 2}, ${x} ${y - MISSION_GAP / 2}, ${x} ${y}`;
}).join(" ");

function chapterTheme(chapter: CampaignChapter) {
  if (chapter.country) return chapter.country.toLowerCase();
  if (chapter.id.includes("ferme")) return "farm";
  if (chapter.id.includes("monde")) return "wild";
  if (chapter.id.includes("ocean") || chapter.id.includes("rivieres")) return "ocean";
  return chapter.id.includes("cuisine") ? "kitchen" : "cinema";
}

function ChapterArt({ chapter, portraits }: { chapter: CampaignChapter; portraits: CharacterDetails[] }) {
  const theme = chapterTheme(chapter);
  return <div className={`campaign-art campaign-art-${theme}`} aria-hidden="true">
    <svg className="campaign-scenery" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" focusable="false">
      <circle cx="322" cy="40" r="25" className="campaign-sun" />
      <path d="m45 32 3 10 10 3-10 3-3 10-3-10-10-3 10-3Zm305 52 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#fff3bd" />
      {theme === "ocean" ? <>
        <path d="M0 115q50-30 100 0t100 0t100 0t100 0v100H0Z" fill="#53e4d1" opacity=".48" />
        <path d="M0 157q50-28 100 0t100 0t100 0t100 0v60H0Z" fill="#1863a2" opacity=".5" />
        <g fill="none" stroke="#b7fff0" strokeWidth="3" opacity=".6"><circle cx="44" cy="88" r="7" /><circle cx="352" cy="134" r="11" /><circle cx="332" cy="109" r="4" /></g>
      </> : theme === "farm" || theme === "wild" || theme === "br" ? <>
        <path d="M0 138q100-80 200-10t200-10v100H0Z" fill="#b3f36e" opacity=".7" />
        <path d="M0 190q150-100 400-40v60H0Z" fill="#338559" opacity=".75" />
        {theme === "farm" && <g transform="translate(308 82)" stroke="#375548" strokeWidth="3"><path d="M0 30 28 8l28 22v40H0Z" fill="#ffad83" /><path d="m-5 32 33-29 33 29" fill="none" /><path d="M19 44h19v26H19Z" fill="#fff1be" /></g>}
      </> : <>
        <path d="m0 0 85 0-38 200H0Zm400 0h-85l38 200h47Z" fill="#fff0a2" opacity=".14" />
        <path d="M0 162q200-25 400 0v50H0Z" fill="#3d195e" opacity=".3" />
        <path d="M32 0v200M368 0v200" stroke="#fff3bd" strokeWidth="2" strokeDasharray="5 10" opacity=".35" />
      </>}
    </svg>
    {portraits.slice(0, 3).map((portrait, i) => <img key={portrait.name} className={`campaign-art-portrait campaign-art-portrait-${i}`} src={portrait.imageSrc} alt="" loading="lazy" draggable="false" />)}
  </div>;
}

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
    return <div ref={screen} className="fi-screen campaign-screen campaign-detail">
      <div className="campaign-detail-inner">
        <header className="campaign-heading">
          <button type="button" className="campaign-back" onClick={() => navigate("/adventure")}><ArrowLeft size={18} aria-hidden="true" />{tr("Chapitres")}</button>
          <div className="campaign-hero">
            <ChapterArt chapter={chapter} portraits={pool} />
            <h1>{tr(chapter.label)}</h1>
            <p><GameIcon name={chapter.family === "animaux" ? "paw" : "people"} />{tr("{{count}} portraits à découvrir", { count: pool.length })}</p>
          </div>
        </header>
        <section className="campaign-preview" aria-label={tr(finished ? "Réviser les portraits" : "Les prochains portraits")}>
          <h2><GameIcon name="star" />{tr(finished ? "Réviser les portraits" : "Les prochains portraits")}</h2>
          <div className="campaign-portraits">{preview.map(p => <figure key={p.name}><img src={p.imageSrc} alt="" /><figcaption>{tr(p.label)}</figcaption></figure>)}</div>
        </section>
        <section className="campaign-route" aria-label={tr("Étapes du chapitre")} style={{ height: MAP_HEIGHT }}>
          <svg className="campaign-route-line" viewBox={`0 0 100 ${MAP_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true"><path d={MISSION_PATH} vectorEffect="non-scaling-stroke" /></svg>
          {MISSION_X.map((x, i) => {
            const mission = i + 1;
            const open = isChapterMissionUnlocked(save, chapter.id, mission);
            const stars = chapterStars(save, chapter.id, mission);
            const isCurrent = mission === current;
            const finale = mission === CHAPTER_MISSIONS;
            return <div key={mission} className={`campaign-stop${isCurrent ? " is-current" : ""}${stars ? " is-complete" : ""}${open ? "" : " is-locked"}${finale ? " is-finale" : ""}`} style={{ left: `${x}%`, top: 75 + i * MISSION_GAP }}>
              {isCurrent && <img className="campaign-current-portrait" src={preview[0].imageSrc} alt="" />}
              <button type="button" className="campaign-mission" disabled={!loaded || !open} onClick={() => navigate(chapterUrl(chapter.id, mission))} aria-current={isCurrent ? "step" : undefined} aria-label={`${tr("Étape {{level}}", { level: mission })}, ${tr("{{count}} étoiles sur 3", { count: stars })}${open ? "" : tr(", fermée")}`}>
                {finale ? <GameIcon name="trophy" /> : !open ? <Lock size={24} aria-hidden="true" /> : <span>{mission}</span>}
                {!open && !finale && <span className="campaign-mission-index" aria-hidden="true">{mission}</span>}
                {!open && finale && <Lock className="campaign-mission-lock" size={20} aria-hidden="true" />}
                {stars > 0 && <Check className="campaign-mission-check" size={20} aria-hidden="true" />}
              </button>
              <span className="campaign-stop-label">{tr(finale ? "Finale" : mission <= 6 ? "Découvrir" : "Réviser les portraits")}</span>
              <span className="campaign-stars" aria-hidden="true">{[1, 2, 3].map(star => <span key={star} className={star <= stars ? "is-earned" : ""}>★</span>)}</span>
            </div>;
          })}
        </section>
        <p className="campaign-note">{tr("Les portraits trouvés dans ce chapitre se débloquent gratuitement.")}</p>
      </div>
      <div className="campaign-continue-bar"><button type="button" className="campaign-play" disabled={!loaded} onClick={() => navigate(chapterUrl(chapter.id, current))}><GameIcon name="play" /><span>{tr(finished ? "Réviser les portraits" : "Continuer le chapitre")}<small>{tr("Étape {{level}}", { level: current })}</small></span><ArrowRight size={22} aria-hidden="true" /></button></div>
    </div>;
  }

  return <div ref={screen} className="fi-screen campaign-screen campaign-hub">
    <header className="campaign-heading"><GameIcon className="campaign-heading-icon" name="album" /><h1>{tr("Choisis ton chapitre")}</h1><p>{tr("Découvre les portraits, puis retrouve-les dans la foule.")}</p></header>
    {resume && <button type="button" className="campaign-play campaign-resume" disabled={!loaded} onClick={() => navigate(continuePath)}><GameIcon name="play" /><span>{tr("Continuer l'aventure")}</span><ArrowRight size={22} aria-hidden="true" /></button>}
    <div className="campaign-chapters">
      {CAMPAIGN_CHAPTERS.map(c => {
        const pool = chapterPool(c);
        const completed = Array.from({ length: CHAPTER_MISSIONS }, (_, i) => chapterStars(save, c.id, i + 1)).filter(Boolean).length;
        const discovered = pool.filter(p => isPortraitUnlocked(save, p.name)).length;
        return <button type="button" key={c.id} className={`campaign-chapter campaign-theme-${chapterTheme(c)}`} onClick={() => navigate(chapterMapUrl(c.id))}>
          <div className="campaign-cover"><ChapterArt chapter={c} portraits={pool} />
            <span className="campaign-card-badge">{c.country ? <img src={`/assets/images/characters/flags/${c.country.toLowerCase()}.png`} alt="" /> : <GameIcon name={c.id.includes("ocean") || c.id.includes("rivieres") ? "ocean" : c.family === "animaux" ? "paw" : "people"} />}</span>
            {completed === CHAPTER_MISSIONS && <span className="campaign-card-complete"><Check size={20} aria-hidden="true" /></span>}
          </div>
          <div className="campaign-card-body"><strong>{tr(c.label)}</strong><span className="campaign-card-count">{tr("{{count}} portraits à découvrir", { count: pool.length })}</span>
            <div className="campaign-chapter-progress"><span>{tr("{{found}}/{{total}} découverts", { found: discovered, total: pool.length })}</span><ArrowRight size={18} aria-hidden="true" /></div>
            <span className="campaign-progress-track" role="progressbar" aria-label={`${tr(c.label)} — ${tr("Étapes du chapitre")}`} aria-valuemin={0} aria-valuemax={CHAPTER_MISSIONS} aria-valuenow={completed}><span style={{ width: `${completed / CHAPTER_MISSIONS * 100}%` }} /></span>
          </div>
        </button>;
      })}
    </div>
    <button type="button" className="campaign-legacy" onClick={() => navigate("/adventure?track=legacy")}><GameIcon name="infinity" /><span><strong>{tr("Campagne classique")}</strong><small>{tr("Retrouve tes étapes et ton Grand Mélange.")}</small></span><ArrowRight size={22} aria-hidden="true" /></button>
  </div>;
}
