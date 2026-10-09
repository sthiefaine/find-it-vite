import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { historyPack } from "../../../helpers/characters";
import { AlbumPortraitCard } from "../AlbumPortraitCard";

describe("surprise dans l’album", () => {
  const character = historyPack.find(person => person.name === "hypatie")!;
  const props = { character, label: "Hypatie", count: 0, purchasable: true, index: 0, onOpen: () => {} };
  it("cache le nom visuel et accessible d’un personnage verrouillé", () => {
    const html = renderToStaticMarkup(createElement(AlbumPortraitCard, { ...props, locked: true }));
    expect(html).not.toContain("Hypatie");
    expect(html).toContain("album-portrait-unknown");
    expect(html).toContain('alt=""');
    expect(html).toContain("100");
  });
  it("montre le nom quand le portrait est obtenu", () => {
    const html = renderToStaticMarkup(createElement(AlbumPortraitCard, { ...props, locked: false }));
    expect(html).toContain("Hypatie");
    expect(html).not.toContain("album-portrait-unknown");
  });
});
