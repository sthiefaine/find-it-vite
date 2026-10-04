import { describe, expect, it } from "vitest";
import { animalSeries, seriesFromSearch } from "../animalSeries";
import type { CharacterDetails } from "../../helpers/characters";

const pool: CharacterDetails[] = Array.from({ length: 7 }, (_, i) => ({
  name: `a-${i}`, label: `Animal ${i}`, color: "white", family: "blanc", serie: "animal", imageSrc: `/${i}.png`,
  tags: i < 5 ? ["ferme"] : ["oiseaux"],
}));

describe("séries d'animaux", () => {
  it("propose seulement les séries contenant assez d'animaux distincts", () => {
    expect(animalSeries(pool).map((series) => series.id)).toEqual(["ferme"]);
    expect(seriesFromSearch("?serie=ferme", pool)?.characters).toHaveLength(5);
    expect(seriesFromSearch("?serie=oiseaux", pool)).toBeUndefined();
    expect(seriesFromSearch("?serie=inconnue", pool)).toBeUndefined();
  });
  it("préserve le catalogue de l'Aventure et du Défi du jour", () => {
    expect(seriesFromSearch("?mode=daily&serie=ferme", pool)).toBeUndefined();
    expect(seriesFromSearch("?mode=adventure&serie=ferme", pool)).toBeUndefined();
  });
  it("rend jouables les catégories personnalisées une fois cinq portraits publiés", () => {
    const custom = pool.map((animal) => ({ ...animal, tags: ["compagnons-a-poils"] }));
    const series = seriesFromSearch("?serie=compagnons-a-poils", custom);
    expect(series?.label).toBe("compagnons a poils");
    expect(series?.characters).toHaveLength(7);
  });
});
