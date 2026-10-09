import { useTranslation } from "../../i18n";
import { Tile } from "../../components/Buttons/Tile";
import { GameIcon } from "../../components/Icons/GameIcon";
import { Title } from "../../components/Title/Title";
import { useSaveStore } from "../../save/saveStore";
import { todayISO } from "../../content/progress";
import { unlockedAlbumCount } from "../Album/albumLogic";
import { LanguageSelector } from "../../components/LanguageSelector/LanguageSelector";
import { HomeAnimals } from "./HomeAnimals";
import { HomePlayButton } from "./HomePlayButton";
import { dailyRewardClaimed, dailyRewardPerson, DAILY_REWARD_TARGET } from "../../game/dailyReward";
import "../../components/Buttons/ui.css";
import "./Home.css";

const Home = () => {
  const { t: tr } = useTranslation();
  const save = useSaveStore((s) => s.save);
  const stars = save.wallet.stars;
  const { caught, total } = unlockedAlbumCount(save);
  const dailyClaimed = dailyRewardClaimed(save, todayISO());
  const dailyPerson = dailyRewardPerson(save, todayISO());
  const best = save.progress.bestScore;

  return (
    <div className="fi-screen home-screen">
      <main className="fi-inner home-main">
        <div className="home-top">
          <LanguageSelector compact />
          <span className="fi-chip" aria-label={tr("{{count}} étoiles", { count: stars })}>
            <GameIcon name="star" className="home-star-icon" /> {stars}
          </span>
        </div>

        <Title tagline={false} />

        <HomeAnimals />

        <div className="home-play">
          <HomePlayButton />
        </div>

        <div className="home-tiles-2">
          <Tile
            to="/play?mode=endless"
            icon={<GameIcon name="infinity" />}
            label={tr("Infini")}
            sub={best > 0 ? <><GameIcon name="trophy" /> {best}</> : undefined}
            color="orange"
          />
          <Tile
            to="/game?mode=daily"
            icon={dailyPerson ? <span className={`home-daily-prize${dailyClaimed ? "" : " is-mystery"}`}><img src={dailyPerson.imageSrc} alt="" /><GameIcon name={dailyClaimed ? "check" : "daily"} /></span> : <GameIcon name="daily" />}
            label={tr("Défi du jour")}
            sub={dailyClaimed ? tr("Récompense obtenue") : dailyPerson ? tr("{{count}} trouvés = 1 personnage", { count: DAILY_REWARD_TARGET }) : <>{DAILY_REWARD_TARGET} <GameIcon name="check" /> = +5 <GameIcon name="star" /></>}
            badge={!dailyClaimed ? tr(dailyPerson ? "À débloquer" : "Nouveau") : undefined}
            color="pink"
          />
        </div>
        <div className="home-tiles-3">
          <Tile to="/play?mode=duel" icon={<GameIcon name="duel" />} label={tr("Duel")} color="teal" size="sm" />
          <Tile to="/album" icon={<GameIcon name="album" />} label={tr("Album")} sub={`${caught}/${total}`} color="purple" size="sm" />
          <Tile to="/options" icon={<GameIcon name="settings" />} label={tr("Options")} color="slate" size="sm" />
        </div>
      </main>
    </div>
  );
};

export default Home;
