import { useNavigate } from "react-router-dom";
import "./Home.css";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="homeContainer">
      <h1 className="homeTitle">Bienvenue dans le Jeu</h1>
      <button className="startButton" onClick={() => navigate("/game")}>
        Démarrer le jeu
      </button>
    </div>
  );
};

export default Home;