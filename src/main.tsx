/// <reference types="vite-plugin-pwa/client" />
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import "./index.css";
import App from "./App.tsx";
import { initNativeShell } from "./platform/init";
import { startWebUpdates } from "./platform/webUpdates";
import { ACCESSORIES } from "./content/accessories";
import { preloadImages } from "./game/assetReadiness";

// Précharger les six tenues dès l'accueil. Un échec sera retenté par la
// barrière de chargement du niveau, qui attend toujours aussi les leurres.
void preloadImages(ACCESSORIES.map(accessory => accessory.imageSrc)).catch(() => undefined);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>
);

void initNativeShell();

// Le service worker ne sert qu'à la PWA : dans l'app native, il servirait
// l'ancien bundle après une mise à jour de l'app.
const stopWebUpdates = startWebUpdates(registerSW);
if (import.meta.hot) import.meta.hot.dispose(stopWebUpdates);
