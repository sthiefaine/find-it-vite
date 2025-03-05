import { useLocation, useNavigate } from "react-router-dom";
import { CornerDownLeft } from "lucide-react";
import "./Header.css";
export const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleClickNavigate = (link: string) => {
    if (location.pathname !== link) {
      navigate(link);
    }
  };

  return (
    <header className="header">
      <div className="header-logo">
        <button onClick={() => handleClickNavigate("/")}>
          {location.pathname === "/" && (
            <div className="header-button-icon">🔎</div>
          )}
          {location.pathname !== "/" && (
            <div className="header-button-icon">
              <CornerDownLeft />
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
