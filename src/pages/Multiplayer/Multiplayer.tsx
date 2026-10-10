import { useTranslation, translate as tr } from "../../i18n";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Copy, Dices, Share2, Volume2, VolumeX, X } from "lucide-react";
import { AnimalPortrait } from "../../components/AnimalPortrait/AnimalPortrait";
import { GameIcon } from "../../components/Icons/GameIcon";
import { playThemeFromSearch, playThemePool, publishedThemePool, PLAY_THEMES, translatedThemeLabel } from "../../content/playThemes";
import { ACCESSORIES } from "../../content/accessories";
import { levelAssetUrls, preloadImages } from "../../game/assetReadiness";
import { useMultiplayer } from "../../multiplayer/useMultiplayer";
import { invitationUrl, matchRewardId, normalizeRoomCode, playerTimeSeconds, remainingSeconds } from "../../multiplayer/clientUtils";
import { generateNickname, NICKNAME_MAX_LENGTH, readNickname, saveNickname } from "../../multiplayer/nickname";
import type { PublicPlayer, MultiplayerTheme, TapPoint } from "../../multiplayer/protocol";
import { useSaveStore } from "../../save/saveStore";
import { MatchBoard } from "./MatchBoard";
import { MatchResult } from "./MatchResult";
import { matchObstacleAssets } from "../../multiplayer/distractions";
import { playSound } from "../../audio/engine";
import { emptyMatchSoundSnapshot, matchSoundEvents, type MatchSoundSnapshot } from "../../multiplayer/audioFeedback";
import { useGameStore } from "../../../store/store";
import "../../components/Buttons/ui.css";
import "./Multiplayer.css";

type AssetsStatus = "loading" | "ready" | "error";

function Hearts({ count }: { count: number }) {
  const { t: tr } = useTranslation();
  return <span className="mp-hearts" aria-label={tr("{{count}} vies", { count })}>
    {[0, 1, 2].map(index => <svg key={index} className={index < count ? "" : "is-empty"}
      viewBox="0 0 30 28" aria-hidden="true"><path d="M15 25C-8 11 5-5 15 6 25-5 38 11 15 25Z" /><path className="mp-heart-shine" d="M6 9q1-4 5-1" /></svg>)}
  </span>;
}

function PlayerCard({ player, own, now }: { player?: PublicPlayer; own?: boolean; now: number }) {
  const { t: tr } = useTranslation();
  const seconds = playerTimeSeconds(player, now);
  return <div className={`mp-player ${own ? "mp-player--own" : ""}`}>
    <span className="mp-player-name">{player?.name ?? tr("Ton adversaire")}{own ? <small>{tr("toi")}</small> : null}</span>
    <div className="mp-player-score"><GameIcon name="star" /><strong>{player?.score ?? 0}</strong><Hearts count={player?.lives ?? 3} /></div>
    <div className="mp-player-bottom"><span className="mp-player-state">{!player ? tr("Place libre") : !player.connected ? tr("Reconnexion…") : player.phase === "eliminated" ? tr("Partie terminée") : player.phase !== "waiting" ? tr("Niveau {{level}}", { level: player.level }) : player.ready ? tr("Prêt !") : tr("Connecté")}</span>
      <span className={`mp-player-time ${seconds <= 5 ? "is-urgent" : ""}`} aria-label={tr("{{count}} secondes restantes", { count: seconds })}>{seconds}<small>s</small></span></div>
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
  if (!copied) throw new Error(tr("Copie le code du salon pour inviter ton adversaire."));
}

export default function Multiplayer() {
  const { t: tr, locale } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const purchasedPeople = useSaveStore(state => state.save.purchasedPeople);
  const initialCode = useRef(normalizeRoomCode(new URLSearchParams(location.search).get("room") ?? ""));
  const theme = playThemeFromSearch(location.search) as MultiplayerTheme;
  const { match, connection, pending, error, send, request, leave, serverNow } = useMultiplayer(initialCode.current);
  const [name, setName] = useState(() => readNickname(locale));
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
  const sound = useGameStore(state => state.sound);
  const soundSnapshot = useRef(emptyMatchSoundSnapshot());
  const countdown = self?.phase === "countdown" ? remainingSeconds(self.startsAt, clock) : null;
  const outcome = room?.winnerIds.length !== 1 ? "draw" : room.winnerIds.includes(self?.playerId ?? "") ? "win" : "lose";
  useEffect(() => {
    const next: MatchSoundSnapshot = {
      matchId: roomCode && self?.playerId ? `${roomCode}:${room?.matchNumber}:${self.playerId}` : null,
      connectionEpoch: match?.connectionEpoch ?? 0,
      sequence: self?.resultSequence ?? 0, result: self?.lastResult ?? null,
      phase: self?.phase ?? null, nonce: self?.levelNonce ?? null,
      countdown, finished: room?.status === "finished", outcome, connected,
    };
    const cues = matchSoundEvents(soundSnapshot.current, next);
    soundSnapshot.current = next;
    cues.forEach(cue => playSound(cue));
  }, [roomCode, room?.matchNumber, match?.connectionEpoch, self?.playerId, self?.resultSequence, self?.lastResult, self?.phase, self?.levelNonce, countdown, room?.status, outcome, connected]);

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
      ...playThemePool("duel", currentTheme, { purchasedPeople }).map(character => character.imageSrc),
      ...(currentTheme === "drapeaux" ? [] : ACCESSORIES.map(accessory => accessory.imageSrc)),
    ], controller.signal).then(() => {
      if (!controller.signal.aborted) setPoolStatus("ready");
    }, () => { if (!controller.signal.aborted) setPoolStatus("error"); });
    return () => controller.abort();
  }, [currentTheme, purchasedPeople, attempt]);

  const ownScore = me?.score;
  useEffect(() => {
    if (roomCode && room?.matchNumber && self?.playerId && ownScore !== undefined) useSaveStore.getState().recordOnlineScore(matchRewardId(roomCode, room.matchNumber, self.playerId), ownScore);
  }, [roomCode, room?.matchNumber, self?.playerId, ownScore]);

  useEffect(() => {
    if (!spec || !self?.levelNonce) return;
    const nonce = self.levelNonce;
    const controller = new AbortController();
    setAssetLoad({ nonce, status: "loading" });
    void preloadImages([...levelAssetUrls(spec), ...matchObstacleAssets(spec)], controller.signal).then(() => {
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
  useEffect(() => { lastSequence.current = 0; setFeedback(""); }, [room?.matchNumber]);
  useEffect(() => {
    if (resultSequence === undefined || resultSequence === lastSequence.current) return;
    lastSequence.current = resultSequence;
    const text = lastResult === "correct" ? "+1 !" : lastResult === "wrong" ? tr("Oups ! −1 vie")
      : lastResult === "timeout" ? tr("Temps écoulé · −1 vie") : "";
    setFeedback(text);
    const timer = setTimeout(() => setFeedback(""), 1_100);
    return () => clearTimeout(timer);
  }, [resultSequence, lastResult, tr]);

  const tap = useCallback((characterId: number | null, point: TapPoint) => {
    if (!self?.levelNonce || self.phase !== "playing" || !connected || Date.now() - lastTap.current < 250) return;
    lastTap.current = Date.now();
    send({ type: "tap", levelNonce: self.levelNonce, characterId, point });
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
    saveNickname(playerName);
    if (join) request({ type: "join", code, name: playerName, purchasedPeople });
    else request({ type: "create", theme, name: playerName, purchasedPeople });
  };
  const share = async (copy = false) => {
    try {
      if (!copy && navigator.share) await navigator.share({ title: tr("Un duel sur Find It ?"), text: tr("Rejoins mon salon {{code}}.", { code: room?.code ?? "" }), url: invitation });
      else { await copyText(invitation); setNotice(tr("Lien copié !")); }
    } catch (cause) {
      if (cause instanceof Error && cause.name !== "AbortError") setNotice(cause.message);
    }
  };

  const playing = self?.phase === "playing" && room?.status !== "finished";
  const revealing = room?.status === "revealing";
  const inMatch = room && room.status !== "waiting" && room.status !== "finished";
  const readyAssetsError = poolStatus === "error" || ((inMatch || room?.status === "finished") && assetsStatus === "error");
  const currentThemeDetails = PLAY_THEMES.find(item => item.id === currentTheme);
  const themeLabel = currentThemeDetails ? translatedThemeLabel(currentThemeDetails, tr) : tr("Animaux");
  const entryPortraits = useMemo(() => {
    const pool = publishedThemePool(currentTheme);
    const first = pool[0];
    const second = pool.find(character => character.name !== first?.name && (!first?.species || character.species !== first.species)) ?? pool[1];
    return [first, second].filter(character => character !== undefined);
  }, [currentTheme]);
  const changeName = (value: string) => { setName(value); saveNickname(value); };

  return <main className={`fi-screen mp-page ${!room ? "mp-page--entry" : ""} ${inMatch ? "mp-page--playing" : ""}`}>
    <div className="mp-inner">
      <header className="mp-heading">
        <button type="button" className="mp-icon-button" aria-label={tr(room ? "Retour à l’accueil" : "Choisir un thème")} onClick={() => room ? onBack() : navigate(`/play?mode=duel&theme=${encodeURIComponent(theme)}`)}><ArrowLeft size={22} /></button>
        <span><strong>{tr("Duel en ligne")}</strong><small>{room ? tr("Salon {{code}}", { code: room.code }) : themeLabel}</small></span>
        <button type="button" className="mp-icon-button" aria-label={tr(sound ? "Couper le son" : "Activer le son")} aria-pressed={sound}
          onClick={() => { useGameStore.getState().setSound(!sound); if (!sound) playSound("tap"); }}>{sound ? <Volume2 size={22} /> : <VolumeX size={22} />}</button>
        <span className={`mp-connection ${connected ? "is-connected" : ""}`} role="status" aria-label={connected ? tr("Connecté") : connection === "closed" ? tr("Déconnecté") : tr("Connexion en cours")} />
      </header>

      {error && <p className="mp-error" role="alert">{tr(error)}</p>}
      {room && connection === "reconnecting" && <p className="mp-error" role="status">{tr("Reconnexion… Le chrono continue.")}</p>}

      {!room && <section className="mp-entry" aria-labelledby="mp-entry-title">
        <div className="mp-entry-hero">
          <div className="mp-entry-art" aria-hidden="true">
            {entryPortraits.map(character => <AnimalPortrait key={character.name} imageSrc={character.imageSrc} label={character.label} />)}
            <GameIcon name="duel" className="mp-hero-icon" />
            <span className="mp-entry-spark">✦</span><span className="mp-entry-spark mp-entry-spark--right">✦</span>
          </div>
          <h1 id="mp-entry-title">{tr("À deux, chacun son écran !")}</h1>
          <p>{tr("Trouve le portrait avant ton adversaire !")}</p>
          <div className="mp-entry-tags"><span className="fi-chip">{themeLabel}</span><span className="fi-chip"><Hearts count={3} />{tr("La même grille")}</span></div>
        </div>
        <form className="mp-create-form" onSubmit={event => submit(event, false)}>
          <div className="mp-identity">
            <label htmlFor="mp-name">{tr("Ton pseudo")}</label>
            <div className="mp-name-row">
              <input id="mp-name" value={name} onChange={event => changeName(event.target.value)} placeholder={tr("Ton pseudo")} autoComplete="nickname" spellCheck={false} maxLength={NICKNAME_MAX_LENGTH} required aria-describedby="mp-name-hint" />
              <button type="button" className="mp-icon-button mp-shuffle" aria-label={tr("Tirer un pseudo au hasard")} onClick={() => changeName(generateNickname(locale, name))}><Dices size={23} /></button>
            </div>
            <p id="mp-name-hint">{tr("Un pseudo pour toi. Tu peux le changer !")}</p>
          </div>
          <button type="submit" className="mp-button mp-button--gold mp-create-button" disabled={!connected || pending || !name.trim()}><GameIcon name="duel" />{tr(pending ? "Chargement…" : "Créer un salon")}</button>
        </form>
        <div className="mp-divider"><span>{tr("ou rejoins un ami")}</span></div>
        <form className="mp-join-form" onSubmit={event => submit(event, true)}>
          <label htmlFor="mp-code">{tr("Code du salon")}</label>
          <div className="mp-join-row">
            <input id="mp-code" className="mp-code-input" value={code} onChange={event => setCode(normalizeRoomCode(event.target.value))}
              placeholder="A3B7K" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={5} required />
            <button type="submit" className="mp-button" disabled={!connected || pending || !name.trim() || code.length !== 5}>{tr("Rejoindre")}</button>
          </div>
        </form>
      </section>}

      {room && room.status === "waiting" && <>
        <section className="mp-card mp-lobby">
          <span className="mp-eyebrow">{tr("Invite ton adversaire")}</span>
          <h1 className="mp-room-code">{room.code}</h1>
          <div className="mp-qr">{qr ? <img src={qr} alt={tr("QR code pour rejoindre le salon {{code}}", { code: room.code })} width={168} height={168} /> : <GameIcon name="duel" />}</div>
          <div className="mp-share-actions"><button type="button" className="mp-button mp-button--small" onClick={() => void share(true)}><Copy size={16} /> {tr("Copier le lien")}</button>
            <button type="button" className="mp-button mp-button--small" onClick={() => void share()}><Share2 size={16} /> {tr("Partager")}</button></div>
          {notice && <p className="mp-notice" role="status">{tr(notice)}</p>}
          {new Set(["localhost", "127.0.0.1", "[::1]"]).has(window.location.hostname) && <p className="mp-local-hint">{tr("Pour inviter un téléphone, ouvre le jeu avec l’adresse réseau de cet ordinateur.")}</p>}
          <p className="mp-rules">{tr("La même grille pour tous les deux.")}<br />{tr("Le premier à trouver gagne 1 point et {{count}} secondes.", { count: Math.round(room.rules.correctBonusMs / 1_000) })}<br />{tr("Une erreur = 1 vie en moins.")}<br />{tr("Plus de temps ou plus de vies ? Le duel est perdu.")}</p>
        </section>
        <div className="mp-players"><PlayerCard player={me} own now={clock} /><PlayerCard player={other} now={clock} /></div>
        <button type="button" className="mp-button mp-button--gold mp-ready" disabled={!connected || poolStatus !== "ready" || !other}
          aria-busy={poolStatus === "loading"} onClick={() => send({ type: "ready", ready: !me?.ready })}>
          {me?.ready ? tr("Prêt ! Annuler") : !other ? tr("On attend ton adversaire…") : tr("Je suis prêt !")}
        </button>
      </>}

      {inMatch && <>
        <div className="mp-players mp-players--compact"><PlayerCard player={me} own now={clock} /><PlayerCard player={other} now={clock} /></div>
        {spec && <>
          <div className="mp-game-header">
            <div className="mp-wanted"><span className="mp-wanted-picture" key={self?.levelNonce}><AnimalPortrait imageSrc={spec.wanted.imageSrc} label={tr(spec.wanted.label)} accessoryId={spec.accessories?.target} size={62} />
                {!playing && !revealing && <span className="mp-count-badge" aria-label={tr("Départ dans {{count}}", { count: self?.phase === "countdown" ? Math.max(1, remainingSeconds(self.startsAt, clock)) : 3 })} key={Math.max(1, remainingSeconds(self?.startsAt ?? null, clock))}>{self?.phase === "countdown" ? Math.max(1, remainingSeconds(self.startsAt, clock)) : 3}</span>}</span>
              <span><small>{tr("RECHERCHÉ")}</small><strong>{tr(spec.wanted.label)}</strong></span></div>
            <div className="mp-level"><small>{tr("Niveau")}</small><strong>{spec.index}</strong></div>
          </div>
          <div className="mp-board-frame" style={{ background: spec.scene?.background }}>
            {(playing || revealing) && assetsStatus === "ready" ? <MatchBoard key={self?.levelNonce} spec={spec} startsAt={self?.startsAt ?? clock}
              serverNow={serverNow} enabled={playing && connected && !confirmQuit} onTap={tap} playerId={self!.playerId}
              opponentName={other?.name ?? tr("Ton adversaire")} levelNonce={self!.levelNonce!} taps={room.taps}
              revealElapsedMs={revealing ? room.reveal?.elapsedMs : undefined} /> : <div className="mp-empty-board" role="status" aria-label={tr("Niveau {{level}}, {{name}}, départ dans un instant", { level: spec.index, name: tr(spec.wanted.label) })} />}
            {revealing && <span className="mp-round-reveal" role="status"><GameIcon name="check" />
              {room.reveal?.winnerId === self?.playerId ? <>{tr("Tu l’as trouvé !")}<small>+1 · +{room.rules.correctBonusMs / 1_000} s</small></>
                : <>{tr("{{name}} l’a trouvé !", { name: other?.name ?? tr("Ton adversaire") })}<small>{tr("Voici où il était.")}</small></>}
            </span>}
            {feedback && !revealing && <span className={`mp-feedback ${feedback.startsWith("+") ? "is-good" : ""}`} role="status">{tr(feedback)}</span>}
          </div>
          <div className="mp-tap-legend"><span><i />{tr("Tes clics")}</span><span><i />{other?.name ?? tr("Ton adversaire")}</span>
            {spec.index >= 3 && <small>{tr("Attention aux perturbations !")}</small>}</div>
        </>}
      </>}

      {room?.status === "finished" && <MatchResult key={room.matchNumber} room={room} me={me} other={other} connected={connected}
        onRematch={() => send({ type: "rematch", ready: !me?.ready })} onHome={quit}
        onThemes={() => { leave(); navigate(`/play?mode=duel&theme=${encodeURIComponent(currentTheme)}`); }}
        lastTarget={spec && room.reveal && assetsStatus === "ready" ? <div className="mp-board-frame" style={{ background: spec.scene?.background }}>
          <MatchBoard spec={spec} startsAt={self?.startsAt ?? clock} serverNow={serverNow} enabled={false} onTap={tap}
            playerId={self!.playerId} opponentName={other?.name ?? tr("Ton adversaire")} levelNonce={self!.levelNonce!}
            taps={[]} revealElapsedMs={room.reveal.elapsedMs} />
        </div> : undefined} />}

      {readyAssetsError && <div className="mp-error" role="alert">{tr("Les images n’ont pas toutes chargé.")} <button type="button" className="mp-button mp-button--small" onClick={() => setAttempt(value => value + 1)}>{tr("Réessayer")}</button>
      </div>}
    </div>
    {confirmQuit && <div className="mp-confirm-backdrop"><section className="mp-card mp-confirm" role="alertdialog" aria-modal="true" aria-labelledby="mp-quit-title">
      <button type="button" className="mp-confirm-close mp-icon-button" aria-label={tr("Continuer le duel")} onClick={() => setConfirmQuit(false)}><X size={20} /></button>
      <h2 id="mp-quit-title">{tr("Quitter le salon ?")}</h2><p>{room?.status === "waiting" ? tr("Ton adversaire pourra inviter quelqu’un d’autre.") : tr("Tu abandonnes ce duel. Le chrono continue pendant ce message.")}</p>
      <button type="button" className="mp-button mp-button--gold" onClick={() => setConfirmQuit(false)}>{tr("Continuer")}</button>
      <button type="button" className="mp-button" onClick={quit}>{tr("Quitter")}</button>
    </section></div>}
  </main>;
}
