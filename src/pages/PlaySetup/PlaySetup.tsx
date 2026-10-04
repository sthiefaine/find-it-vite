import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { themeOptions } from "../../content/playThemes";
import type { PlayMode, PlayThemeId } from "../../content/playThemes";
import { useSaveStore } from "../../save/saveStore";
import "../../components/Buttons/ui.css";
import "./PlaySetup.css";

function ThemeSelection({ mode }: { mode: PlayMode }) {
  const save = useSaveStore((state) => state.save);
  const loaded = useSaveStore((state) => state.loaded);
  const [selectedId, setSelectedId] = useState<PlayThemeId>("animaux");
  const navigate = useNavigate();
  const options = themeOptions(mode, save);
  const selected = options.find(({ theme }) => theme.id === selectedId);
  const canPlay = loaded && Boolean(selected?.enabled);

  const start = () => {
    if (!canPlay) return;
    navigate(`${mode === "duel" ? "/duel" : "/game"}?theme=${encodeURIComponent(selectedId)}`);
  };

  return (
    <div className="fi-screen play-setup-screen">
      <main className="fi-inner play-setup-inner">
        <h2 id="play-theme-title" className="play-setup-title">{mode === "duel" ? "Duel" : "Infini"}</h2>
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
                  {theme.preview ? <img src={theme.preview} alt="" draggable={false} /> : <span>{theme.emoji}</span>}
                  {selected ? <span className="play-theme-check">✓</span> : null}
                </span>
                <span className="play-theme-name">{theme.label}</span>
                <span className="play-theme-description">{theme.description}</span>
                <span className="play-theme-count">
                  {theme.comingSoon ? "Bientôt" : mode === "endless"
                    ? <>{availableCount}/{totalCount} disponibles{!enabled ? " · 3 requis" : ""}</>
                    : <>{totalCount} animaux{!enabled ? " · 3 requis" : ""}</>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="play-setup-hint">
          {mode === "endless"
            ? "Retrouve des animaux dans l’Aventure ou le Défi du jour pour les débloquer en Infini."
            : "En Duel, tous les animaux du thème sont disponibles."}
        </p>
        <div className="play-setup-action">
          <button type="button" className="play-setup-start" disabled={!canPlay} onClick={start}>
            {!loaded ? "Chargement…" : mode === "duel" ? "Préparer le duel" : "Jouer en Infini"}
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
