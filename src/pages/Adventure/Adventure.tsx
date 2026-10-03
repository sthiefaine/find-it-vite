import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useSaveStore } from "../../save/saveStore";
import { LEVELS_PER_WORLD, WORLDS } from "../../content/worlds";
import type { World } from "../../content/worlds";
import { isLevelUnlocked, isWorldUnlocked, starsFor } from "../../content/progress";
import type { Save } from "../../save/schema";
import { levelUrl, nextLevel, nodeX, starsMissing, worldStars } from "./adventureMap";
import type { LevelRef } from "./adventureMap";
import "../../components/Buttons/ui.css";
import "./Adventure.css";

const STEP = 92; // écart vertical entre deux ronds (px)
const LEVELS = Array.from({ length: LEVELS_PER_WORLD }, (_, i) => i + 1);

// Chemin en S qui relie les ronds (x en %, y en px)
function pathD(): string {
  return LEVELS.map((level, i) => {
    const x = nodeX(level);
    const y = STEP / 2 + i * STEP;
    if (i === 0) return `M ${x} ${y}`;
    const px = nodeX(level - 1);
    return `C ${px} ${y - STEP / 2}, ${x} ${y - STEP / 2}, ${x} ${y}`;
  }).join(" ");
}
const PATH = pathD();

function Stars({ n }: { n: number }) {
  return (
    <span className="adv-stars" aria-label={`${n} étoile${n > 1 ? "s" : ""} sur 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? "on" : "off"}>★</span>
      ))}
    </span>
  );
}

type WorldProps = {
  world: World;
  save: Save;
  current: LevelRef | null;
  currentRef: React.RefObject<HTMLButtonElement>;
};

function WorldSection({ world, save, current, currentRef }: WorldProps) {
  const navigate = useNavigate();
  const open = isWorldUnlocked(save, world);

  return (
    <section className={`adv-world${open ? "" : " adv-world-locked"}`}>
      <div className="adv-world-bg" style={{ background: world.background }} aria-hidden="true" />
      <header className="adv-banner">
        <span className="adv-banner-emoji" aria-hidden="true">{world.emoji}</span>
        <h2>{world.name}</h2>
        {open ? (
          <span className="fi-chip adv-banner-chip">
            <span className="fi-star">★</span> {worldStars(save, world)}/{LEVELS_PER_WORLD * 3}
          </span>
        ) : (
          <span className="fi-chip adv-banner-chip">🔒 encore {starsMissing(save, world)}<span className="fi-star">★</span></span>
        )}
      </header>

      <div className="adv-path" style={{ height: STEP * LEVELS_PER_WORLD }}>
        <svg className="adv-path-line" viewBox={`0 0 100 ${STEP * LEVELS_PER_WORLD}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={PATH} vectorEffect="non-scaling-stroke" />
        </svg>
        {LEVELS.map((level, i) => {
          const unlocked = isLevelUnlocked(save, world.id, level);
          const stars = starsFor(save, world.id, level);
          const isCurrent = current?.worldId === world.id && current.level === level;
          const boss = level === LEVELS_PER_WORLD;
          return (
            <button
              key={level}
              ref={isCurrent ? currentRef : undefined}
              className={`adv-node${unlocked ? "" : " adv-node-locked"}${isCurrent ? " adv-node-current" : ""}${boss ? " adv-node-boss" : ""}`}
              style={{ left: `${nodeX(level)}%`, top: STEP / 2 + i * STEP, ["--accent" as string]: world.accent }}
              disabled={!unlocked}
              aria-label={unlocked ? `Niveau ${level}` : `Niveau ${level}, fermé`}
              onClick={() => navigate(levelUrl(world.id, level))}
            >
              {isCurrent && (
                <img className="adv-node-capy" src="./assets/images/characters/animals/capybara.png" alt="" />
              )}
              <span className="adv-node-disc">
                {unlocked ? <span className="adv-node-num">{boss ? "👑" : level}</span> : <Lock size={24} strokeWidth={3} />}
              </span>
              {unlocked && <Stars n={stars} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const Adventure = () => {
  const save = useSaveStore((s) => s.save);
  const loaded = useSaveStore((s) => s.loaded);
  const current = nextLevel(save);
  const currentRef = useRef<HTMLButtonElement>(null);
  const currentKey = current ? `${current.worldId}:${current.level}` : "";

  // Défile jusqu'au niveau à jouer (une fois la sauvegarde lue)
  useEffect(() => {
    if (!loaded) return;
    currentRef.current?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  }, [loaded, currentKey]);

  return (
    <div className="fi-screen adv-screen">
      <div className="adv-map">
        {WORLDS.map((w) => (
          <WorldSection key={w.id} world={w} save={save} current={current} currentRef={currentRef} />
        ))}
      </div>
    </div>
  );
};

export default Adventure;
