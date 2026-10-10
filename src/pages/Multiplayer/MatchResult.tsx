import { useState, type ReactNode } from "react";
import { Eye, RotateCcw, Clock3, Target, Heart, ArrowLeft } from "lucide-react";
import { useTranslation } from "../../i18n";
import { GameIcon } from "../../components/Icons/GameIcon";
import type { PublicPlayer, RoomSnapshot } from "../../multiplayer/protocol";

type Props = {
  room: RoomSnapshot;
  me?: PublicPlayer;
  other?: PublicPlayer;
  connected: boolean;
  onRematch: () => void;
  onThemes: () => void;
  onHome: () => void;
  lastTarget?: ReactNode;
};

export function MatchResult({ room, me, other, connected, onRematch, onThemes, onHome, lastTarget }: Props) {
  const { t: tr } = useTranslation();
  const [showTarget, setShowTarget] = useState(false);
  const draw = room.winnerIds.length !== 1;
  const win = !!me && room.winnerIds.includes(me.id);
  const loser = room.players.find(player => !room.winnerIds.includes(player.id));
  const reason = room.finishReason === "abandoned" ? tr("Le duel s’est arrêté après le départ d’un joueur.")
    : room.finishReason === "time-limit" ? tr("La durée du duel est écoulée.")
      : room.finishReason === "timeout" ? draw ? tr("Vos chronos sont arrivés à zéro ensemble.") : tr("{{name}} n’avait plus de temps.", { name: loser?.name ?? "" })
        : tr("{{name}} a épuisé ses vies.", { name: loser?.name ?? "" });
  return <section className={`mp-result ${draw ? "is-draw" : win ? "is-win" : "is-lose"}`} aria-labelledby="mp-result-title">
    <div className="mp-result-hero">
      <span className="mp-result-spark mp-result-spark--left" aria-hidden="true">✦</span>
      <div className="mp-result-medal"><GameIcon name={draw ? "duel" : win ? "trophy" : "star"} /></div>
      <span className="mp-result-spark mp-result-spark--right" aria-hidden="true">✦</span>
      <span className="mp-eyebrow">{tr("Duel terminé")}</span>
      <h1 id="mp-result-title">{tr(draw ? "Égalité !" : win ? "Victoire !" : "Bien joué !")}</h1>
      <p>{draw ? tr("Un duel au coude à coude.") : win ? tr("Tu remportes le duel !") : tr("{{name}} remporte le duel.", { name: other?.name ?? tr("Ton adversaire") })}</p>
    </div>
    <div className="mp-result-scores">
      {[me, other].map((player, index) => player && <article key={player.id} className={`mp-result-player ${room.winnerIds.includes(player.id) ? "is-winner" : ""}`}>
        <span className="mp-result-player-badge">{room.winnerIds.includes(player.id) ? <><GameIcon name="trophy" />{tr("Vainqueur")}</> : index === 0 ? tr("toi") : tr("Ton adversaire")}</span>
        <strong className="mp-result-name">{player.name}</strong>
        <span className="mp-result-score">{player.score}<small>{tr("points", { count: player.score })}</small></span>
        <dl>
          <div><dt><Target size={14} />{tr("Erreurs")}</dt><dd>{player.mistakes}</dd></div>
          <div><dt><Heart size={14} />{tr("Vies")}</dt><dd>{player.lives}</dd></div>
          <div><dt><Clock3 size={14} />{tr("Plus rapide")}</dt><dd>{player.bestResponseMs === null ? "—" : tr("{{count}} s", { count: Number((player.bestResponseMs / 1_000).toFixed(1)) })}</dd></div>
        </dl>
      </article>)}
    </div>
    <p className="mp-result-reason">{reason}</p>
    {lastTarget && <div className="mp-last-target">
      <button type="button" className="mp-target-toggle" aria-expanded={showTarget} onClick={() => setShowTarget(value => !value)}>
        <Eye size={18} />{tr(showTarget ? "Masquer la dernière cible" : "Voir la dernière cible")}
      </button>
      {showTarget && lastTarget}
    </div>}
    <div className="mp-result-actions">
      <button type="button" className={`mp-button mp-button--gold ${me?.ready ? "is-ready" : ""}`} onClick={onRematch}
        disabled={!connected || !other?.connected} aria-pressed={!!me?.ready}>
        <RotateCcw size={21} />{tr(me?.ready ? "Prêt ! Annuler" : other?.ready ? "Accepter la revanche" : "Revanche !")}
      </button>
      <p className="mp-rematch-status" role="status">{tr(!other?.connected ? "Ton adversaire a quitté le salon." : me?.ready ? "On attend ton adversaire pour la revanche…" : other?.ready ? "Ton adversaire veut sa revanche !" : "Même salon, nouveau duel.")}</p>
      <div className="mp-result-links"><button type="button" className="mp-button" onClick={onThemes}><GameIcon name="duel" />{tr("Changer de thème")}</button>
        <button type="button" className="mp-button" onClick={onHome}><ArrowLeft size={18} />{tr("Accueil")}</button></div>
    </div>
  </section>;
}
