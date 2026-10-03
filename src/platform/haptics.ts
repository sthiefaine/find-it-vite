import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNative } from "./native";

// Vibrations courtes : moteur natif dans l'app, navigator.vibrate sur le web, sinon rien
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // vibration refusée ou indisponible
  }
}

function run(native: () => Promise<void>, fallback: number | number[]) {
  if (isNative()) {
    try {
      native().catch(() => undefined);
    } catch {
      // plugin absent
    }
    return;
  }
  vibrate(fallback);
}

export function tapLight() {
  run(() => Haptics.impact({ style: ImpactStyle.Light }), 10);
}

export function success() {
  run(() => Haptics.notification({ type: NotificationType.Success }), [20, 60, 30]);
}

export function error() {
  run(() => Haptics.notification({ type: NotificationType.Error }), [40, 40, 40]);
}
