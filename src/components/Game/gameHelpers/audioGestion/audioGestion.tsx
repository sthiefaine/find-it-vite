import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "../../../../../store/store";

// AudioGestion est un composant qui permet de gérer la lecture des sons
// cela à été crée pour éviter les problèmes de lecture audio sur IOS
// sur IOS le delay de lecture audio est plus long
// voire de faire crasher le navigateur
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
  const [isSafariOnIPad, setIsSafariOnIPad] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleUserInteraction = () => {
      setUserInteracted(true);
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
    };

    document.addEventListener("click", handleUserInteraction, { once: true });
    document.addEventListener("keydown", handleUserInteraction, { once: true });

    // Détection de Safari et iphone ou ipad
    const userAgent = navigator.userAgent.toLowerCase();
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const isIOSDevice = /ipad|iphone/i.test(userAgent);
    if (isSafari && isIOSDevice) {
      setIsSafariOnIPad(true);
    }

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    let currentAudio = audioRef.current;

    if (!sound) {
      return;
    }

    if (!soundSrc || !userInteracted) {
      return;
    }

    if (currentAudio) {
      currentAudio.src = soundSrc;
      currentAudio.volume = 1;
      currentAudio.play().catch((error) => {
        console.error("Erreur lors de la lecture audio :", error);
      });
      setSoundSrc("");
    }

    if (isSafariOnIPad) {
      const timeout = setTimeout(() => {
        currentAudio = audioRef.current;
        if (currentAudio) {
          currentAudio.src = soundSrc;
          currentAudio.volume = 1;
          currentAudio.play();
          setSoundSrc("");
        }
      }, 3000);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [soundSrc, userInteracted, setSoundSrc, isSafariOnIPad, sound]);

  return (
    <audio
      style={{
        display: "none",
        height: 0,
      }}
      ref={audioRef}
    />
  );
}
