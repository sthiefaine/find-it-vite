import { describe, expect, it } from "vitest";
import type { CharacterDetails } from "../../../helpers/characters";
import { albumCategoryTags, filterAlbumCharacters } from "../albumCountryFilters";

const portrait = (name: string, code: string | undefined, tags: string[]): CharacterDetails => ({ name, label: name, imageSrc: "/portrait.png", serie: "celebrity", color: "brown", family: "brun", tags,
  ...(code ? { countryLinks: [{ code, relation: "Carrière documentée dans ce pays.", sourceUrl: "https://example.com/biography" }] } : {}) });
const portraits = [portrait("chef-br", "BR", ["cuisine"]), portrait("sport-br", "BR", ["sport"]), portrait("chef-fr", "FR", ["cuisine"]), portrait("origine-inconnue", undefined, ["cuisine", "brasil"])];

describe("filtres pays et métiers dans l'album", () => {
  it("réserve les catégories de célébrités aux métiers, même avec des anciens tags de pays", () => {
    expect(albumCategoryTags(portrait("cinema-cn", "CN", ["celebrites", "chine", "cn", "cinema"]))).toEqual(["cinema"]);
  });
  it("combine les deux filtres par intersection", () => {
    expect(filterAlbumCharacters(portraits, "cuisine", "br").map(item => item.name)).toEqual(["chef-br"]);
  });
  it("permet le pays seul ou le métier seul sans deviner l'origine", () => {
    expect(filterAlbumCharacters(portraits, "", "BR").map(item => item.name)).toEqual(["chef-br", "sport-br"]);
    expect(filterAlbumCharacters(portraits, "cuisine").map(item => item.name)).toEqual(["chef-br", "chef-fr", "origine-inconnue"]);
  });
  it("effacer les filtres restitue tous les portraits sans muter la collection", () => {
    expect(filterAlbumCharacters(portraits)).toEqual(portraits);
    expect(filterAlbumCharacters(portraits)).not.toBe(portraits);
    expect(filterAlbumCharacters(portraits, "cuisine", "us")).toEqual([]);
  });
});
