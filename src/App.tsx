import { useTranslation } from "./i18n";
import { localeDirection } from "./i18n/locales";
import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Home from "./pages/Home/Home";
import Game from "./pages/Game/Game";
import Adventure from "./pages/Adventure/Adventure";
import Album from "./pages/Album/Album";
import Options from "./pages/Options/Options";
import PlaySetup from "./pages/PlaySetup/PlaySetup";

import "./App.css";
import { Header } from "./components/Headers/Header";
import { IsPlaying } from "./components/Game/gameHelpers/isPlaying/isPlaying";
import { AudioGestion } from "./components/Game/gameHelpers/audioGestion/audioGestion";
import { animalsPack } from "./helpers/characters";
import { ImagePreloader } from "./components/ImagesPreloader/ImagesPreloader";
import { useAndroidBackButton } from "./platform/backButton";
import { AppUpdates } from "./components/AppUpdates/AppUpdates";

const Multiplayer = lazy(() => import("./pages/Multiplayer/Multiplayer"));

function LegacyDuel() {
  const { search } = useLocation();
  return <Navigate to={`/multiplayer${search}`} replace />;
}

// Outil de test (window.__findIt), jamais inclus en production
if (import.meta.env.DEV) void import("./helpers/devFindIt");

function App() {
  const { locale, languageTag } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = languageTag;
    document.documentElement.dir = localeDirection(locale);
  }, [locale, languageTag]);
  useAndroidBackButton();
  const defaultImgPack: string[] = animalsPack.map((c) => c.imageSrc);

  return (
    <>
      <AppUpdates />
      <IsPlaying />
      <AudioGestion />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/adventure" element={<Adventure />} />
        <Route path="/album" element={<Album />} />
        <Route path="/options" element={<Options />} />
        <Route path="/duel" element={<LegacyDuel />} />
        <Route path="/play" element={<PlaySetup />} />
        <Route path="/multiplayer" element={<Suspense fallback={null}><Multiplayer /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ImagePreloader imageUrls={defaultImgPack} />
    </>
  );
}

export default App;
