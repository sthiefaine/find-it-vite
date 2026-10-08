import { useTranslation } from "../../i18n";
import "./Title.css";

export const Title = ({ tagline = true }: { tagline?: boolean }) => {
  const { t: tr } = useTranslation();
  return (
  <div className="find-it-logo-container">
    <h1 className="logo-text" aria-label="Find It">
      <span className="find-text">find</span>
      <span className="it-text">it</span>
    </h1>
    {tagline && <div className="tagline">{tr("Qui se cache dans la foule ?")}</div>}
  </div>
);
};
