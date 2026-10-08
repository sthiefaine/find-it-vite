import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSaveStore } from "../../save/saveStore";
import { applyWebUpdate, useWebUpdateStore } from "../../platform/webUpdates";

export function AppUpdates() {
  const { pathname } = useLocation();
  const ready = useWebUpdateStore((state) => state.status === "ready");
  const loaded = useSaveStore((state) => state.loaded);
  useEffect(() => {
    if (!ready || !loaded) return;
    const apply = () => { void applyWebUpdate(); };
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, [ready, loaded, pathname]);
  return null;
}
