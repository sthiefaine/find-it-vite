import { useTranslation } from "../../i18n";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { themeOptions } from "../../content/playThemes";
import type { PlayMode, PlayThemeId } from "../../content/playThemes";
import { useSaveStore } from "../../save/saveStore";
import { GameIcon } from "../../components/Icons/GameIcon";
import { portraitStyle } from "../../helpers/portraitScale";
import type { GameIconName } from "../../components/Icons/GameIcon";
import { ContractPicker } from "../../components/ProgressGoals/ContractPicker";
import "../../components/Buttons/ui.css";
import "./PlaySetup.css";

const themeIcons: Partial<Record<PlayThemeId, GameIconName>> = {
  ocean: "ocean",
  personnes: "people",
  politique: "people",
  histoire: "people",
  drapeaux: "flags",
};

function ThemeSelection({ mode }: { mode: PlayMode }) {
  const { t: tr } = useTranslation();
  const save = useSaveStore((state) => state.save);
  const loaded = useSaveStore((state) => state.loaded);
  const [selectedId, setSelectedId] = useState<PlayThemeId>("animaux");
  const navigate = useNavigate();
  const options = themeOptions(mode, save);
  const selected = options.find(({ theme }) => theme.id === selectedId);
  const canPlay = loaded && Boolean(selected?.enabled);

  const start = () => {
    if (!canPlay) return;
    navigate(`${mode === "duel" ? "/multiplayer" : "/game"}?theme=${encodeURIComponent(selectedId)}`);
  };

  return (
    <div className="fi-screen play-setup-screen">
      <main className="fi-inner play-setup-inner">
        <h2 id="play-theme-title" className="play-setup-title">{mode === "duel" ? tr("Duel") : tr("Infini")}</h2>
        {mode === "duel" && <p className="play-setup-hint">{tr("Duel en ligne")} · {tr("Chacun son écran")}</p>}
        <div className="play-theme-grid" role="group" aria-labelledby="play-theme-title">
          {options.map(({ theme, availableCount, totalCount, enabled }) => {
            const selected = theme.id === selectedId;
            return (
              <button
                key={theme.id}
                type="button"
                className={`play-theme${selected ? " play-theme-selected" : ""}${theme.comingSoon ? " play-theme-soon" : ""}`}
                disabled={!loaded || !enabled}
                aria-pressed={selected}
                onClick={() => setSelectedId(theme.id)}
              >
                <span className="play-theme-preview" aria-hidden="true">
                  {theme.preview ? <img src={theme.preview} alt="" draggable={false} style={portraitStyle(theme.preview)} /> : <GameIcon name={themeIcons[theme.id] ?? "paw"} />}
                  {selected ? <span className="play-theme-check"><GameIcon name="check" /></span> : null}
                </span>
                <span className="play-theme-name">{tr(theme.label)}</span>
                <span className="play-theme-description">{tr(theme.description)}</span>
                <span className="play-theme-count">
                  {theme.comingSoon ? tr("Bientôt") : (mode === "endless" || theme.id === "politique" || theme.id === "histoire")
                    ? <>{tr("{{available}}/{{total}} disponibles", { available: availableCount, total: totalCount })}{!enabled ? tr(" · 3 requis") : ""}</>
                    : <>{tr(theme.id === "drapeaux" ? "{{count}} drapeaux" : "{{count}} portraits", { count: totalCount })}{!enabled ? tr(" · 3 requis") : ""}</>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="play-setup-hint">
          {(selectedId === "politique" || selectedId === "histoire")
            ? tr("12 personnages de départ. Débloque les autres avec tes étoiles dans l’album.")
            : selectedId === "drapeaux"
            ? tr("Tous les drapeaux sont disponibles dès le départ, sans accessoires.")
            : mode === "endless"
            ? tr("Retrouve des animaux dans l’Aventure ou le Défi du jour pour les débloquer en Infini.")
            : tr("En Duel, tous les portraits du thème sont disponibles.")}
        </p>
        {mode === "endless" && <ContractPicker />}
        <div className="play-setup-action">
          <button type="button" className="play-setup-start" disabled={!canPlay} onClick={start}>
            {!loaded ? tr("Chargement…") : mode === "duel" ? tr("Ouvrir les salons") : tr("Jouer en Infini")}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function PlaySetup() {
  const location = useLocation();
  const mode: PlayMode = new URLSearchParams(location.search).get("mode") === "duel" ? "duel" : "endless";
  // Une arrivée sur cet écran commence toujours sur Animaux, même si seul le mode change.
  return <ThemeSelection key={`${location.key}:${mode}`} mode={mode} />;
}
