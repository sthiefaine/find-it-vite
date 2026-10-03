/// <reference types="vite-plugin-pwa/client" />
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { registerSW } from "virtual:pwa-register";

import "./index.css";
import App from "./App.tsx";
import { initNativeShell } from "./platform/init";

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
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
