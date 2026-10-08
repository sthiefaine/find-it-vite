/// <reference types="vite-plugin-pwa/client" />
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import "./index.css";
import App from "./App.tsx";
import { initNativeShell } from "./platform/init";
import { startWebUpdates } from "./platform/webUpdates";

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
