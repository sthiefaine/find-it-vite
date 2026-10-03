import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "../../../../../store/store";
import { isPlayInterrupted, nextPoolIndex } from "./audioPool";

// Nombre d'éléments <audio> : deux sons rapprochés ne se coupent pas
const POOL_SIZE = 3;

// AudioGestion joue les sons demandés via le store (soundSrc).
// Créé pour iOS, où la lecture audio peut tarder, voire faire planter le navigateur :
// on attend un premier geste du joueur avant de jouer quoi que ce soit.
export function AudioGestion() {
  const { sound, soundSrc, setSoundSrc } = useGameStore(
    useShallow((state) => {
      return {
        sound: state.sound,
        soundSrc: state.soundSrc,
        setSoundSrc: state.setSoundSrc,
      };
    })
  );
  const [userInteracted, setUserInteracted] = useState(false);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const nextIndex = useRef(0);

  useEffect(() => {
    const handleUserInteraction = () => {
      setUserInteracted(true);
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
    };

    document.addEventListener("click", handleUserInteraction, { once: true });
    document.addEventListener("keydown", handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    if (!sound || !soundSrc || !userInteracted) return;

    // élément libre de préférence, sinon le plus ancien
    const audios = audioRefs.current.slice(0, POOL_SIZE);
    const index = nextPoolIndex(
      audios.map((a) => !a || a.paused || a.ended),
      nextIndex.current
    );
    nextIndex.current = (index + 1) % POOL_SIZE;
    const audio = audios[index];
    if (audio) {
      audio.src = soundSrc;
      audio.volume = 1;
      audio.play().catch((error) => {
        // son remplacé par un autre avant de démarrer : normal, pas une erreur
        if (isPlayInterrupted(error)) return;
        console.error("Erreur lors de la lecture audio :", error);
      });
    }
    setSoundSrc("");
  }, [soundSrc, userInteracted, setSoundSrc, sound]);

  return (
    <>
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <audio
          key={i}
          style={{ display: "none", height: 0 }}
          ref={(el) => {
            audioRefs.current[i] = el;
          }}
        />
      ))}
    </>
  );
}
