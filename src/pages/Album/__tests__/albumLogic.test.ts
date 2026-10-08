import { describe, expect, it } from "vitest";
import { caughtCount, nextMedal } from "../albumLogic";
import { allCharacters } from "../../../content/worlds";
import { peoplePack } from "../../../helpers/characters";

describe("caughtCount", () => {
  it("compte les persos trouvés au moins une fois", () => {
    const [a, b] = allCharacters();
    const r = caughtCount({ collection: { [a.name]: 2, [b.name]: 0, inconnu: 5 } });
    expect(r.caught).toBe(1);
    expect(r.total).toBe(allCharacters().length + peoplePack.length);
  });
  it("compte une capture politique sans inventer de captures pour les portraits disponibles", () => {
    const person = peoplePack[0];
    expect(caughtCount({ collection: {} }, peoplePack)).toEqual({ caught: 0, total: peoplePack.length });
    expect(caughtCount({ collection: { [person.name]: 1 } }, peoplePack)).toEqual({ caught: 1, total: peoplePack.length });
  });
});

describe("nextMedal", () => {
  it("annonce la médaille suivante", () => {
    expect(nextMedal(1)).toEqual({ left: 2, medal: "🥉" });
    expect(nextMedal(3)).toEqual({ left: 3, medal: "🥈" });
    expect(nextMedal(9)).toEqual({ left: 1, medal: "🥇" });
  });
  it("rien après l'or", () => {
    expect(nextMedal(10)).toBeNull();
  });
});
