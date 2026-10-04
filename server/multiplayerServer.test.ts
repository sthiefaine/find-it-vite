// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createMultiplayerServer, type MultiplayerServerOptions } from "./multiplayerServer";
import { levelCharacterIds } from "../src/multiplayer/multiplayerRules";
import type { ClientMessage, ServerMessage } from "../src/multiplayer/protocol";
import { MULTIPLAYER_PROTOCOL_VERSION } from "../src/multiplayer/protocol";

type State = Extract<ServerMessage, { type: "state" }>;
type Session = Extract<ServerMessage, { type: "session" }>;
const running: ReturnType<typeof createMultiplayerServer>[] = [];
afterEach(async () => { await Promise.all(running.splice(0).map((server) => server.close())); });

async function fixture(options: MultiplayerServerOptions = {}) {
  let time = 10_000;
  const server = createMultiplayerServer({ port: 0, tickMs: 0, now: () => time, ...options });
  running.push(server);
  const address = await server.listen();
  const url = `ws://127.0.0.1:${address.port}/ws`;
  return {
    server, url, http: `http://127.0.0.1:${address.port}`,
    step(ms: number) { time += ms; server.tick(); },
  };
}

async function connect(url: string) {
  const socket = new WebSocket(url);
  const messages: ServerMessage[] = [];
  socket.on("message", (data) => messages.push(JSON.parse(data.toString()) as ServerMessage));
  await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  const wait = async <T extends ServerMessage>(predicate: (message: ServerMessage) => message is T, from = 0): Promise<T> => {
    const started = Date.now();
    while (Date.now() - started < 2500) {
      const message = messages.slice(from).find(predicate);
      if (message) return message;
      await new Promise((resolve) => setTimeout(resolve, 3));
    }
    throw new Error(`Message absent : ${JSON.stringify(messages.slice(from))}`);
  };
  return {
    socket, messages,
    send(message: ClientMessage) { socket.send(JSON.stringify({ protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, ...message })); },
    session: (from = 0) => wait((m): m is Session => m.type === "session", from),
    state: (predicate: (message: State) => boolean = () => true, from = 0) => wait((m): m is State => m.type === "state" && predicate(m), from),
    error: (code: string, from = 0) => wait((m): m is Extract<ServerMessage, { type: "error" }> => m.type === "error" && m.code === code, from),
    async close() { const closed = new Promise<void>((resolve) => socket.once("close", () => resolve())); socket.close(); await closed; },
  };
}

async function match(options: MultiplayerServerOptions = {}) {
  const f = await fixture(options);
  const a = await connect(f.url);
  const b = await connect(f.url);
  a.send({ type: "create", name: "Alice", theme: "animaux" });
  const sessionA = await a.session();
  b.send({ type: "join", code: sessionA.code, name: "Bob" });
  const sessionB = await b.session();
  await a.state((s) => s.room.players.length === 2);
  a.send({ type: "ready", ready: true });
  b.send({ type: "ready", ready: true });
  const prepA = await a.state((s) => s.self.phase === "preparing");
  const prepB = await b.state((s) => s.self.phase === "preparing");
  a.send({ type: "assetsReady", levelNonce: prepA.self.levelNonce! });
  b.send({ type: "assetsReady", levelNonce: prepB.self.levelNonce! });
  await a.state((s) => s.self.phase === "countdown");
  f.step(3000);
  const stateA = await a.state((s) => s.self.phase === "playing");
  const stateB = await b.state((s) => s.self.phase === "playing");
  return { ...f, a, b, sessionA, sessionB, stateA, stateB };
}

function ids(state: State) {
  const { all, wanted } = levelCharacterIds(state.self.spec!);
  return { wanted: [...wanted][0], wrong: [...all].find((id) => !wanted.has(id))! };
}

describe("real multiplayer WebSocket server", () => {
  it("creates private rooms with one shared grid and accepts only the first correct tap", async () => {
    const f = await match();
    expect(f.sessionA.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    expect(f.sessionA.token).not.toBe(f.sessionB.token);
    expect(f.stateA.self.spec).toEqual(f.stateB.self.spec);
    expect(f.stateA.self.levelNonce).toBe(f.stateB.self.levelNonce);
    expect(f.stateA.self.startsAt).toBe(f.stateB.self.startsAt);
    expect(JSON.stringify(f.stateA)).not.toContain(f.sessionB.token);
    f.a.send({ type: "tap", levelNonce: f.stateA.self.levelNonce!, characterId: ids(f.stateA).wanted });
    const next = await f.a.state((s) => s.room.players[0].score === 1);
    expect(next.self.phase).toBe("preparing");
    expect(next.self.spec?.index).toBe(2);
    expect(next.room.players.map((p) => p.remainingMs)).toEqual([60_000, 60_000]);
    const opponent = await f.b.state((s) => s.room.players[0].score === 1);
    expect(opponent.self.spec).toEqual(next.self.spec);
    expect(opponent.self.levelNonce).toBe(next.self.levelNonce);
    expect(opponent.room.players[1].lives).toBe(3);
    const staleFrom = f.a.messages.length;
    f.a.send({ type: "tap", levelNonce: f.stateA.self.levelNonce!, characterId: ids(f.stateA).wanted });
    f.b.send({ type: "tap", levelNonce: f.stateB.self.levelNonce!, characterId: ids(f.stateB).wanted });
    f.a.send({ type: "assetsReady", levelNonce: next.self.levelNonce! });
    f.b.send({ type: "assetsReady", levelNonce: next.self.levelNonce! });
    const countdown = await f.a.state((s) => s.self.phase === "countdown", staleFrom);
    expect(countdown.room.players[0].score).toBe(1);
    expect(countdown.room.players[1].score).toBe(0);
    expect(countdown.self.startsAt! - countdown.serverNow).toBe(3000);
  });

  it("arbitrates two simultaneous correct taps into exactly one score and one shared next level", async () => {
    const f = await match();
    f.a.send({ type: "tap", levelNonce: f.stateA.self.levelNonce!, characterId: ids(f.stateA).wanted });
    f.b.send({ type: "tap", levelNonce: f.stateB.self.levelNonce!, characterId: ids(f.stateB).wanted });
    const [a, b] = await Promise.all([
      f.a.state((s) => s.self.spec?.index === 2),
      f.b.state((s) => s.self.spec?.index === 2),
    ]);
    expect(a.room.players.reduce((sum, p) => sum + p.score, 0)).toBe(1);
    expect(a.room.players.map((p) => p.level)).toEqual([2, 2]);
    expect(a.self.spec).toEqual(b.self.spec);
    expect(a.self.levelNonce).toBe(b.self.levelNonce);
  });

  it("waits for both asset acknowledgements before the first shared countdown", async () => {
    const f = await fixture();
    const a = await connect(f.url), b = await connect(f.url);
    a.send({ type: "create", name: "A", theme: "ferme" });
    b.send({ type: "join", name: "B", code: (await a.session()).code });
    await b.session();
    a.send({ type: "ready", ready: true }); b.send({ type: "ready", ready: true });
    const first = await a.state((s) => s.self.phase === "preparing");
    a.send({ type: "assetsReady", levelNonce: first.self.levelNonce! });
    const acknowledged = await a.state((s) => s.self.phase === "preparing", a.messages.length);
    expect(acknowledged.self.startsAt).toBeNull();
    expect(acknowledged.self.deadline).toBeNull();
    const bPrep = await b.state((s) => s.self.phase === "preparing");
    b.send({ type: "assetsReady", levelNonce: bPrep.self.levelNonce! });
    const second = await b.state((s) => s.self.phase === "countdown");
    expect(second.self.startsAt! - second.serverNow).toBe(3000);
  });

  it("ends immediately when one player loses their third life", async () => {
    const f = await match();
    const wrongA = ids(f.stateA).wrong;
    for (let life = 2; life >= 0; life--) {
      f.step(200);
      f.a.send({ type: "tap", levelNonce: f.stateA.self.levelNonce!, characterId: wrongA });
      const result = await f.a.state((s) => s.room.players[0].lives === life);
      if (life > 0) {
        expect(result.self.deadline).toBe(f.stateA.self.deadline);
        expect(result.self.levelNonce).toBe(f.stateA.self.levelNonce);
        expect(result.room.players[1].lives).toBe(3);
      }
    }
    const dead = await f.a.state((s) => s.self.phase === "eliminated");
    expect(dead.room.status).toBe("finished");
    expect(dead.room.players[0].score).toBe(0);
    const end = await f.a.state((s) => s.room.status === "finished");
    expect(end.room.winnerIds).toEqual([f.sessionB.playerId]);
    expect(end.room.players[1].lives).toBe(3);
    expect(end.room.finishReason).toBe("lives");
  });

  it("ends on zero time without consuming a life or starting another level", async () => {
    const f = await match();
    f.a.send({ type: "tap", levelNonce: f.stateA.self.levelNonce!, characterId: 987654321 });
    await f.a.error("INVALID_CHARACTER");
    f.step(60_000);
    const timedOut = await f.a.state((s) => s.self.lastResult === "timeout");
    expect(timedOut.room.players[0].lives).toBe(3);
    expect(timedOut.room.players[0].score).toBe(0);
    expect(timedOut.self.spec?.index).toBe(1);
    expect(timedOut.self.phase).toBe("eliminated");
    expect(timedOut.room.status).toBe("finished");
    expect(timedOut.room.finishReason).toBe("timeout");
    expect(timedOut.room.winnerIds).toEqual([]); // exactly simultaneous deadlines
    expect(timedOut.self.deadline).toBeNull();
  });

  it("ignores claimed scores and makes a player lose on zero lives even with a higher score", async () => {
    const f = await match();
    f.a.socket.send(JSON.stringify({ type: "tap", levelNonce: f.stateA.self.levelNonce, characterId: ids(f.stateA).wanted, score: 9000, lives: 99 }));
    const next = await f.a.state((s) => s.room.players[0].score === 1);
    expect(next.room.players[0].lives).toBe(3);
    f.a.send({ type: "assetsReady", levelNonce: next.self.levelNonce! });
    f.b.send({ type: "assetsReady", levelNonce: next.self.levelNonce! });
    await f.a.state((s) => s.self.phase === "countdown" && s.self.spec?.index === 2);
    f.step(3000);
    const current = await f.a.state((s) => s.self.phase === "playing" && s.self.spec?.index === 2);
    for (let life = 2; life >= 0; life--) {
      f.step(200);
      f.a.send({ type: "tap", levelNonce: current.self.levelNonce!, characterId: ids(current).wrong });
      await f.a.state((s) => s.room.players[0].lives === life);
    }
    const end = await f.a.state((s) => s.room.status === "finished");
    expect(end.room.players.map((p) => p.score)).toEqual([1, 0]);
    expect(end.room.winnerIds).toEqual([f.sessionB.playerId]);
  });

  it("prevents room theft, third players, late joins, duplicate create and invalid payloads", async () => {
    const f = await fixture();
    const a = await connect(f.url), b = await connect(f.url), c = await connect(f.url);
    a.send({ type: "create", name: "Alice", theme: "animaux" });
    const session = await a.session();
    a.send({ type: "create", name: "Clone", theme: "animaux" });
    await a.error("ALREADY_JOINED");
    c.send({ type: "resume", code: session.code, token: "a".repeat(64) });
    await c.error("SESSION_EXPIRED");
    b.send({ type: "join", code: session.code, name: "Bob" }); await b.session();
    c.send({ type: "join", code: session.code, name: "Charlie" }); await c.error("ROOM_FULL");
    a.send({ type: "ready", ready: true }); b.send({ type: "ready", ready: true });
    await a.state((s) => s.room.status === "countdown");
    c.send({ type: "join", code: session.code, name: "Charlie" }); await c.error("ALREADY_STARTED");
    c.socket.send('{"type":"join","code":"bad","name":"C"}'); await c.error("INVALID_MESSAGE");
    c.socket.send("{broken"); await c.error("INVALID_MESSAGE");
    expect((await fetch(`${f.http}/health`)).status).toBe(200);
  });

  it("resumes the same seat privately without resetting score, level or clock", async () => {
    const f = await match();
    await f.a.close();
    await f.b.state((s) => !s.room.players[0].connected);
    f.step(1000);
    const reconnect = await connect(f.url);
    reconnect.send({ type: "resume", code: f.sessionA.code, token: f.sessionA.token });
    expect((await reconnect.session()).playerId).toBe(f.sessionA.playerId);
    const resumed = await reconnect.state();
    expect(resumed.self.deadline).toBe(f.stateA.self.deadline);
    expect(resumed.self.levelNonce).toBe(f.stateA.self.levelNonce);
    expect(resumed.room.players[0].connected).toBe(true);
  });

  it("ends a match after the disconnect grace, and expires abandoned lobby seats", async () => {
    const f = await match();
    await f.a.close();
    await f.b.state((s) => !s.room.players[0].connected);
    f.step(20_000);
    const end = await f.b.state((s) => s.room.status === "finished");
    expect(end.room.winnerIds).toEqual([f.sessionB.playerId]);
    expect(end.room.finishReason).toBe("abandoned");
    const fresh = await fixture();
    const host = await connect(fresh.url);
    host.send({ type: "create", name: "Alice", theme: "animaux" });
    const session = await host.session();
    await host.close();
    await new Promise((resolve) => setTimeout(resolve, 5));
    fresh.step(20_000);
    const late = await connect(fresh.url);
    late.send({ type: "join", code: session.code, name: "Bob" });
    await late.error("ROOM_NOT_FOUND");
  });

  it("bounds preparation so an unready browser cannot hold its opponent forever", async () => {
    const f = await match();
    f.a.send({ type: "tap", levelNonce: f.stateA.self.levelNonce!, characterId: ids(f.stateA).wanted });
    const prep = await f.a.state((s) => s.self.phase === "preparing" && s.room.players[0].score === 1);
    await f.b.state((s) => s.self.spec?.index === 2);
    const from = f.b.messages.length;
    f.b.send({ type: "assetsReady", levelNonce: prep.self.levelNonce! });
    await f.b.state((s) => s.self.phase === "preparing" && s.room.players[0].score === 1, from);
    f.step(15_000);
    const end = await f.b.state((s) => s.room.status === "finished");
    expect(end.room.winnerIds).toEqual([f.sessionB.playerId]);
    expect(end.room.players[0].phase).toBe("eliminated");
  });

  it("preserves individual remaining times across the shared three-second countdown", async () => {
    const f = await match();
    f.step(10_000);
    f.a.send({ type: "tap", levelNonce: f.stateA.self.levelNonce!, characterId: ids(f.stateA).wanted });
    const prep = await f.a.state((s) => s.self.spec?.index === 2);
    expect(prep.room.players.map((p) => p.remainingMs)).toEqual([55_000, 50_000]);
    expect(prep.room.players.map((p) => p.deadline)).toEqual([null, null]);
    f.step(2000);
    f.a.send({ type: "assetsReady", levelNonce: prep.self.levelNonce! });
    f.b.send({ type: "assetsReady", levelNonce: prep.self.levelNonce! });
    const countdown = await f.a.state((s) => s.self.spec?.index === 2 && s.self.phase === "countdown");
    expect(countdown.room.players.map((p) => p.deadline! - countdown.self.startsAt!)).toEqual([55_000, 50_000]);
    f.step(3000);
    await f.b.state((s) => s.self.spec?.index === 2 && s.self.phase === "playing");
    f.step(50_000);
    const ended = await f.a.state((s) => s.room.status === "finished");
    expect(ended.room.winnerIds).toEqual([f.sessionA.playerId]);
    expect(ended.room.players[1].remainingMs).toBe(0);
    expect(ended.room.players[0].remainingMs).toBe(5000);
    expect(ended.room.players[1].lives).toBe(3);
  });

  it("rejects foreign browser origins and has an explicit health endpoint", async () => {
    const f = await fixture();
    const rejected = new WebSocket(f.url, { origin: "https://attacker.example" });
    const failure = await new Promise<Error>((resolve) => rejected.once("error", resolve));
    expect(failure.message).toContain("403");
    expect(await (await fetch(`${f.http}/health`)).json()).toEqual({ ok: true });
  });

  it("requires the matching protocol before creating a room", async () => {
    const f = await fixture();
    const a = await connect(f.url);
    a.send({ type: "create", name: "Alice", theme: "animaux", protocolVersion: 0 });
    await a.error("CLIENT_VERSION");
    a.send({ type: "create", name: "Alice", theme: "animaux" });
    const state = await a.state();
    expect(state.protocolVersion).toBe(MULTIPLAYER_PROTOCOL_VERSION);
    expect(state.room.players).toHaveLength(1);
  });

  it("caps room creation and closes message floods without crashing existing matches", async () => {
    const f = await fixture();
    const a = await connect(f.url);
    for (let i = 0; i < 5; i++) {
      const from = a.messages.length;
      a.send({ type: "create", name: "Alice", theme: "animaux" }); await a.session(from);
      a.send({ type: "leave" });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    a.send({ type: "create", name: "Alice", theme: "animaux" }); await a.error("RATE_LIMIT");
    const closed = new Promise<number>((resolve) => a.socket.once("close", resolve));
    for (let i = 0; i < 45; i++) a.send({ type: "ping", clientTime: i });
    expect(await closed).toBe(1008);
    expect((await fetch(`${f.http}/health`)).status).toBe(200);
  });
});
