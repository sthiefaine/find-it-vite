import { useTranslation } from "../../i18n";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { defaultThemeForFamily, playThemeFromSearch, THEME_FAMILIES, themeOptions } from "../../content/playThemes";
import type { PlayMode, PlayTheme, PlayThemeId, ThemeFamilyId } from "../../content/playThemes";
import { isPortraitUnlocked } from "../../content/portraitUnlocks";
import { useSaveStore } from "../../save/saveStore";
import { GameIcon } from "../../components/Icons/GameIcon";
import type { GameIconName } from "../../components/Icons/GameIcon";
import { portraitStyle } from "../../helpers/portraitScale";
import "../../components/Buttons/ui.css";
import "../../components/Buttons/Tile.css";
import "./PlaySetup.css";

const familyIcons: Record<ThemeFamilyId, GameIconName> = { animaux: "paw", personnages: "people", drapeaux: "flags" };
const familyColors: Record<ThemeFamilyId, string> = { animaux: "orange", personnages: "pink", drapeaux: "teal" };
const personGroups = ["politique", "histoire"] as const;
const countryFlags = { fr: "🇫🇷", br: "🇧🇷", us: "🇺🇸" };

function albumLink(theme: PlayTheme) {
  const collection = theme.family === "personnages" ? theme.group : "animaux";
  const params = new URLSearchParams({ collection: collection ?? "animaux" });
  if (theme.family === "animaux" && theme.id !== "animaux") params.set("category", theme.id);
  if (theme.group === "histoire" && theme.region) params.set("category", theme.region);
  return `/album?${params}`;
}

function ThemeSelection({ mode, search }: { mode: PlayMode; search: string }) {
  const { t: tr } = useTranslation();
  const save = useSaveStore((state) => state.save);
  const loaded = useSaveStore((state) => state.loaded);
  const navigate = useNavigate();
  const options = themeOptions(mode, save).filter(({ theme }) => theme.id !== "personnes");
  const initialTheme = options.find(({ theme }) => theme.id === playThemeFromSearch(search))!.theme;
  const [family, setFamily] = useState<ThemeFamilyId>(initialTheme.family);
  const [selections, setSelections] = useState<Record<ThemeFamilyId, PlayThemeId>>(() => ({
    animaux: defaultThemeForFamily("animaux"), personnages: defaultThemeForFamily("personnages"),
    drapeaux: defaultThemeForFamily("drapeaux"), [initialTheme.family]: initialTheme.id,
  }));
  const selectedId = selections[family];
  const selected = options.find(({ theme }) => theme.id === selectedId)!;
  const { theme, availableCount, totalCount, enabled } = selected;
  const group = theme.group ?? "politique";
  const visibleOptions = options.filter(({ theme: candidate }) => candidate.family === family
    && (family !== "personnages" || candidate.group === group))
    .sort((left, right) => Number(right.theme.id === "ferme") - Number(left.theme.id === "ferme"));
  const previewId = theme.preview?.split("/").pop()?.replace(/\.png$/, "");
  const hiddenPortrait = Boolean(theme.preview && family !== "drapeaux" && previewId
    && (family === "personnages" || mode === "endless") && !isPortraitUnlocked(save, previewId));
  const canPlay = loaded && enabled;
  const needsPortraits = !theme.comingSoon && !enabled;
  const selectTheme = (id: PlayThemeId) => setSelections(current => ({ ...current, [family]: id }));

  function selectGroup(nextGroup: typeof personGroups[number]) {
    if (nextGroup === group) return;
    const next = options.find(({ theme }) => theme.family === "personnages" && theme.group === nextGroup);
    if (next) selectTheme(next.theme.id);
  }

  function start() {
    if (!loaded) return;
    if (needsPortraits) { navigate(albumLink(theme)); return; }
    if (canPlay) navigate(`${mode === "duel" ? "/multiplayer" : "/game"}?theme=${encodeURIComponent(selectedId)}`);
  }

  return (
    <div className="fi-screen play-setup-screen">
      <main className="fi-inner play-setup-inner">
        <header className="play-setup-heading">
          <GameIcon name={mode === "duel" ? "duel" : "infinity"} />
          <div>
            <h2 className="play-setup-title">{mode === "duel" ? tr("Duel") : tr("Infini")}</h2>
            <p>{mode === "duel" ? tr("Duel en ligne") : tr("Choisis ton univers")}</p>
          </div>
        </header>

        <div className="play-families" role="group" aria-label={tr("Choisis ton univers")}>
          {THEME_FAMILIES.map(item => <button
            type="button" key={item.id} aria-pressed={family === item.id} onClick={() => setFamily(item.id)}
            className={`fi-tile fi-tile-${familyColors[item.id]} play-family${family === item.id ? " is-selected" : ""}`}
          >
            <span className="fi-tile-icon" aria-hidden="true"><GameIcon name={familyIcons[item.id]} /></span>
            <span className="fi-tile-label">{tr(item.label)}</span>
            {family === item.id ? <span className="play-family-check" aria-hidden="true"><GameIcon name="check" /></span> : null}
          </button>)}
        </div>

        {family === "personnages" ? <div className="play-person-groups" role="group" aria-label={tr("Personnages")}>
          {personGroups.map(item => <button type="button" key={item} aria-pressed={group === item}
            className={group === item ? "is-selected" : ""} onClick={() => selectGroup(item)}>
            <span aria-hidden="true">{item === "politique" ? "🏛️" : "📜"}</span>{tr(item === "politique" ? "Politique" : "Histoire")}
          </button>)}
        </div> : null}

        {family !== "drapeaux" ? <div className={`play-subthemes play-subthemes--${family}`} role="group"
          aria-label={tr(family === "animaux" ? "Habitats" : "Pays")}>
          {visibleOptions.map(({ theme: option, enabled: playable }) => <button
            type="button" key={option.id} aria-pressed={theme.id === option.id} onClick={() => selectTheme(option.id)}
            className={`play-subtheme${theme.id === option.id ? " is-selected" : ""}${option.comingSoon ? " is-soon" : ""}`}
          >
            <span className="play-subtheme-symbol" aria-hidden="true">{option.region ? countryFlags[option.region] : option.emoji}</span>
            <span>{tr(option.shortLabel)}</span>
            {option.comingSoon ? <small>{tr("Bientôt")}</small> : !playable && loaded ? <span className="play-subtheme-lock" aria-hidden="true">✦</span> : null}
          </button>)}
        </div> : null}

        <section className={`play-theme-spotlight play-theme-spotlight--${family}`} aria-label={tr(theme.label)}>
          <div className={`play-theme-art${hiddenPortrait ? " is-mystery" : ""}`} aria-hidden="true">
            <span className="play-theme-glow" />
            {theme.preview ? <img src={theme.preview} alt="" draggable={false} style={portraitStyle(theme.preview)} />
              : <GameIcon name={familyIcons[family]} />}
            <span className="play-theme-spark play-theme-spark--left">✦</span>
            <span className="play-theme-spark play-theme-spark--right">✦</span>
            {hiddenPortrait ? <span className="play-theme-mystery">?</span> : null}
          </div>
          <div className="play-theme-copy">
            <h3>{tr(family === "personnages" ? theme.shortLabel : theme.label)}</h3>
            {theme.comingSoon ? <p className="play-theme-count">{tr("Ce thème arrive bientôt.")}</p> : <>
              <span className="fi-chip play-theme-count">
                <GameIcon name={family === "drapeaux" ? "flags" : "album"} />
                {tr("{{available}}/{{total}} débloqués", { available: availableCount, total: totalCount })}
              </span>
              {needsPortraits ? <div className="play-theme-unlock">
                <div className="play-theme-unlock-track" role="progressbar" aria-valuemin={0} aria-valuemax={3}
                  aria-valuenow={availableCount} aria-label={tr(theme.label)}>
                  <span style={{ width: `${Math.min(100, availableCount / 3 * 100)}%` }} />
                </div>
                <p>{tr("Débloque encore {{count}} portraits pour jouer ici.", { count: 3 - availableCount })}</p>
              </div> : null}
            </>}
          </div>
        </section>

        <p className="play-setup-hint">
          {theme.comingSoon ? tr("Bientôt") : family === "personnages"
            ? tr("12 personnages de départ. Débloque les autres avec tes étoiles dans l’album.")
            : family === "drapeaux"
            ? tr("Tous les drapeaux sont disponibles dès le départ, sans accessoires.")
            : mode === "endless"
            ? tr("Retrouve des animaux dans l’Aventure ou le Défi du jour pour les débloquer en Infini.")
            : tr("En Duel, tous les portraits du thème sont disponibles.")}
        </p>
        <div className="play-setup-action">
          <button type="button" className="play-setup-start" disabled={!loaded || theme.comingSoon} onClick={start}>
            <GameIcon name={needsPortraits ? "album" : mode === "duel" ? "duel" : "play"} />
            {!loaded ? tr("Chargement…") : theme.comingSoon ? tr("Bientôt") : needsPortraits ? tr("Ouvrir l’album")
              : mode === "duel" ? tr("Ouvrir les salons") : tr("Jouer en Infini")}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function PlaySetup() {
  const location = useLocation();
  const mode: PlayMode = new URLSearchParams(location.search).get("mode") === "duel" ? "duel" : "endless";
  return <ThemeSelection key={`${location.key}:${mode}`} mode={mode} search={location.search} />;
}
