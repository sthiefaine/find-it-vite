import "./Title.css";

export const Title = ({ tagline = true }: { tagline?: boolean }) => (
  <div className="find-it-logo-container">
    <h1 className="logo-text" aria-label="Find It">
      <span className="find-text">find</span>
      <span className="it-text">it</span>
    </h1>
    {tagline && <div className="tagline">Qui se cache dans la foule ?</div>}
  </div>
);
