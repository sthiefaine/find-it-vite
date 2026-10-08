import { APP_BUILD, applyWebUpdate, checkWebUpdates, useWebUpdateStore } from "../../platform/webUpdates";
import { isNative } from "../../platform/native";

const STATUS_TEXT = {
  idle: "Les mises à jour sont recherchées automatiquement.",
  checking: "Recherche d'une mise à jour…",
  current: "Le jeu est à jour.",
  downloading: "Téléchargement de la mise à jour…",
  ready: "La mise à jour est prête. Rechargement…",
  offline: "Hors ligne : tu peux continuer à jouer et réessayer plus tard.",
  error: "Vérification impossible pour le moment. Réessaie dans un instant.",
};

export function AppVersion() {
  const status = useWebUpdateStore((state) => state.status);
  const webUpdates = !isNative() && !import.meta.env.DEV;
  return (
    <section className="opt-card opt-version">
      <h2 className="opt-title">Version du jeu</h2>
      <p className="opt-version-number">{APP_BUILD.buildId}</p>
      {webUpdates && <>
        <p className="opt-hint" role="status">{STATUS_TEXT[status]}</p>
        <button
          className="opt-no opt-update"
          disabled={status === "checking" || status === "ready"}
          onClick={() => { void checkWebUpdates(); }}
        >
          Rechercher une mise à jour
        </button>
        {(status === "downloading" || status === "error") && <button
          className="opt-no opt-update"
          onClick={() => { void applyWebUpdate(true); }}
        >
          Actualiser maintenant
        </button>}
      </>}
    </section>
  );
}
