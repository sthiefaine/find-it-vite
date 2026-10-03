import { Play } from "lucide-react";
import { motion } from "framer-motion";
import { ButtonXL } from "../../components/Buttons/ButtonXL";
import { Tile } from "../../components/Buttons/Tile";
import { Title } from "../../components/Title/Title";
import { useSaveStore } from "../../save/saveStore";
import { todayISO, totalStars } from "../../content/progress";
import { caughtCount } from "../Album/albumLogic";
import "../../components/Buttons/ui.css";
import "./Home.css";

const Home = () => {
  const save = useSaveStore((s) => s.save);
  const stars = totalStars(save);
  const { caught, total } = caughtCount(save);
  const dailyNew = save.daily?.date !== todayISO();
  const best = save.progress.bestScore;

  return (
    <div className="fi-screen home-screen">
      <main className="fi-inner home-main">
        <div className="home-top">
          <span className="fi-chip" aria-label={`${stars} étoiles`}>
            <span className="fi-star">★</span> {stars}
          </span>
        </div>

        <Title tagline={false} />

        <motion.div
          className="home-mascot"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          whileTap={{ scale: 0.88, rotate: -6 }}
        >
          <img src="./assets/images/characters/animals/capybara.png" alt="Le capybara détective" />
          <span className="home-mascot-hat" aria-hidden="true" />
          <span className="home-mascot-loupe" aria-hidden="true">🔍</span>
        </motion.div>
        <div className="home-mascot-shadow" aria-hidden="true" />

        <div className="home-play">
          <ButtonXL text="Jouer" link="/adventure" variant="bling">
            <Play size={38} fill="currentColor" />
          </ButtonXL>
        </div>

        <div className="home-tiles-2">
          <Tile to="/game" icon="♾️" label="Infini" sub={best > 0 ? `🏆 ${best}` : undefined} color="orange" />
          <Tile
            to="/game?mode=daily"
            icon="📅"
            label="Défi du jour"
            sub={save.daily?.date === todayISO() ? `🏆 ${save.daily.best}` : undefined}
            badge={dailyNew ? "Nouveau" : undefined}
            color="pink"
          />
        </div>
        <div className="home-tiles-3">
          <Tile to="/duel" icon="👥" label="Duel" color="teal" size="sm" />
          <Tile to="/album" icon="📖" label="Album" sub={`${caught}/${total}`} color="purple" size="sm" />
          <Tile to="/options" icon="⚙️" label="Options" color="slate" size="sm" />
        </div>
      </main>
    </div>
  );
};

export default Home;
