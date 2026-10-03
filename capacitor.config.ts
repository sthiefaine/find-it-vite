import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // À remplacer par le domaine inversé du créateur (ex. fr.mondomaine.findit) AVANT la
  // première publication : l'identifiant ne peut plus changer ensuite sur les stores.
  appId: "com.findit.game",
  appName: "Find It",
  webDir: "dist",
  backgroundColor: "#1c0840",
  android: {
    // Android 15+ : la WebView ne passe pas sous les barres système
    adjustMarginsForEdgeToEdge: "auto",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#2d0d66",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1c0840",
      overlaysWebView: false,
    },
  },
};

export default config;
