import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Copy, Share2, X } from "lucide-react";
import { AnimalPortrait } from "../../components/AnimalPortrait/AnimalPortrait";
import { GameIcon } from "../../components/Icons/GameIcon";
import { playThemeFromSearch, playThemePool, PLAY_THEMES } from "../../content/playThemes";
import { ACCESSORIES } from "../../content/accessories";
import { levelAssetUrls, preloadImages } from "../../game/assetReadiness";
import { useMultiplayer } from "../../multiplayer/useMultiplayer";
import { invitationUrl, normalizeRoomCode, playerTimeSeconds, remainingSeconds } from "../../multiplayer/clientUtils";
import type { PublicPlayer, MultiplayerTheme } from "../../multiplayer/protocol";
import { MatchBoard } from "./MatchBoard";
import "../../components/Buttons/ui.css";
import "./Multiplayer.css";

type AssetsStatus = "loading" | "ready" | "error";

function Hearts({ count }: { count: number }) {
  return <span className="mp-hearts" aria-label={`${count} vie${count > 1 ? "s" : ""}`}>
    {[0, 1, 2].map(index => <svg key={index} className={index < count ? "" : "is-empty"}
      viewBox="0 0 30 28" aria-hidden="true"><path d="M15 25C-8 11 5-5 15 6 25-5 38 11 15 25Z" /><path className="mp-heart-shine" d="M6 9q1-4 5-1" /></svg>)}
  </span>;
}

function PlayerCard({ player, own, now }: { player?: PublicPlayer; own?: boolean; now: number }) {
  const seconds = playerTimeSeconds(player, now);
  return <div className={`mp-player ${own ? "mp-player--own" : ""}`}>
    <span className="mp-player-name">{player?.name ?? "Ton adversaire"}{own ? <small>toi</small> : null}</span>
    <div className="mp-player-score"><GameIcon name="star" /><strong>{player?.score ?? 0}</strong><Hearts count={player?.lives ?? 3} /></div>
    <div className="mp-player-bottom"><span className="mp-player-state">{!player ? "Place libre" : !player.connected ? "Reconnexion…" : player.phase === "eliminated" ? "Partie terminée" : player.phase !== "waiting" ? `Niveau ${player.level}` : player.ready ? "Prêt !" : "Connecté"}</span>
      <span className={`mp-player-time ${seconds <= 5 ? "is-urgent" : ""}`} aria-label={`${seconds} secondes restantes`}>{seconds}<small>s</small></span></div>
  </div>;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Repli pour le réseau local HTTP. */ }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copie le code du salon pour inviter ton adversaire.");
}

export default function Multiplayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialCode = useRef(normalizeRoomCode(new URLSearchParams(location.search).get("room") ?? ""));
  const theme = playThemeFromSearch(location.search) as MultiplayerTheme;
  const { match, connection, pending, error, send, request, leave, serverNow } = useMultiplayer(initialCode.current);
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode.current);
  const [notice, setNotice] = useState("");
  const [qr, setQr] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [assetLoad, setAssetLoad] = useState<{ nonce: string | null; status: AssetsStatus }>({ nonce: null, status: "loading" });
  const [poolStatus, setPoolStatus] = useState<AssetsStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [feedback, setFeedback] = useState("");
  const lastSequence = useRef(0);
  const lastTap = useRef(0);
  const room = match?.room;
  const roomCode = room?.code;
  const self = match?.self;
  const assetsStatus = assetLoad.nonce === self?.levelNonce ? assetLoad.status : "loading";
  const currentTheme = room?.theme ?? theme;
  const spec = self?.spec;
  const me = room?.players.find(player => player.id === self?.playerId);
  const other = room?.players.find(player => player.id !== self?.playerId);
  const invitation = useMemo(() => roomCode ? invitationUrl(window.location.origin, roomCode) : "", [roomCode]);
  const connected = connection === "connected";

  useEffect(() => {
    const timer = setInterval(() => setClock(serverNow()), 100);
    return () => clearInterval(timer);
  }, [serverNow]);

  useEffect(() => {
    if (!roomCode) return;
    const params = new URLSearchParams(location.search);
    if (params.get("room") === roomCode) return;
    params.set("room", roomCode);
    navigate(`/multiplayer?${params.toString()}`, { replace: true });
  }, [roomCode, location.search, navigate]);

  useEffect(() => {
    if (!invitation) { setQr(""); return; }
    let current = true;
    void QRCode.toDataURL(invitation, { width: 240, margin: 2, errorCorrectionLevel: "M", color: { dark: "#2d1548", light: "#ffffff" } })
      .then(url => { if (current) setQr(url); }, () => { if (current) setQr(""); });
    return () => { current = false; };
  }, [invitation]);

  useEffect(() => {
    const controller = new AbortController();
    setPoolStatus("loading");
    void preloadImages([
      ...playThemePool("duel", currentTheme, {}).map(character => character.imageSrc),
      ...ACCESSORIES.map(accessory => accessory.imageSrc),
    ], controller.signal).then(() => {
      if (!controller.signal.aborted) setPoolStatus("ready");
    }, () => { if (!controller.signal.aborted) setPoolStatus("error"); });
    return () => controller.abort();
  }, [currentTheme, attempt]);

  useEffect(() => {
    if (!spec || !self?.levelNonce) return;
    const nonce = self.levelNonce;
    const controller = new AbortController();
    setAssetLoad({ nonce, status: "loading" });
    void preloadImages(levelAssetUrls(spec), controller.signal).then(() => {
      if (!controller.signal.aborted) setAssetLoad({ nonce, status: "ready" });
    }, () => { if (!controller.signal.aborted) setAssetLoad({ nonce, status: "error" }); });
    return () => controller.abort();
  }, [spec, self?.levelNonce, attempt]);

  useEffect(() => {
    if (connected && assetsStatus === "ready" && self?.phase === "preparing" && self.levelNonce)
      send({ type: "assetsReady", levelNonce: self.levelNonce });
  }, [connected, assetsStatus, self?.phase, self?.levelNonce, send]);

  const resultSequence = self?.resultSequence;
  const lastResult = self?.lastResult;
  useEffect(() => {
    if (resultSequence === undefined || resultSequence === lastSequence.current) return;
    lastSequence.current = resultSequence;
    const text = lastResult === "correct" ? "+1 !" : lastResult === "wrong" ? "Oups ! −1 vie"
      : lastResult === "timeout" ? "Temps écoulé · −1 vie" : "";
    setFeedback(text);
    const timer = setTimeout(() => setFeedback(""), 1_100);
    return () => clearTimeout(timer);
  }, [resultSequence, lastResult]);

  const tap = useCallback((characterId: number) => {
    if (!self?.levelNonce || self.phase !== "playing" || !connected || Date.now() - lastTap.current < 250) return;
    lastTap.current = Date.now();
    send({ type: "tap", levelNonce: self.levelNonce, characterId });
  }, [self?.levelNonce, self?.phase, connected, send]);

  const quit = () => { leave(); navigate("/"); };
  const onBack = () => {
    if (room && room.status !== "finished") setConfirmQuit(true);
    else quit();
  };
  const submit = (event: FormEvent, join: boolean) => {
    event.preventDefault();
    const playerName = name.trim();
    if (!playerName) return;
    if (join) request({ type: "join", code, name: playerName });
    else request({ type: "create", theme, name: playerName });
  };
  const share = async (copy = false) => {
    try {
      if (!copy && navigator.share) await navigator.share({ title: "Un duel sur Find It ?", text: `Rejoins mon salon ${room?.code}.`, url: invitation });
      else { await copyText(invitation); setNotice("Lien copié !"); }
    } catch (cause) {
      if (cause instanceof Error && cause.name !== "AbortError") setNotice(cause.message);
    }
  };

  const playing = self?.phase === "playing" && room?.status !== "finished";
  const inMatch = room && room.status !== "waiting" && room.status !== "finished";
  const readyAssetsError = poolStatus === "error" || (inMatch && assetsStatus === "error");
  const themeLabel = PLAY_THEMES.find(item => item.id === currentTheme)?.label ?? "Animaux";

  return <main className={`fi-screen mp-page ${inMatch ? "mp-page--playing" : ""}`}>
    <div className="mp-inner">
      <header className="mp-heading">
        <button type="button" className="mp-icon-button" aria-label="Retour à l’accueil" onClick={onBack}><ArrowLeft size={22} /></button>
        <span><strong>Duel en ligne</strong><small>{room ? `Salon ${room.code}` : themeLabel}</small></span>
        <span className={`mp-connection ${connected ? "is-connected" : ""}`} role="status" aria-label={connected ? "Connecté" : connection === "closed" ? "Déconnecté" : "Connexion en cours"} />
      </header>

      {error && <p className="mp-error" role="alert">{error}</p>}
      {room && connection === "reconnecting" && <p className="mp-error" role="status">Reconnexion… Le chrono continue.</p>}

      {!room && <section className="mp-card mp-entry">
        <GameIcon name="duel" className="mp-hero-icon" />
        <h1>À deux, chacun son écran !</h1>
        <p>La même grille, 3 vies chacun.<br />Trouve le portrait avant ton adversaire !</p>
        <form onSubmit={event => submit(event, false)}>
          <label htmlFor="mp-name">Ton prénom ou pseudo</label>
          <input id="mp-name" value={name} onChange={event => setName(event.target.value)} placeholder="Ton pseudo" autoComplete="nickname" maxLength={20} required />
          <button type="submit" className="mp-button mp-button--gold" disabled={!connected || pending || !name.trim()}>Créer un salon</button>
        </form>
        <div className="mp-divider"><span>ou rejoins un ami</span></div>
        <form onSubmit={event => submit(event, true)}>
          <label htmlFor="mp-code">Code du salon</label>
          <input id="mp-code" className="mp-code-input" value={code} onChange={event => setCode(normalizeRoomCode(event.target.value))}
            placeholder="A3B7K" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={5} required />
          <button type="submit" className="mp-button" disabled={!connected || pending || !name.trim() || code.length !== 5}>Rejoindre</button>
        </form>
      </section>}

      {room && room.status === "waiting" && <>
        <section className="mp-card mp-lobby">
          <span className="mp-eyebrow">Invite ton adversaire</span>
          <h1 className="mp-room-code">{room.code}</h1>
          <div className="mp-qr">{qr ? <img src={qr} alt={`QR code pour rejoindre le salon ${room.code}`} width={168} height={168} /> : <GameIcon name="duel" />}</div>
          <div className="mp-share-actions"><button type="button" className="mp-button mp-button--small" onClick={() => void share(true)}><Copy size={16} /> Copier le lien</button>
            <button type="button" className="mp-button mp-button--small" onClick={() => void share()}><Share2 size={16} /> Partager</button></div>
          {notice && <p className="mp-notice" role="status">{notice}</p>}
          {new Set(["localhost", "127.0.0.1", "[::1]"]).has(window.location.hostname) && <p className="mp-local-hint">Pour inviter un téléphone, ouvre le jeu avec l’adresse réseau de cet ordinateur.</p>}
          <p className="mp-rules">La même grille pour tous les deux.<br />Le premier à trouver gagne 1 point et {Math.round(room.rules.correctBonusMs / 1_000)} secondes.<br />Une erreur = 1 vie en moins.<br />Plus de temps ou plus de vies ? Le duel est perdu.</p>
        </section>
        <div className="mp-players"><PlayerCard player={me} own now={clock} /><PlayerCard player={other} now={clock} /></div>
        <button type="button" className="mp-button mp-button--gold mp-ready" disabled={!connected || poolStatus !== "ready" || !other}
          aria-busy={poolStatus === "loading"} onClick={() => send({ type: "ready", ready: !me?.ready })}>
          {me?.ready ? "Prêt ! Annuler" : !other ? "On attend ton adversaire…" : "Je suis prêt !"}
        </button>
      </>}

      {inMatch && <>
        <div className="mp-players mp-players--compact"><PlayerCard player={me} own now={clock} /><PlayerCard player={other} now={clock} /></div>
        {spec && <>
          <div className="mp-game-header">
            <div className="mp-wanted"><span className="mp-wanted-picture" key={self?.levelNonce}><AnimalPortrait imageSrc={spec.wanted.imageSrc} label={spec.wanted.label} accessoryId={spec.accessories?.target} size={62} />
                {!playing && <span className="mp-count-badge" aria-label={`Départ dans ${self?.phase === "countdown" ? Math.max(1, remainingSeconds(self.startsAt, clock)) : 3}`} key={Math.max(1, remainingSeconds(self?.startsAt ?? null, clock))}>{self?.phase === "countdown" ? Math.max(1, remainingSeconds(self.startsAt, clock)) : 3}</span>}</span>
              <span><small>RECHERCHÉ</small><strong lang="fr">{spec.wanted.label}</strong></span></div>
            <div className="mp-level"><small>Niveau</small><strong>{spec.index}</strong></div>
          </div>
          <div className="mp-board-frame" style={{ background: spec.scene?.background }}>
            {playing && assetsStatus === "ready" ? <MatchBoard key={self?.levelNonce} spec={spec} startsAt={self?.startsAt ?? clock}
              serverNow={serverNow} enabled={connected && !confirmQuit} onTap={tap} /> : <div className="mp-empty-board" role="status" aria-label={`Niveau ${spec.index}, ${spec.wanted.label}, départ dans un instant`} />}
            {feedback && <span className={`mp-feedback ${feedback.startsWith("+") ? "is-good" : ""}`} role="status">{feedback}</span>}
          </div>
        </>}
      </>}

      {room?.status === "finished" && <section className="mp-card mp-victory">
        <GameIcon name="trophy" className="mp-hero-icon" />
        <span className="mp-eyebrow">Duel terminé</span>
        <h1>{room.winnerIds.length !== 1 ? "Égalité !" : room.winnerIds.includes(self?.playerId ?? "") ? "Tu as gagné !" : `${other?.name ?? "Ton adversaire"} a gagné !`}</h1>
        <div className="mp-players"><PlayerCard player={me} own now={clock} /><PlayerCard player={other} now={clock} /></div>
        <p>{room.finishReason === "abandoned" ? "Le duel s’est arrêté après le départ d’un joueur." : room.finishReason === "timeout" ? "Le chrono d’un joueur est arrivé à zéro." : "Un joueur a épuisé ses trois vies."}</p>
        <button type="button" className="mp-button mp-button--gold" onClick={() => { leave(); setFeedback(""); lastSequence.current = 0; setNotice(""); }}>Nouveau salon</button>
        <button type="button" className="mp-button" onClick={quit}>Accueil</button>
      </section>}

      {readyAssetsError && <div className="mp-error" role="alert">Les images n’ont pas toutes chargé.
        <button type="button" className="mp-button mp-button--small" onClick={() => setAttempt(value => value + 1)}>Réessayer</button>
      </div>}
    </div>
    {confirmQuit && <div className="mp-confirm-backdrop"><section className="mp-card mp-confirm" role="alertdialog" aria-modal="true" aria-labelledby="mp-quit-title">
      <button type="button" className="mp-confirm-close mp-icon-button" aria-label="Continuer le duel" onClick={() => setConfirmQuit(false)}><X size={20} /></button>
      <h2 id="mp-quit-title">Quitter le salon ?</h2><p>{room?.status === "waiting" ? "Ton adversaire pourra inviter quelqu’un d’autre." : "Tu abandonnes ce duel. Le chrono continue pendant ce message."}</p>
      <button type="button" className="mp-button mp-button--gold" onClick={() => setConfirmQuit(false)}>Continuer</button>
      <button type="button" className="mp-button" onClick={quit}>Quitter</button>
    </section></div>}
  </main>;
}
