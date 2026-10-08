import { create } from "zustand";
import type { registerSW } from "virtual:pwa-register";
import { useSaveStore } from "../save/saveStore";
import { isNative } from "./native";

export const APP_BUILD = __APP_BUILD__;
const CHECK_INTERVAL_MS = 5 * 60_000;
const CHECK_THROTTLE_MS = 60_000;
const SAFE_PATHS = new Set(["/", "/options", "/album", "/adventure", "/play"]);

type UpdateStatus = "idle" | "checking" | "current" | "downloading" | "ready" | "offline" | "error";
export const useWebUpdateStore = create<{ status: UpdateStatus; available: boolean }>(() => ({ status: "idle", available: false }));

let registration: ServiceWorkerRegistration | undefined;
let lastCheck = -Infinity;
let checking: Promise<void> | undefined;
let applying = false;

export function canReloadForUpdate(pathname: string, visible = document.visibilityState !== "hidden") {
  return visible && SAFE_PATHS.has(pathname);
}

// Ne touche ni aux sauvegardes ni au cache hors ligne : Workbox révise les
// fichiers modifiés et garde les portraits inchangés lors de chaque installation.
export function checkWebUpdates(force = true): Promise<void> {
  if (checking) return checking;
  if (!navigator.onLine) {
    if (useWebUpdateStore.getState().status !== "ready") useWebUpdateStore.setState({ status: "offline" });
    return Promise.resolve();
  }
  // Au premier affichage, pageshow peut précéder l'enregistrement. On attend
  // celui-ci pour ne pas recharger l'ancien shell avant l'installation du nouveau.
  if ("serviceWorker" in navigator && !registration) return Promise.resolve();
  if (!force && (document.visibilityState === "hidden" || Date.now() - lastCheck < CHECK_THROTTLE_MS)) {
    return Promise.resolve();
  }
  if (useWebUpdateStore.getState().status === "ready") return Promise.resolve();
  lastCheck = Date.now();
  useWebUpdateStore.setState({ status: "checking" });
  checking = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      // Le paramètre et no-store évitent aussi les caches HTTP des mobiles/CDN.
      const url = `${import.meta.env.BASE_URL}version.json?check=${Date.now()}`;
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Version indisponible");
      const remote: unknown = await response.json();
      if (!remote || typeof remote !== "object" || !("buildId" in remote) || typeof remote.buildId !== "string") {
        throw new Error("Version invalide");
      }
      const changed = remote.buildId !== APP_BUILD.buildId;
      if (changed) useWebUpdateStore.setState({ available: true });
      if (registration) await registration.update();
      // L'activation peut avoir eu lieu pendant update(). Ne pas écraser ready.
      if (useWebUpdateStore.getState().status === "ready") return;
      useWebUpdateStore.setState({
        status: changed ? (registration ? "downloading" : "ready") : "current",
        available: changed,
      });
    } catch {
      if (useWebUpdateStore.getState().status !== "ready") {
        useWebUpdateStore.setState({ status: navigator.onLine ? "error" : "offline" });
      }
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => { checking = undefined; });
  return checking;
}

export async function applyWebUpdate(repair = false, automatic = false) {
  const canApply = () => canReloadForUpdate(window.location.pathname) && (!automatic || window.location.pathname !== "/");
  if (applying || (!repair && useWebUpdateStore.getState().status !== "ready") || !canApply()) return;
  if (!useSaveStore.getState().loaded) return;
  if (repair && !navigator.onLine) {
    useWebUpdateStore.setState({ status: "offline" });
    return;
  }
  applying = true;
  try {
    await useSaveStore.getState().flush();
    if (repair) {
      // Une réponse réseau valide est indispensable avant de réenregistrer une
      // PWA bloquée. Le cache de jeu et la progression restent conservés.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(`${import.meta.env.BASE_URL}index.html?update=${Date.now()}`, {
        cache: "no-store", signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      if (!response.ok) throw new Error("Jeu indisponible");
      if (!canApply()) return;
      await registration?.unregister();
    }
    // Une navigation ou une mise en veille a pu survenir pendant l'écriture.
    if (canApply()) window.location.reload();
  } catch {
    useWebUpdateStore.setState({ status: "error" });
  } finally {
    applying = false;
  }
}

export function startWebUpdates(register: typeof registerSW): () => void {
  if (isNative() || import.meta.env.DEV || !("serviceWorker" in navigator)) return () => undefined;
  register({
    immediate: true,
    onNeedReload: () => useWebUpdateStore.setState({ status: "ready", available: true }),
    onRegisteredSW: (url, registered) => {
      if (!registered) return;
      registration = registered;
      registered.addEventListener("updatefound", () => {
        const installing = registered.installing;
        if (!registered.active || !installing) return;
        useWebUpdateStore.setState({ status: "downloading", available: true });
        installing.addEventListener("statechange", () => {
          if (installing.state === "activated") useWebUpdateStore.setState({ status: "ready", available: true });
          else if (installing.state === "redundant" && useWebUpdateStore.getState().status !== "ready") {
            useWebUpdateStore.setState({ status: "error" });
          }
        });
      });
      // Applique updateViaCache à l'enregistrement existant, sans changer le scope.
      void navigator.serviceWorker.register(url, { scope: registered.scope, updateViaCache: "none" })
        .then((fresh) => { registration = fresh; })
        .catch(() => undefined)
        .then(() => checkWebUpdates(false));
    },
    onRegisterError: () => useWebUpdateStore.setState({ status: "error" }),
  });
  const onReturn = () => { void checkWebUpdates(false); };
  const onOnline = () => { void checkWebUpdates(); };
  window.addEventListener("focus", onReturn);
  window.addEventListener("pageshow", onReturn);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onReturn);
  const timer = setInterval(onReturn, CHECK_INTERVAL_MS);
  return () => {
    clearInterval(timer);
    window.removeEventListener("focus", onReturn);
    window.removeEventListener("pageshow", onReturn);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onReturn);
  };
}
