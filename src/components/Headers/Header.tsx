import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { backTarget, headerTitle, showsStars } from "./headerNav";
import { useSaveStore } from "../../save/saveStore";
import { totalStars } from "../../content/progress";
import "./Header.css";

// Barre du haut : absente de l'accueil, un gros bouton retour ailleurs
export const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const stars = useSaveStore((s) => totalStars(s.save));

  if (location.pathname === "/") return null;

  const title = headerTitle(location.pathname);

  return (
    <header className="header">
      <button
        className="header-back"
        aria-label="Retour"
        onClick={() => navigate(backTarget(location.pathname, location.search))}
      >
        <ChevronLeft size={32} strokeWidth={3} />
      </button>
      {title && <h1 className="header-title">{title}</h1>}
      {showsStars(location.pathname) && (
        <span className="header-stars" aria-label={`${stars} étoiles`}>
          <span>★</span> {stars}
        </span>
      )}
    </header>
  );
};
