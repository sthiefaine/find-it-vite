import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { isNative } from "./native";

// Réglages au démarrage de l'app native ; ne fait rien sur le web
export async function initNativeShell() {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // barre d'état non pilotable sur cet appareil
  }
  try {
    await SplashScreen.hide();
  } catch {
    // déjà masqué
  }
}
