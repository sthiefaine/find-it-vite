import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { themeOptions } from "../../content/playThemes";
import type { PlayMode, PlayThemeId } from "../../content/playThemes";
import { useSaveStore } from "../../save/saveStore";
import { GameIcon } from "../../components/Icons/GameIcon";
import type { GameIconName } from "../../components/Icons/GameIcon";
import "../../components/Buttons/ui.css";
import "./PlaySetup.css";

const themeIcons: Partial<Record<PlayThemeId, GameIconName>> = {
  ocean: "ocean",
  personnes: "people",
  drapeaux: "flags",
};

function ThemeSelection({ mode }: { mode: PlayMode }) {
  const save = useSaveStore((state) => state.save);
  const loaded = useSaveStore((state) => state.loaded);
  const [selectedId, setSelectedId] = useState<PlayThemeId>("animaux");
  const [duelDevice, setDuelDevice] = useState<"online" | "local">("online");
  const navigate = useNavigate();
  const options = themeOptions(mode, save);
  const selected = options.find(({ theme }) => theme.id === selectedId);
  const canPlay = loaded && Boolean(selected?.enabled);

  const start = () => {
    if (!canPlay) return;
    navigate(`${mode === "duel" ? (duelDevice === "online" ? "/multiplayer" : "/duel") : "/game"}?theme=${encodeURIComponent(selectedId)}`);
  };

  return (
    <div className="fi-screen play-setup-screen">
      <main className="fi-inner play-setup-inner">
        <h2 id="play-theme-title" className="play-setup-title">{mode === "duel" ? "Duel" : "Infini"}</h2>
        {mode === "duel" && <div className="play-duel-devices" role="group" aria-label="Où jouer au duel ?">
          <button type="button" aria-pressed={duelDevice === "online"} onClick={() => setDuelDevice("online")}>
            <GameIcon name="duel" /><strong>En ligne</strong><span>Chacun son écran</span>
          </button>
          <button type="button" aria-pressed={duelDevice === "local"} onClick={() => setDuelDevice("local")}>
            <GameIcon name="people" /><strong>Côte à côte</strong><span>Sur le même écran</span>
          </button>
        </div>}
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
                  {theme.preview ? <img src={theme.preview} alt="" draggable={false} /> : <GameIcon name={themeIcons[theme.id] ?? "paw"} />}
                  {selected ? <span className="play-theme-check"><GameIcon name="check" /></span> : null}
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
            {!loaded ? "Chargement…" : mode === "duel" ? (duelDevice === "online" ? "Ouvrir les salons" : "Préparer le duel") : "Jouer en Infini"}
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
