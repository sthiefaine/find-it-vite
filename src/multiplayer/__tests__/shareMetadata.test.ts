import { describe, expect, it } from "vitest";
import { decorateShareHtml, shareMetadata } from "../shareMetadata";
import { matchRewardId } from "../clientUtils";
import { applyOnlineScore } from "../../save/saveStore";
import { defaultSave } from "../../save/schema";
import { migrate } from "../../save/migrations";

describe("aperçus et reçus des duels", () => {
  it("expose une invitation lisible sans JavaScript et garde seulement le code public", () => {
    const request = "/multiplayer?room=A3B7K&token=secret&name=Alice";
    const meta = shareMetadata("https://findit.example/private", request);
    expect(meta.url).toBe("https://findit.example/multiplayer?room=A3B7K");
    expect(meta.image).toBe("https://findit.example/social/find-it-duel.jpg");
    expect(meta.title).toContain("A3B7K");
    expect(meta.description).toContain("2 secondes");
    const html = decorateShareHtml('<html><head><title>Find It</title><meta name="description" content="Ancien" /></head><body><div id="root"></div></body></html>', "https://findit.example", request);
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toContain("secret");
    expect(html).not.toContain("Alice");
    expect(decorateShareHtml(html, "https://findit.example", request)).toBe(html);
    expect(html.match(/name="description"/g)).toHaveLength(1);
  });
  it("ignore les codes invalides et les protocoles étrangers", () => {
    expect(shareMetadata("javascript:alert(1)", "/multiplayer?room=%22%3E%3Cscript%3E").url).toBe("/multiplayer");
    const html = decorateShareHtml("<head><title>Find It</title></head>", "https://findit.example", "/multiplayer?room=bad&token=secret");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("secret");
    expect(shareMetadata("https://findit.example", "/").title).toContain("foule");
  });
  it("récompense chaque revanche une fois et conserve ses reçus après rechargement", () => {
    const first = matchRewardId("A3B7K", 1, "abc123");
    const second = matchRewardId("A3B7K", 2, "abc123");
    expect(first).toBe("A3B7K:abc123");
    expect(second).not.toBe(first);
    const earned = applyOnlineScore(applyOnlineScore(defaultSave(), first, 4), second, 3);
    expect(earned.wallet.stars).toBe(7);
    const reloaded = migrate(earned);
    expect(applyOnlineScore(reloaded, second, 3).wallet.stars).toBe(7);
    expect(applyOnlineScore(reloaded, second, 5).wallet.stars).toBe(9);
  });
});
