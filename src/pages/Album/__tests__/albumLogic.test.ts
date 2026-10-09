import { describe, expect, it } from "vitest";
import { caughtCount, nextMedal } from "../albumLogic";
import { allCharacters } from "../../../content/worlds";
import { celebritiesPack, historyPack, peoplePack } from "../../../helpers/characters";

describe("caughtCount", () => {
  it("compte les persos trouvés au moins une fois", () => {
    const [a, b] = allCharacters();
    const r = caughtCount({ collection: { [a.name]: 2, [b.name]: 0, inconnu: 5 } });
    expect(r.caught).toBe(1);
    expect(r.total).toBe(allCharacters().length + peoplePack.length + historyPack.length + celebritiesPack.length);
  });
  it("compte une capture politique sans inventer de captures pour les portraits disponibles", () => {
    const person = peoplePack[0];
    expect(caughtCount({ collection: {} }, peoplePack)).toEqual({ caught: 0, total: peoplePack.length });
    expect(caughtCount({ collection: { [person.name]: 1 } }, peoplePack)).toEqual({ caught: 1, total: peoplePack.length });
  });
});

describe("nextMedal", () => {
  it("annonce la médaille suivante", () => {
    expect(nextMedal(0)).toEqual({ left: 25, medal: "🥉" });
    expect(nextMedal(1)).toEqual({ left: 24, medal: "🥉" });
    expect(nextMedal(24)).toEqual({ left: 1, medal: "🥉" });
    expect(nextMedal(25)).toEqual({ left: 25, medal: "🥈" });
    expect(nextMedal(49)).toEqual({ left: 1, medal: "🥈" });
    expect(nextMedal(50)).toEqual({ left: 50, medal: "🥇" });
    expect(nextMedal(99)).toEqual({ left: 1, medal: "🥇" });
    expect(nextMedal(100)).toEqual({ left: 150, medal: "💎" });
    expect(nextMedal(199)).toEqual({ left: 51, medal: "💎" });
    expect(nextMedal(249)).toEqual({ left: 1, medal: "💎" });
  });
  it("rien après le platine", () => {
    expect(nextMedal(250)).toBeNull();
    expect(nextMedal(1000)).toBeNull();
  });
});
