import "./Title.css";

// Logo FIND IT, avec une loupe qui balaie le texte
export const Title = ({ tagline = true }: { tagline?: boolean }) => (
  <div className="find-it-logo-container">
    <div className="logo-text" aria-label="Find It">
      <span className="find-text">Find</span>
      <span className="it-text">It</span>
      <span className="magnify-glass" aria-hidden="true">🔍</span>
    </div>
    {tagline && <div className="tagline">Qui se cache dans la foule ?</div>}
  </div>
);
