import { ButtonXL } from "../../components/Buttons/ButtonXL";
import { Play } from "lucide-react";
import "./Home.css";
import { Title } from "../../components/Title/Title";

const Home = () => {
  return (
    <div className="home-container">
      <main className="home-main">
        <div className="home-logo">
          <Title />
        </div>
        <div className="home-buttons">
          <ButtonXL text="Jouer" link="./game" variant="bling">
            <Play />
          </ButtonXL>
          <ButtonXL text="Options" link="./option" variant="normal" disabled={true}>
            <Play />
          </ButtonXL>
        </div>
      </main>
    </div>
  );
};

export default Home;
