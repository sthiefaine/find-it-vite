import { App } from "@capacitor/app";
import { isNative } from "./native";

// L'app est-elle au premier plan ? Onglet visible (web) et app non mise en pause (natif).
// Rend une fonction de désabonnement ; le listener n'est appelé qu'aux changements.
export function subscribeAppActive(listener: (active: boolean) => void): () => void {
  let pageVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
  let nativeActive = true;
  let last = pageVisible && nativeActive;

  const emit = () => {
    const active = pageVisible && nativeActive;
    if (active === last) return;
    last = active;
    listener(active);
  };

  const onVisibility = () => {
    pageVisible = document.visibilityState !== "hidden";
    emit();
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

  let removed = false;
  const handles: { remove: () => Promise<void> }[] = [];
  if (isNative()) {
    const keep = (p: Promise<{ remove: () => Promise<void> }>) =>
      p
        .then((h) => {
          if (removed) void h.remove();
          else handles.push(h);
        })
        .catch(() => undefined);
    try {
      keep(
        App.addListener("appStateChange", ({ isActive }) => {
          nativeActive = isActive;
          emit();
        })
      );
      keep(
        App.addListener("pause", () => {
          nativeActive = false;
          emit();
        })
      );
      keep(
        App.addListener("resume", () => {
          nativeActive = true;
          emit();
        })
      );
    } catch {
      // plugin absent
    }
  }

  return () => {
    removed = true;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    handles.splice(0).forEach((h) => void h.remove().catch(() => undefined));
  };
}

// État courant (au montage d'un composant)
export function isPageVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}
