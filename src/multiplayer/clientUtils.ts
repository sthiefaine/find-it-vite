import { MULTIPLAYER_PATH, MULTIPLAYER_PROTOCOL_VERSION, type ClientMessage, type PublicPlayer, type SelfSnapshot } from "./protocol";
import { emojiImage } from "../helpers/emojiImage";
import type { LevelSpec } from "../engine/types";

export function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

export function encodeClientMessage(message: ClientMessage): string {
  return JSON.stringify({ ...message, protocolVersion: MULTIPLAYER_PROTOCOL_VERSION });
}

export function multiplayerUrl(location: Pick<Location, "protocol" | "host">, configured?: string): string {
  const address = configured?.trim();
  if (address) {
    let url: URL;
    try { url = address.startsWith("/") ? new URL(address, `${location.protocol}//${location.host}`) : new URL(address); }
    catch { throw new Error("Adresse du salon invalide."); }
    url.protocol = url.protocol === "https:" ? "wss:" : url.protocol === "http:" ? "ws:" : url.protocol;
    if ((url.protocol !== "ws:" && url.protocol !== "wss:") || url.hash) throw new Error("Adresse du salon invalide.");
    if (location.protocol === "https:" && url.protocol !== "wss:") throw new Error("La connexion au salon doit être sécurisée (WSS).");
    if (url.pathname === "/") url.pathname = MULTIPLAYER_PATH;
    return url.href;
  }
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${MULTIPLAYER_PATH}`;
}

export function invitationUrl(origin: string, roomCode: string): string {
  const url = new URL("/multiplayer", origin);
  url.searchParams.set("room", normalizeRoomCode(roomCode));
  return url.href;
}

export function hydrateMultiplayerSpec(spec: LevelSpec): LevelSpec {
  const hydrate = (character: LevelSpec["wanted"]) => character.imageSrc || !character.emoji
    ? character : { ...character, imageSrc: emojiImage(character.emoji) };
  return { ...spec, wanted: hydrate(spec.wanted), decoys: spec.decoys.map(hydrate) };
}

// Les changements de score adverse ne rechargent pas les images et ne
// reconstruisent pas le plateau de la manche déjà affichée.
export function stableSelfSnapshot(previous: SelfSnapshot | undefined, next: SelfSnapshot): SelfSnapshot {
  return { ...next, spec: previous?.levelNonce === next.levelNonce && previous.spec
    ? previous.spec : next.spec ? hydrateMultiplayerSpec(next.spec) : null };
}

export function remainingSeconds(deadline: number | null, serverNow: number): number {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - serverNow) / 1000));
}

export function playerTimeSeconds(player: Pick<PublicPlayer, "phase" | "deadline" | "remainingMs"> | undefined, serverNow: number): number {
  return player?.phase === "playing" && player.deadline !== null
    ? remainingSeconds(player.deadline, serverNow) : Math.max(0, Math.ceil((player?.remainingMs ?? 60_000) / 1_000));
}

export function boardElapsed(self: Pick<SelfSnapshot, "startsAt">, serverNow: number): number {
  return self.startsAt === null ? 0 : Math.max(0, (serverNow - self.startsAt) / 1000);
}
