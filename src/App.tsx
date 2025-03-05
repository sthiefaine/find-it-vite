import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home/Home";
import Game from "./pages/Game/Game";

import "./App.css";
import { Header } from "./components/Headers/Header";
import { IsPlaying } from "./components/Game/gameHelpers/isPlaying/isPlaying";
import { AudioGestion } from "./components/Game/gameHelpers/audioGestion/audioGestion";
import { animalsPack } from "./helpers/characters";
import { ImagePreloader } from "./components/ImagesPreloader/ImagesPreloader";

function App() {
  const defaultImgPack: string[] = animalsPack.map((c) => c.imageSrc);

  return (
    <>
      <IsPlaying />
      <AudioGestion />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
      </Routes>

      <ImagePreloader imageUrls={defaultImgPack} />
    </>
  );
}

export default App;
