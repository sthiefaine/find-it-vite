import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomSnapshot, SelfSnapshot, ServerMessage } from "./protocol";
import { MULTIPLAYER_PROTOCOL_VERSION } from "./protocol";
import { encodeClientMessage, multiplayerUrl, stableSelfSnapshot } from "./clientUtils";

type Session = { code: string; token: string; playerId: string };
type MatchState = { room: RoomSnapshot; self: SelfSnapshot };
type Connection = "connecting" | "connected" | "reconnecting" | "closed";
const storageKey = (code: string) => `find-it:multiplayer:${code}`;

function readSession(code: string): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(code)) ?? "null") as Session | null;
    return value?.code === code && typeof value.token === "string" ? value : null;
  } catch { return null; }
}

function saveSession(session: Session, clear = false) {
  try {
    if (clear) sessionStorage.removeItem(storageKey(session.code));
    else sessionStorage.setItem(storageKey(session.code), JSON.stringify(session));
  } catch { /* Une session reste jouable si le stockage du navigateur est bloqué. */ }
}

export function useMultiplayer(initialCode: string) {
  const [connection, setConnection] = useState<Connection>("connecting");
  const [match, setMatch] = useState<MatchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const session = useRef<Session | null>(readSession(initialCode));
  const clockOffset = useRef(0);
  const initialRoom = useRef(initialCode);
  const serverNow = useCallback(() => Date.now() + clockOffset.current, []);

  const send = useCallback((message: ClientMessage) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(encodeClientMessage(message));
    return true;
  }, []);

  useEffect(() => {
    let disposed = false;
    let incompatible = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let connectionTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (disposed) return;
      let ws: WebSocket;
      try { ws = new WebSocket(multiplayerUrl(window.location, import.meta.env.VITE_MULTIPLAYER_URL)); }
      catch {
        setError("Le salon est indisponible pour le moment.");
        setConnection("reconnecting");
        return;
      }
      socket.current = ws;
      connectionTimer = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) ws.close();
      }, 10_000);
      ws.onopen = () => {
        clearTimeout(connectionTimer);
        if (disposed) { ws.close(); return; }
        retry = 0;
        setConnection("connected");
        setError(null);
        const existing = session.current ?? readSession(initialRoom.current);
        if (existing) {
          session.current = existing;
          ws.send(encodeClientMessage({ type: "resume", code: existing.code, token: existing.token }));
        }
        ws.send(encodeClientMessage({ type: "ping", clientTime: Date.now() }));
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(encodeClientMessage({ type: "ping", clientTime: Date.now() }));
        }, 10_000);
      };
      ws.onmessage = (event) => {
        if (disposed || ws !== socket.current) return;
        let message: ServerMessage;
        try { message = JSON.parse(String(event.data)) as ServerMessage; }
        catch { return; }
        if (!message || typeof message !== "object") return;
        if ((message.type === "session" || message.type === "state") && message.protocolVersion !== MULTIPLAYER_PROTOCOL_VERSION) {
          incompatible = true;
          setPending(false);
          setError("Le jeu a été mis à jour. Actualise cette page avant de rejoindre un duel.");
          ws.close();
          return;
        }
        if (message.type === "pong") {
          clockOffset.current = message.serverNow - (message.clientTime + Date.now()) / 2;
        } else if (message.type === "session") {
          session.current = { code: message.code, token: message.token, playerId: message.playerId };
          saveSession(session.current);
          setPending(false);
        } else if (message.type === "state") {
          if (clockOffset.current === 0) clockOffset.current = message.serverNow - Date.now();
          setMatch(previous => ({ room: message.room, self: stableSelfSnapshot(previous?.self, message.self) }));
          setPending(false);
        } else if (message.type === "error") {
          setError(message.message);
          setPending(false);
          if (["SESSION_EXPIRED", "ROOM_NOT_FOUND", "INVALID_SESSION", "ROOM_EXPIRED"].includes(message.code)) {
            if (session.current) saveSession(session.current, true);
            session.current = null;
            setMatch(null);
          }
        } else if (message.type === "left") {
          if (session.current) saveSession(session.current, true);
          session.current = null;
          setMatch(null);
          setPending(false);
        }
      };
      ws.onclose = (event) => {
        clearTimeout(connectionTimer);
        clearInterval(pingTimer);
        if (disposed || ws !== socket.current) return;
        setPending(false);
        if (incompatible || event.code === 4001) {
          setConnection("closed");
          if (event.code === 4001) setError("Ce salon a été repris dans un autre onglet. Tu peux y continuer ton duel.");
          return;
        }
        setConnection("reconnecting");
        if (!session.current) setError("Connexion au salon indisponible. Nouvelle tentative en cours…");
        reconnectTimer = setTimeout(connect, Math.min(5_000, 500 * 2 ** retry++));
      };
      ws.onerror = () => { /* onclose porte le message et la reconnexion. */ };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(connectionTimer);
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      socket.current?.close();
      socket.current = null;
    };
  }, []);

  const request = useCallback((message: ClientMessage) => {
    setError(null);
    if (send(message)) setPending(true);
    else setError("La connexion revient… Réessaie dans un instant.");
  }, [send]);

  const leave = useCallback(() => {
    send({ type: "leave" });
    if (session.current) saveSession(session.current, true);
    session.current = null;
    setMatch(null);
    setPending(false);
  }, [send]);

  return { connection, match, error, pending, send, request, leave, serverNow };
}
