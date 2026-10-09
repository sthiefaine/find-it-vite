import { useTranslation } from "../../i18n";
import { useState } from "react";
import { UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { defaultThemeForFamily, PLAY_THEMES, playThemeFromSearch, publishedThemePool, THEME_FAMILIES, themeOptions } from "../../content/playThemes";
import type { PlayMode, PlayTheme, PlayThemeId, ThemeFamilyId } from "../../content/playThemes";
import { isPortraitUnlocked } from "../../content/portraitUnlocks";
import { useSaveStore } from "../../save/saveStore";
import { GameIcon } from "../../components/Icons/GameIcon";
import { portraitStyle } from "../../helpers/portraitScale";
import type { CharacterDetails } from "../../helpers/characters";
import type { Save } from "../../save/schema";
import "../../components/Buttons/ui.css";
import "../../components/Buttons/Tile.css";
import "./PlaySetup.css";

const familyColors: Record<ThemeFamilyId, string> = { animaux: "orange", personnages: "pink", drapeaux: "teal" };
const personGroups = [
  { id: "tous", theme: "personnages", label: "Tous" },
  { id: "politique", theme: "politique", label: "Politique" },
  { id: "histoire", theme: "histoire", label: "Histoire" },
] as const;
const countryFlags = { fr: "🇫🇷", br: "🇧🇷", us: "🇺🇸" };

// Keep each illustration inside its theme and prefer three different silhouettes.
const themePreviews = new Map(PLAY_THEMES.map(theme => {
  const pool = publishedThemePool(theme.id);
  const first = pool.find(character => character.imageSrc === theme.preview);
  const portraits: CharacterDetails[] = first ? [first] : [];
  if (theme.id === "personnages" && first) {
    const otherCollection = pool.find(character => character.serie !== first.serie);
    if (otherCollection) portraits.push(otherCollection);
  }
  for (const character of pool) {
    if (portraits.length === 3) break;
    if (!portraits.some(portrait => portrait.name === character.name
      || (portrait.species && portrait.species === character.species))) portraits.push(character);
  }
  for (const character of pool) {
    if (portraits.length === 3) break;
    if (!portraits.includes(character)) portraits.push(character);
  }
  return [theme.id, portraits] as const;
}));

function ThemePortraits({ theme, save }: { theme: PlayTheme; save: Save }) {
  const portraits = themePreviews.get(theme.id) ?? [];
  return <span className="theme-portraits" aria-hidden="true">
    {[0, 1, 2].map(index => {
      const character = portraits[index];
      const hidden = character && theme.family !== "drapeaux" && !isPortraitUnlocked(save, character.name);
      return <span key={character?.name ?? index} className={`theme-portrait${hidden ? " is-mystery" : ""}${!character ? " is-placeholder" : ""}`}>
        {character ? <img src={character.imageSrc} alt="" draggable={false} decoding="async" style={portraitStyle(character.imageSrc)} /> : <UserRound />}
      </span>;
    })}
  </span>;
}

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
  const canPlay = loaded && enabled;
  const needsPortraits = !theme.comingSoon && !enabled;
  const selectTheme = (id: PlayThemeId) => setSelections(current => ({ ...current, [family]: id }));

  function selectGroup(nextGroup: typeof personGroups[number]["id"]) {
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
            <ThemePortraits theme={options.find(option => option.theme.id === selections[item.id] && !option.theme.comingSoon)?.theme
              ?? options.find(option => option.theme.id === item.defaultThemeId)!.theme} save={save} />
            <span className="fi-tile-label">{tr(item.label)}</span>
            {family === item.id ? <span className="play-family-check" aria-hidden="true"><GameIcon name="check" /></span> : null}
          </button>)}
        </div>

        {family === "personnages" ? <div className="play-person-groups" role="group" aria-label={tr("Personnages")}>
          {personGroups.map(item => <button type="button" key={item.id} aria-pressed={group === item.id}
            className={group === item.id ? "is-selected" : ""} onClick={() => selectGroup(item.id)}>
            <ThemePortraits theme={options.find(option => option.theme.id === item.theme)!.theme} save={save} />
            <span>{tr(item.label)}</span>
          </button>)}
        </div> : null}

        {family !== "drapeaux" && !(family === "personnages" && group === "tous") ? <div className={`play-subthemes play-subthemes--${family}`} role="group"
          aria-label={tr(family === "animaux" ? "Habitats" : "Pays")}>
          {visibleOptions.map(({ theme: option, enabled: playable }) => <button
            type="button" key={option.id} aria-pressed={theme.id === option.id} onClick={() => selectTheme(option.id)}
            className={`play-subtheme${theme.id === option.id ? " is-selected" : ""}${option.comingSoon ? " is-soon" : ""}`}
          >
            <ThemePortraits theme={option} save={save} />
            <span className="play-subtheme-label">{option.region ? <span aria-hidden="true">{countryFlags[option.region]} </span> : null}{tr(option.shortLabel)}</span>
            {option.comingSoon ? <small>{tr("Bientôt")}</small> : !playable && loaded ? <span className="play-subtheme-lock" aria-hidden="true">✦</span> : null}
          </button>)}
        </div> : null}

        <section className={`play-theme-spotlight play-theme-spotlight--${family}`} aria-label={tr(theme.label)}>
          <div className="play-theme-art" aria-hidden="true">
            <span className="play-theme-glow" />
            <ThemePortraits key={theme.id} theme={theme} save={save} />
            <span className="play-theme-spark play-theme-spark--left">✦</span>
            <span className="play-theme-spark play-theme-spark--right">✦</span>
          </div>
          <div className="play-theme-copy">
            <h3>{tr(family === "personnages" && theme.id !== "personnages" ? theme.shortLabel : theme.label)}</h3>
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
          {theme.comingSoon ? tr("Bientôt") : theme.id === "personnages"
            ? tr("Tous tes personnages débloqués, de la politique à l’histoire.") : family === "personnages"
            ? tr("12 personnages de départ. Débloque les autres avec tes étoiles dans l’album.")
            : family === "drapeaux"
            ? tr("Tous les drapeaux sont disponibles dès le départ, sans accessoires.")
            : mode === "endless"
            ? tr("Débloque les animaux dans l’Aventure ou avec tes étoiles dans l’album.")
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
