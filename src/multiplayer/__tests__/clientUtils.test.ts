import { describe, expect, it } from "vitest";
import { boardElapsed, encodeClientMessage, invitationUrl, multiplayerUrl, normalizeRoomCode, playerTimeSeconds, remainingSeconds, stableSelfSnapshot } from "../clientUtils";
import { multiplayerLevel } from "../multiplayerRules";
import type { SelfSnapshot } from "../protocol";
import { MULTIPLAYER_PROTOCOL_VERSION } from "../protocol";

describe("client des salons", () => {
  it("utilise le même hôte en WS local et WSS publié, avec une adresse séparée configurable", () => {
    expect(multiplayerUrl({ protocol: "http:", host: "192.168.1.10:5174" })).toBe("ws://192.168.1.10:5174/ws");
    expect(multiplayerUrl({ protocol: "https:", host: "findit.example" })).toBe("wss://findit.example/ws");
    expect(multiplayerUrl({ protocol: "https:", host: "findit.example" }, "https://rooms.example/ws")).toBe("wss://rooms.example/ws");
    expect(() => multiplayerUrl({ protocol: "https:", host: "findit.example" }, "javascript:alert(1)")).toThrow();
  });

  it("partage seulement le code public du salon et normalise la saisie", () => {
    expect(normalizeRoomCode(" a3-b7 k \n")).toBe("A3B7K");
    expect(normalizeRoomCode("A3B7KTOOLONG")).toBe("A3B7K");
    const invitation = new URL(invitationUrl("https://findit.example/private?token=secret", "a3b7k"));
    expect(invitation.pathname).toBe("/multiplayer");
    expect([...invitation.searchParams]).toEqual([["room", "A3B7K"]]);
    expect(JSON.parse(encodeClientMessage({ type: "join", name: "Léa", code: "A3B7K" }))).toEqual({
      type: "join", name: "Léa", code: "A3B7K", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
    });
  });

  it("garde les ressources de la manche quand seul le score adverse change", () => {
    const first: SelfSnapshot = { playerId: "1", phase: "playing", levelNonce: "n1", spec: multiplayerLevel(1, 3, "animaux"),
      startsAt: 10_000, deadline: 40_000, prepareDeadline: null, lastResult: null, resultSequence: 0, remainingMs: 30_000 };
    const next = stableSelfSnapshot(first, JSON.parse(JSON.stringify(first)) as SelfSnapshot);
    expect(next.spec).toBe(first.spec);
    const newLevel = stableSelfSnapshot(first, { ...first, levelNonce: "n2", spec: multiplayerLevel(2, 3, "animaux") });
    expect(newLevel.spec).not.toBe(first.spec);
    expect(newLevel.spec?.index).toBe(2);
    expect(stableSelfSnapshot(first, { ...first, levelNonce: null, spec: null }).spec).toBeNull();
  });

  it("ne pause ni le chrono ni les déplacements quand le navigateur est masqué", () => {
    expect(remainingSeconds(40_000, 10_100)).toBe(30);
    expect(remainingSeconds(40_000, 35_000)).toBe(5);
    expect(remainingSeconds(40_000, 50_000)).toBe(0);
    expect(boardElapsed({ startsAt: 10_000 }, 35_000)).toBe(25);
    expect(boardElapsed({ startsAt: 10_000 }, 9_000)).toBe(0);
  });

  it("fige chaque réserve pendant le compte à rebours commun sans ajouter trois secondes", () => {
    const player = { phase: "countdown" as const, deadline: 63_000, remainingMs: 60_000 };
    expect(playerTimeSeconds(player, 0)).toBe(60);
    expect(playerTimeSeconds(player, 2_000)).toBe(60);
    expect(playerTimeSeconds({ ...player, phase: "playing" }, 8_000)).toBe(55);
    expect(playerTimeSeconds({ ...player, phase: "preparing", remainingMs: 22_350, deadline: null }, 20_000)).toBe(23);
    expect(playerTimeSeconds({ ...player, phase: "eliminated", remainingMs: 0, deadline: null }, 70_000)).toBe(0);
  });
});
