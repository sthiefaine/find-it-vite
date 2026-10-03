import { describe, expect, it } from "vitest";
import { caughtCount, nextMedal } from "../albumLogic";
import { allCharacters } from "../../../content/worlds";

describe("caughtCount", () => {
  it("compte les persos trouvés au moins une fois", () => {
    const [a, b] = allCharacters();
    const r = caughtCount({ collection: { [a.name]: 2, [b.name]: 0, inconnu: 5 } });
    expect(r.caught).toBe(1);
    expect(r.total).toBe(allCharacters().length);
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
