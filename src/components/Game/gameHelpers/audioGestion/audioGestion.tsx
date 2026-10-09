import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { configureAudio, setAudioActive, stopAudio, unlockAudio } from "../../../../audio/engine";
import { isPageVisible, subscribeAppActive } from "../../../../platform/appLifecycle";
import { useSaveStore } from "../../../../save/saveStore";

// Audio events are fired in game actions, never buffered in React state.
export function AudioGestion() {
  const { pathname } = useLocation();

  useEffect(() => {
    const syncSettings = () => {
      const { sound, soundVolume } = useSaveStore.getState().save.settings;
      configureAudio({ enabled: sound, volume: soundVolume });
    };
    syncSettings();
    setAudioActive(isPageVisible());
    const unsubscribeSettings = useSaveStore.subscribe((state, previous) => {
      if (state.save.settings.sound !== previous.save.settings.sound
        || state.save.settings.soundVolume !== previous.save.settings.soundVolume) syncSettings();
    });
    const unsubscribeActive = subscribeAppActive(setAudioActive);
    document.addEventListener("pointerdown", unlockAudio, { capture: true, passive: true });
    document.addEventListener("keydown", unlockAudio, { capture: true });

    return () => {
      unsubscribeSettings();
      unsubscribeActive();
      document.removeEventListener("pointerdown", unlockAudio, { capture: true });
      document.removeEventListener("keydown", unlockAudio, { capture: true });
      stopAudio();
    };
  }, []);

  useEffect(() => () => stopAudio(), [pathname]);
  return null;
}
