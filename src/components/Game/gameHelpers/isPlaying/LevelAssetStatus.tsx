import "./LevelAssetStatus.css";

type Props = { onRetry: () => void; onExit: () => void };

// Le chargement courant reste dans l'avis Wanted. Seule une erreur réseau
// persistante demande une intervention au milieu du plateau vide.
export function LevelAssetStatus({ onRetry, onExit }: Props) {
  return <section className="level-asset-status level-asset-status--failed" role="alert">
    <p>Certaines images n’ont pas pu être chargées.</p>
    <div className="level-asset-status__actions">
      <button type="button" onClick={onRetry}>Réessayer</button>
      <button type="button" onClick={onExit}>Accueil</button>
    </div>
  </section>;
}
