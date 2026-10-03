import { Capacitor } from "@capacitor/core";

// Vrai seulement dans l'app Android / iOS (pas dans le navigateur ni la PWA)
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
