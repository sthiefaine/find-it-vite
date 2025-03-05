import { useEffect, useState } from "react";
import "./Title.css"
export const Title = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showHiddenChar, setShowHiddenChar] = useState(false);
  const [magnifyPosition, setMagnifyPosition] = useState(0);
  const [bounceEffect, setBounceEffect] = useState(false);

  useEffect(() => {
    // Animation de la loupe
    const magnifyInterval = setInterval(() => {
      setMagnifyPosition((prev) => (prev >= 100 ? 0 : prev + 5));
    }, 150);

    // TODO Personnage caché qui apparaît périodiquement
    const hiddenCharInterval = setInterval(() => {
      setShowHiddenChar(true);
      setTimeout(() => setShowHiddenChar(false), 800);
    }, 5000);

    // Effet de rebond périodique
    const bounceInterval = setInterval(() => {
      setBounceEffect(true);
      setTimeout(() => setBounceEffect(false), 500);
    }, 3000);

    return () => {
      clearInterval(magnifyInterval);
      clearInterval(hiddenCharInterval);
      clearInterval(bounceInterval);
    };
  }, []);

  return (
    <div className="find-it-logo-container">
      <div className={`logo-text ${bounceEffect ? "bounce" : ""}`}>
        <span className="find-text">Find</span>
        <span className="it-text">It</span>
        <div className="magnify-glass" style={{ left: `${magnifyPosition}%` }}>
          🔍
        </div>
      </div>

      <div className="tagline">Qui se cache dans la foule?</div>
    </div>
  );
};
