import { describe, expect, it } from "vitest";
import { backTarget, headerTitle, showsStars } from "../headerNav";

describe("backTarget", () => {
  it("ramène à la carte depuis une partie Aventure", () => {
    expect(backTarget("/game", "?mode=adventure&world=ocean&level=3")).toBe("/adventure");
  });
  it("revient au choix du thème après Infini et Duel", () => {
    expect(backTarget("/game", "")).toBe("/play?mode=endless");
    expect(backTarget("/game", "?theme=ferme")).toBe("/play?mode=endless");
    expect(backTarget("/duel", "?theme=foret")).toBe("/play?mode=duel");
    expect(backTarget("/multiplayer", "?room=A2BCD")).toBe("/play?mode=duel");
  });
  it("ramène à l'accueil depuis le défi et les menus", () => {
    expect(backTarget("/game", "?mode=daily")).toBe("/");
    expect(backTarget("/adventure", "")).toBe("/");
    expect(backTarget("/album", "?mode=adventure")).toBe("/");
    expect(backTarget("/play", "?mode=duel")).toBe("/");
  });
});

describe("headerTitle", () => {
  it("donne un titre aux pages de menu seulement", () => {
    expect(headerTitle("/album")).toBe("Album");
    expect(headerTitle("/play")).toBe("Choisir un thème");
    expect(headerTitle("/game")).toBeNull();
  });
});

describe("showsStars", () => {
  it("affiche les étoiles sur la carte et les options", () => {
    expect(showsStars("/adventure")).toBe(true);
    expect(showsStars("/options")).toBe(true);
    expect(showsStars("/game")).toBe(false);
  });
});
