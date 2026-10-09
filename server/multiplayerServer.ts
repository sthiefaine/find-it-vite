import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { levelCharacterIds, multiplayerLevel, multiplayerPool, MULTIPLAYER_THEMES } from "../src/multiplayer/multiplayerRules";
import { DEFAULT_MATCH_RULES, MULTIPLAYER_PATH, MULTIPLAYER_PROTOCOL_VERSION, ROOM_CODE_PATTERN } from "../src/multiplayer/protocol";
import type { ClientMessage, LastResult, MatchRules, MultiplayerTheme, PublicPlayer, RoomSnapshot, SelfSnapshot, ServerMessage } from "../src/multiplayer/protocol";

import { validPurchasedPeople } from "../src/content/personUnlocks";
import { MIN_POOL_SIZE } from "../src/engine/generateLevel";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const WAITING_TTL_MS = 10 * 60_000;
const FINISHED_TTL_MS = 5 * 60_000;
const SOCKET_IDLE_MS = 60_000;

type Peer = { socket: WebSocket; ip: string; room?: Room; player?: Player; messages: number; windowAt: number; lastAt: number };
type Player = PublicPlayer & SelfSnapshot & {
  token: string;
  peer?: Peer;
  assetsReady: boolean;
  disconnectedAt: number | null;
  allIds: Set<number>;
  wantedIds: Set<number>;
  lastTapAt: number;
  purchasedPeople: string[];
};
type Room = Omit<RoomSnapshot, "players"> & {
  players: Player[];
  seed: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
};
type RateWindow = { startsAt: number; count: number };
export type MultiplayerServerOptions = {
  port?: number;
  host?: string;
  distDir?: string;
  allowedOrigins?: string[];
  trustProxy?: boolean;
  maxRooms?: number;
  maxConnections?: number;
  maxConnectionsPerIp?: number;
  rules?: Partial<MatchRules>;
  now?: () => number;
  tickMs?: number;
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".webmanifest": "application/manifest+json",
};

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFKC").replace(/[\p{Cc}\p{Cf}]/gu, "").trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 20 ? name : null;
}

function validMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const v = value as Record<string, unknown>;
  if ((v.type === "create" || v.type === "join") && v.purchasedPeople !== undefined &&
    (!Array.isArray(v.purchasedPeople) || v.purchasedPeople.length > 100 || v.purchasedPeople.some(id => typeof id !== "string" || id.length > 64))) return false;
  switch (v.type) {
    case "create": return cleanName(v.name) !== null && MULTIPLAYER_THEMES.includes(v.theme as MultiplayerTheme);
    case "join": return cleanName(v.name) !== null && typeof v.code === "string" && ROOM_CODE_PATTERN.test(v.code);
    case "resume": return typeof v.code === "string" && ROOM_CODE_PATTERN.test(v.code) && typeof v.token === "string" && /^[a-f0-9]{64}$/.test(v.token);
    case "ready": return typeof v.ready === "boolean";
    case "assetsReady": return typeof v.levelNonce === "string" && v.levelNonce.length <= 64;
    case "tap": return typeof v.levelNonce === "string" && v.levelNonce.length <= 64 && Number.isSafeInteger(v.characterId) && (v.characterId as number) >= 0;
    case "leave": return true;
    case "ping": return typeof v.clientTime === "number" && Number.isFinite(v.clientTime);
    default: return false;
  }
}

export function createMultiplayerServer(options: MultiplayerServerOptions = {}) {
  const now = options.now ?? Date.now;
  const rooms = new Map<string, Room>();
  const peers = new Set<Peer>();
  const createRates = new Map<string, RateWindow>();
  const joinRates = new Map<string, RateWindow>();
  const rules = { ...DEFAULT_MATCH_RULES, ...options.rules };
  for (const [key, value] of Object.entries(rules)) if (!Number.isFinite(value) || (key === "maxMatchMs" ? value < 0 : value <= 0)) throw new Error("Règles multijoueur invalides");
  const distDir = options.distDir ? path.resolve(options.distDir) : null;

  function send(peer: Peer, message: ServerMessage) {
    if (peer.socket.readyState !== WebSocket.OPEN) return;
    if (peer.socket.bufferedAmount > 256 * 1024) { peer.socket.close(1013, "Connexion trop lente"); return; }
    peer.socket.send(JSON.stringify(message));
  }
  const error = (peer: Peer, code: string, message: string) => send(peer, { type: "error", code, message });

  function publicRoom(room: Room): RoomSnapshot {
    return {
      code: room.code, status: room.status, theme: room.theme, rules: room.rules, winnerIds: room.winnerIds, finishReason: room.finishReason,
      players: room.players.map(({ id, name, connected, ready, score, lives, level, phase, remainingMs, deadline }) => ({ id, name, connected, ready, score, lives, level, phase, remainingMs, deadline })),
    };
  }
  function broadcast(room: Room) {
    const snapshot = publicRoom(room);
    for (const player of room.players) if (player.peer) {
      const { playerId, phase, levelNonce, spec, startsAt, deadline, prepareDeadline, lastResult, resultSequence, remainingMs } = player;
      send(player.peer, { type: "state", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, serverNow: now(), room: snapshot, self: { playerId, phase, levelNonce, spec, startsAt, deadline, prepareDeadline, lastResult, resultSequence, remainingMs } });
    }
  }
  function bind(peer: Peer, room: Room, player: Player) {
    peer.room = room;
    peer.player = player;
    player.peer = peer;
    player.connected = true;
    player.disconnectedAt = null;
    if (room.status === "countdown" && room.players.length === 2 && room.players.every((other) => other.phase === "preparing" && other.assetsReady && other.connected)) startCountdown(room);
    send(peer, { type: "session", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, playerId: player.id, token: player.token, code: room.code });
    broadcast(room);
  }
  function newPlayer(name: string): Player {
    const id = randomBytes(8).toString("hex");
    return {
      id, playerId: id, token: randomBytes(32).toString("hex"), name, connected: true, ready: false,
      score: 0, lives: rules.lives, level: 1, phase: "waiting", levelNonce: null, spec: null, startsAt: null, deadline: null,
      prepareDeadline: null, lastResult: null, resultSequence: 0, assetsReady: false, disconnectedAt: null,
      allIds: new Set(), wantedIds: new Set(), lastTapAt: -Infinity,
      remainingMs: rules.initialTimeMs, purchasedPeople: [],
    };
  }
  function freezeClocks(room: Room) {
    for (const player of room.players) {
      if (player.phase === "playing" && player.deadline !== null) player.remainingMs = Math.max(0, player.deadline - now());
      player.deadline = null;
    }
  }
  function finish(room: Room, reason: RoomSnapshot["finishReason"], winners: string[]) {
    if (room.status === "finished") return;
    freezeClocks(room);
    room.status = "finished";
    room.finishedAt = now();
    room.finishReason = reason;
    room.winnerIds = winners;
  }
  function eliminate(player: Player, result: LastResult) {
    if (result === "timeout") player.remainingMs = 0;
    else player.lives = 0;
    player.phase = "eliminated";
    player.deadline = null;
    player.startsAt = null;
    player.prepareDeadline = null;
    player.lastResult = result;
    player.resultSequence++;
  }
  function prepare(room: Room) {
    const commonPurchases = room.players[0].purchasedPeople.filter(id => room.players.every(player => player.purchasedPeople.includes(id)));
    if (multiplayerPool(room.theme, commonPurchases).length < MIN_POOL_SIZE) {
      for (const player of room.players) {
        player.ready = false;
        if (player.peer) error(player.peer, "NOT_ENOUGH_PORTRAITS", "Débloquez au moins 3 portraits en commun dans ce thème pour jouer ensemble.");
      }
      return false;
    }
    const spec = multiplayerLevel(room.players[0].level, room.seed, room.theme, commonPurchases);
    const ids = levelCharacterIds(spec);
    const nonce = randomBytes(16).toString("hex");
    room.status = "countdown";
    for (const player of room.players) {
      player.spec = spec;
      player.allIds = ids.all;
      player.wantedIds = ids.wanted;
      player.levelNonce = nonce;
      player.assetsReady = false;
      player.phase = "preparing";
      player.startsAt = null;
      player.deadline = null;
      player.prepareDeadline = now() + rules.preparationTimeoutMs;
    }
    return true;
  }
  function startCountdown(room: Room) {
    const startsAt = now() + rules.countdownMs;
    for (const player of room.players) {
      player.phase = "countdown";
      player.prepareDeadline = null;
      player.startsAt = startsAt;
      player.deadline = startsAt + player.remainingMs;
    }
  }
  function resolveTap(room: Room, player: Player, result: "correct" | "wrong") {
    player.lastResult = result;
    player.resultSequence++;
    if (result === "correct") {
      freezeClocks(room);
      player.score++;
      player.remainingMs = Math.min(rules.maxTimeMs, player.remainingMs + rules.correctBonusMs);
      room.players.forEach((other) => other.level++);
      prepare(room);
    } else {
      player.lives--;
      if (player.lives === 0) {
        finish(room, "lives", room.players.filter((other) => other !== player).map((other) => other.id));
        player.phase = "eliminated";
      }
    }
  }
  function allowRate(map: Map<string, RateWindow>, ip: string, limit: number) {
    const t = now();
    const current = map.get(ip);
    if (!current || t - current.startsAt >= 60_000) { map.set(ip, { startsAt: t, count: 1 }); return true; }
    current.count++;
    return current.count <= limit;
  }
  function leave(peer: Peer) {
    const { room, player } = peer;
    if (!room || !player) return;
    player.peer = undefined;
    player.connected = false;
    peer.room = undefined;
    peer.player = undefined;
    if (room.status === "waiting") {
      room.players = room.players.filter((other) => other !== player);
      if (room.players.length === 0) rooms.delete(room.code);
    } else if (room.status !== "finished" && player.lives > 0) {
      eliminate(player, "left");
      finish(room, "abandoned", room.players.filter((other) => other !== player).map((other) => other.id));
    }
    broadcast(room);
  }
  function onMessage(peer: Peer, message: ClientMessage) {
    if (message.type === "ping") { send(peer, { type: "pong", clientTime: message.clientTime, serverNow: now() }); return; }
    if (message.type === "leave") { leave(peer); send(peer, { type: "left" }); return; }
    if (["create", "join", "resume"].includes(message.type) && message.protocolVersion !== MULTIPLAYER_PROTOCOL_VERSION) {
      error(peer, "CLIENT_VERSION", "Le jeu a été mis à jour. Actualise la page avant de rejoindre un salon."); return;
    }
    if (["create", "join", "resume"].includes(message.type) && peer.room) {
      error(peer, "ALREADY_JOINED", "Tu es déjà dans un salon."); return;
    }
    if (message.type === "create") {
      if (!allowRate(createRates, peer.ip, 5)) { error(peer, "RATE_LIMIT", "Patiente un instant avant de créer un autre salon."); return; }
      if (rooms.size >= (options.maxRooms ?? 500)) { error(peer, "SERVER_FULL", "Tous les salons sont occupés, réessaie bientôt."); return; }
      let code: string;
      do { code = Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(""); } while (rooms.has(code));
      const player = newPlayer(cleanName(message.name)!);
      player.purchasedPeople = validPurchasedPeople(message.purchasedPeople);
      if (multiplayerPool(message.theme, player.purchasedPeople).length < MIN_POOL_SIZE) {
        error(peer, "NOT_ENOUGH_PORTRAITS", "Débloque au moins 3 portraits dans ce thème avant de créer un salon."); return;
      }
      const room: Room = { code, status: "waiting", theme: message.theme, players: [player], rules, seed: randomInt(0x100000000), createdAt: now(), startedAt: null, finishedAt: null, winnerIds: [], finishReason: null };
      rooms.set(code, room);
      bind(peer, room, player);
      return;
    }
    if (message.type === "join" || message.type === "resume") {
      if (!allowRate(joinRates, peer.ip, 30)) { error(peer, "RATE_LIMIT", "Trop de tentatives, patiente un instant."); return; }
      const room = rooms.get(message.code);
      if (!room) { error(peer, "ROOM_NOT_FOUND", "Ce salon n’existe plus. Vérifie les cinq caractères."); return; }
      if (message.type === "resume") {
        const token = Buffer.from(message.token, "hex");
        const player = room.players.find((candidate) => timingSafeEqual(Buffer.from(candidate.token, "hex"), token));
        if (!player) { error(peer, "SESSION_EXPIRED", "Cette place n’est plus disponible."); return; }
        if (player.peer && player.peer !== peer) {
          const previous = player.peer;
          previous.player = undefined;
          previous.room = undefined;
          previous.socket.close(4001, "Session reprise sur une autre connexion");
        }
        bind(peer, room, player);
      } else {
        if (room.status !== "waiting") { error(peer, "ALREADY_STARTED", "Cette partie a déjà commencé."); return; }
        if (room.players.length >= 2) { error(peer, "ROOM_FULL", "Ce salon contient déjà deux joueurs."); return; }
        const player = newPlayer(cleanName(message.name)!);
        player.purchasedPeople = validPurchasedPeople(message.purchasedPeople);
        room.players.push(player);
        bind(peer, room, player);
      }
      return;
    }
    const { room, player } = peer;
    if (!room || !player) { error(peer, "NOT_JOINED", "Rejoins d’abord un salon."); return; }
    if (message.type === "ready") {
      if (room.status !== "waiting") return;
      player.ready = message.ready;
      if (room.players.length === 2 && room.players.every((other) => other.ready && other.connected)) {
        if (prepare(room)) room.startedAt = now();
      }
      broadcast(room);
      return;
    }
    if (message.type === "assetsReady") {
      if (room.status === "finished" || player.phase !== "preparing" || player.levelNonce !== message.levelNonce) return;
      player.assetsReady = true;
      if (room.players.every((other) => other.assetsReady && other.connected)) startCountdown(room);
      broadcast(room);
      return;
    }
    if (message.type === "tap") {
      // Only the server's clock, generated ID set and current nonce can award a
      // point. Old/replayed taps never mutate the next level or its lives.
      if (room.status !== "playing" || player.phase !== "playing" || player.levelNonce !== message.levelNonce) return;
      if (player.deadline === null || now() >= player.deadline) { tick(); return; }
      if (!player.allIds.has(message.characterId)) { error(peer, "INVALID_CHARACTER", "Ce portrait n’appartient pas au niveau."); return; }
      if (now() - player.lastTapAt < 180) return;
      player.lastTapAt = now();
      resolveTap(room, player, player.wantedIds.has(message.characterId) ? "correct" : "wrong");
      broadcast(room);
    }
  }

  function tick() {
    const t = now();
    for (const [code, room] of rooms) {
      if ((room.status === "waiting" && t - room.createdAt >= WAITING_TTL_MS)
        || (room.finishedAt !== null && t - room.finishedAt >= FINISHED_TTL_MS)) {
        for (const player of room.players) if (player.peer) {
          error(player.peer, "ROOM_EXPIRED", "Ce salon a expiré. Crée une nouvelle partie.");
          player.peer.room = undefined; player.peer.player = undefined;
        }
        rooms.delete(code); continue;
      }
      let changed = false;
      for (const player of [...room.players]) {
        if (player.disconnectedAt !== null && t - player.disconnectedAt >= rules.disconnectGraceMs) {
          player.disconnectedAt = null;
          if (room.status === "waiting") {
            room.players = room.players.filter((other) => other !== player);
            if (!room.players.length) rooms.delete(code);
          } else if (room.status !== "finished" && player.lives > 0) {
            eliminate(player, "disconnected");
            finish(room, "abandoned", room.players.filter((other) => other !== player).map((other) => other.id));
          }
          changed = true;
        }
        if (room.status === "finished") continue;
        if (player.phase === "preparing" && !player.assetsReady && player.prepareDeadline !== null && t >= player.prepareDeadline) {
          const unready = room.players.filter((other) => other.phase === "preparing" && !other.assetsReady && other.prepareDeadline !== null && t >= other.prepareDeadline);
          unready.forEach((other) => eliminate(other, "assets-timeout"));
          finish(room, "abandoned", room.players.filter((other) => !unready.includes(other)).map((other) => other.id));
          changed = true;
        }
        if (player.phase === "countdown" && player.startsAt !== null && t >= player.startsAt) {
          player.phase = "playing";
          room.status = "playing";
          changed = true;
        }
      }
      // Resolve a clock loss once for the shared board. If both deadlines are
      // exactly equal, nobody wins; arrival order in this loop cannot decide it.
      if (room.status === "playing") {
        const expired = room.players.filter((player) => player.phase === "playing" && player.deadline !== null && t >= player.deadline);
        if (expired.length) {
          const firstDeadline = Math.min(...expired.map((player) => player.deadline!));
          const losers = expired.filter((player) => player.deadline === firstDeadline);
          finish(room, "timeout", room.players.filter((player) => !losers.includes(player)).map((player) => player.id));
          losers.forEach((player) => eliminate(player, "timeout"));
          changed = true;
        }
      }
      if (rules.maxMatchMs > 0 && room.status !== "waiting" && room.status !== "finished" && room.startedAt !== null && t - room.startedAt >= rules.maxMatchMs) {
        finish(room, "time-limit", []); changed = true;
      }
      if (changed) broadcast(room);
    }
    for (const map of [createRates, joinRates]) for (const [ip, window] of map) if (t - window.startsAt > 60_000) map.delete(ip);
    for (const peer of peers) if (!peer.room && t - peer.lastAt > SOCKET_IDLE_MS) peer.socket.close(1000, "Connexion inactive");
  }

  async function handleHttp(request: IncomingMessage, response: ServerResponse) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname === "/health") {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ ok: true })); return;
    }
    if (!distDir || !["GET", "HEAD"].includes(request.method ?? "")) { response.writeHead(404); response.end(); return; }
    let decoded: string;
    try { decoded = decodeURIComponent(pathname); } catch { response.writeHead(400); response.end(); return; }
    if (decoded.split("/").some((part) => part.startsWith("."))) { response.writeHead(404); response.end(); return; }
    let filename = path.resolve(distDir, `.${decoded}`);
    if (!filename.startsWith(`${distDir}${path.sep}`) && filename !== distDir) { response.writeHead(404); response.end(); return; }
    try {
      if (!path.extname(filename)) filename = path.join(distDir, "index.html");
      const actual = await realpath(filename);
      if (!actual.startsWith(`${distDir}${path.sep}`)) throw new Error("Forbidden");
      const details = await stat(actual);
      if (!details.isFile()) throw new Error("Not a file");
      response.writeHead(200, { "Content-Type": MIME[path.extname(actual)] ?? "application/octet-stream", "Content-Length": details.size, "Cache-Control": path.extname(actual) === ".html" ? "no-cache" : "public, max-age=3600" });
      if (request.method === "HEAD") { response.end(); return; }
      createReadStream(actual).on("error", () => response.destroy()).pipe(response);
    } catch { response.writeHead(404); response.end(); }
  }

  const server = createServer((request, response) => { void handleHttp(request, response).catch(() => { if (!response.headersSent) response.writeHead(500); response.end(); }); });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  server.on("upgrade", (request, socket, head) => {
    if (new URL(request.url ?? "/", "http://localhost").pathname !== MULTIPLAYER_PATH) { socket.destroy(); return; }
    const origin = request.headers.origin;
    let originAllowed = !origin;
    if (origin) {
      try {
        const parsed = new URL(origin);
        originAllowed = ["http:", "https:"].includes(parsed.protocol)
          && (options.allowedOrigins?.length ? options.allowedOrigins.includes(parsed.origin) : parsed.host === request.headers.host);
      } catch { originAllowed = false; }
    }
    const forwarded = options.trustProxy ? request.headers["x-forwarded-for"] : undefined;
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : request.socket.remoteAddress ?? "unknown";
    const fromIp = [...peers].filter((peer) => peer.ip === ip).length;
    if (!originAllowed || peers.size >= (options.maxConnections ?? 1000) || fromIp >= (options.maxConnectionsPerIp ?? 30)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); socket.destroy(); return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) => {
      const peer: Peer = { socket: ws, ip, messages: 0, windowAt: now(), lastAt: now() };
      peers.add(peer);
      ws.on("error", () => { /* close handles the player lifecycle */ });
      ws.on("pong", () => { peer.lastAt = now(); });
      ws.on("message", (data, binary) => {
        if (now() - peer.windowAt >= 1000) { peer.windowAt = now(); peer.messages = 0; }
        peer.lastAt = now();
        if (++peer.messages > 40) { ws.close(1008, "Trop de messages"); return; }
        let message: unknown;
        try { message = binary ? null : JSON.parse(data.toString()); } catch { message = null; }
        if (!validMessage(message)) { error(peer, "INVALID_MESSAGE", "Message invalide."); return; }
        try { tick(); onMessage(peer, message); }
        catch { error(peer, "SERVER_ERROR", "La partie n’a pas pu être mise à jour."); }
      });
      ws.on("close", () => {
        peers.delete(peer);
        const { room, player } = peer;
        if (room && player && player.peer === peer) {
          player.peer = undefined;
          player.connected = false;
          player.disconnectedAt = now();
          broadcast(room);
        }
      });
    });
  });
  const interval = options.tickMs === 0 ? null : setInterval(tick, options.tickMs ?? 50);
  interval?.unref();
  const heartbeat = setInterval(() => {
    for (const peer of peers) {
      if (now() - peer.lastAt > SOCKET_IDLE_MS) peer.socket.terminate();
      else peer.socket.ping();
    }
  }, 25_000);
  heartbeat.unref();

  return {
    server,
    tick,
    async listen() {
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(options.port ?? 3001, options.host ?? "127.0.0.1", () => { server.removeListener("error", reject); resolve(); }); });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Adresse serveur indisponible");
      return address;
    },
    async close() {
      if (interval) clearInterval(interval);
      clearInterval(heartbeat);
      for (const peer of peers) peer.socket.terminate();
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
