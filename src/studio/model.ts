import { ANIMAL_COLORS, animalSpeciesLabel, normalizedAnimalMetadata } from "../content/animalTaxonomy";
import type { AnimalMetadata } from "../content/animalTaxonomy";
import type { CountryLink } from "../helpers/characters";
import { validatedCountryLinks } from "../content/countryLinks";

export const CATEGORIES = {
  animals: "Animaux", people: "Personnes", history: "Histoire",
  politics: "Politique", flags: "Drapeaux", fantasy: "Imaginaire",
} as const;
export type Category = keyof typeof CATEGORIES;
export const isGameCategory = (category: Category) => category === "animals" || category === "politics" || category === "history" || category === "people";
export const COLORS = ["brown", "grey", "yellow", "white", "green", "blue", "red", "orange", "pink", "purple", "black"] as const;
export type SpriteColor = typeof COLORS[number];
export type Theme = { id: string; name: string; category: Category; destination: "game" | "fun" };
export type Sprite = AnimalMetadata & {
  id: string; themeId: string; label: string; subject: string; color: SpriteColor;
  family: string; status: "draft" | "ready"; source: string | null; notes: string;
  countryLinks?: CountryLink[];
};
export type Catalog = { version: 1; revision: number; themes: Theme[]; sprites: Sprite[] };
export type AssetInfo = { source: string; width: number; height: number; transparent: boolean };
export type PublishedCharacter = AnimalMetadata & { name: string; label: string; imageSrc: string; serie: string; color: SpriteColor; family: string; countryLinks?: CountryLink[] };

export const ANIMAL_PROMPT = "Un visage de {sujet} amical et expressif sans cou vu de face, avec une tête beaucoup plus grande que la normale et de petites oreilles pour un effet mignon et stylisé. La tête occupe le maximum d’espace. Le style doit être semi-réaliste sauf pour les oreilles avec une finition lisse et détaillée, inspiré des jeux vidéo modernes sans ajout de lumière et d’ombre. Les yeux doivent être grands et captivants, avec des cils délicats et une expression chaleureuse. Le pelage ou la peau doit être finement texturé, avec des couleurs riches et naturelles. Le museau doit être légèrement arrondi pour accentuer le côté doux et attachant. Aucun ajout de cheveux. Aucune brillance, reflet ou source lumineuse directe. {fond} L’image doit être en haute résolution, avec des bords parfaitement nets et aucune pixellisation. L’ensemble doit dégager un charme nostalgique de jeu vidéo tout en restant moderne.";

export function spritePrompt(category: Category, subject: string, transparent: boolean, metadata?: AnimalMetadata): string {
  const background = transparent
    ? "Le fond doit être entièrement transparent (canal alpha), sans ombre portée, halo ni damier dessiné."
    : "Le fond doit être un blanc pur, sans ombres ni gradients.";
  const name = subject.trim() || "[sujet à préciser]";
  const common = `${background} Format carré, sujet entier centré avec une petite marge, aucun texte ajouté, aucun filigrane. Bords nets et lisibilité à 45 × 45 pixels.`;
  if (category === "animals") {
    const subject = /^[aeiouyhàâéèêëîïôùûüœ]/i.test(name) ? `d’${name}` : `de ${name}`;
    const details = [
      metadata?.species ? `Espèce : ${animalSpeciesLabel(metadata.species)}.` : "",
      metadata?.breed ? `Race ou variété de référence : ${metadata.breed}. Conserver ses traits visuels distinctifs.` : "",
      "Couleur des iris et forme des pupilles naturelles, adaptées à l’espèce, à la race et au pelage ; ne pas imposer des yeux marron à tous les animaux. Aucun iris fluorescent.",
      metadata?.dominantColors?.length ? `Palette dominante du pelage ou de la peau : ${metadata.dominantColors.map((color) => ANIMAL_COLORS[color].label.toLocaleLowerCase("fr")).join(", ")}.` : "",
    ].filter(Boolean).join(" ");
    return `${ANIMAL_PROMPT.replace("de {sujet}", subject).replace("{fond}", background)}${details ? ` ${details}` : ""} Format carré ; tête entière, oreilles comprises, avec une petite marge. Lisible à 45 × 45 pixels. Aucun texte ni filigrane.`;
  }
  if (category === "flags") return `Le drapeau de ${name}, fidèlement reproduit avec ses proportions, couleurs et symboles officiels. Vue de face, à plat, sans mât, sans plis, sans perspective, sans reflet ni ombre. Conserver tous les symboles du drapeau. ${common}`;
  if (category === "fantasy") return `Un sprite de ${name}, stylisé, expressif et chaleureux, inspiré des jeux vidéo modernes. Sujet isolé, grandes formes immédiatement reconnaissables, finition mate détaillée, couleurs riches. Sans lumière directionnelle ni ombre portée. ${common}`;
  return `Un portrait stylisé et reconnaissable de ${name}, vu de face, tête seule sans cou, expression chaleureuse. Proportions mignonnes, finition semi-réaliste lisse et détaillée, couleurs naturelles. Conserver les traits distinctifs, la coiffure, les lunettes présentes, la couleur naturelle des iris d’après les références et les attributs historiques pertinents du sujet. Aspect mat, sans brillance, reflet ni lumière directionnelle. Illustration de jeu vidéo, sans slogan ni message ajouté. ${common}`;
}

export const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isId = (value: unknown): value is string => typeof value === "string" && value.length <= 64 && ID.test(value);
export const validSource = (source: unknown): source is string => typeof source === "string" && (
  /^\/assets\/images\/characters\/(?:animals|people|history|celebrities)\/[a-z0-9-]+\.png$/.test(source) ||
  /^studio:[a-f0-9]{32}\.(png|webp)$/.test(source)
);
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number, required = true): value is string => typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);

export function validateCatalog(input: unknown): Catalog {
  if (!object(input) || input.version !== 1 || !Number.isInteger(input.revision) || (input.revision as number) < 0 || !Array.isArray(input.themes) || !Array.isArray(input.sprites)) throw new Error("Catalogue invalide.");
  if (input.themes.length > 200 || input.sprites.length > 5000) throw new Error("Le catalogue dépasse la capacité de cet atelier.");
  const themes = new Set<string>();
  for (const theme of input.themes) {
    if (!object(theme) || !isId(theme.id) || themes.has(theme.id) || !text(theme.name, 80) || !Object.prototype.hasOwnProperty.call(CATEGORIES, String(theme.category)) || !["game", "fun"].includes(String(theme.destination))) throw new Error("Thème invalide ou identifiant déjà utilisé.");
    if (theme.destination === "game" && !isGameCategory(theme.category as Category)) throw new Error("Seuls les thèmes animaliers, politiques, historiques et de célébrités peuvent rejoindre le jeu.");
    themes.add(theme.id);
  }
  const ids = new Set<string>();
  for (const sprite of input.sprites) {
    if (!object(sprite) || !isId(sprite.id) || ids.has(sprite.id) || !themes.has(String(sprite.themeId)) || !text(sprite.label, 80) || !text(sprite.subject, 240) || !text(sprite.family, 64) || !COLORS.includes(sprite.color as SpriteColor) || !["draft", "ready"].includes(String(sprite.status)) || !(sprite.source === null || validSource(sprite.source)) || !text(sprite.notes, 2000, false)) throw new Error("Sprite invalide, thème inconnu ou identifiant déjà utilisé.");
    if (sprite.status === "ready" && sprite.source === null) throw new Error("Une image est nécessaire pour valider un sprite.");
    if ((sprite.species !== undefined && !text(sprite.species, 64, false)) || (sprite.breed !== undefined && !text(sprite.breed, 80, false))) throw new Error("L’espèce ou la race du sprite est invalide.");
    if (sprite.dominantColors !== undefined && (!Array.isArray(sprite.dominantColors) || sprite.dominantColors.length < 1 || sprite.dominantColors.length > 3 || sprite.dominantColors.some((color) => !COLORS.includes(color as SpriteColor)) || !sprite.dominantColors.includes(sprite.color) || new Set(sprite.dominantColors).size !== sprite.dominantColors.length)) throw new Error("Choisis de 1 à 3 couleurs dominantes différentes, avec la couleur principale.");
    if (sprite.tags !== undefined && (!Array.isArray(sprite.tags) || sprite.tags.length > 12 || sprite.tags.some((tag) => !isId(tag)) || new Set(sprite.tags).size !== sprite.tags.length)) throw new Error("Les catégories du sprite sont invalides (12 maximum, sans doublon).");
    validatedCountryLinks(sprite.countryLinks);
    ids.add(sprite.id);
  }
  // Reconstituer les données : aucun champ inconnu n'est persisté.
  return {
    version: 1, revision: input.revision as number,
    themes: input.themes.map(({ id, name, category, destination }) => ({ id, name, category, destination })),
    sprites: input.sprites.map(({ id, themeId, label, subject, color, family, status, source, notes, species, breed, dominantColors, tags, countryLinks }) => ({ id, themeId, label, subject, color, family, status, source, notes, ...normalizedAnimalMetadata({ color, species, breed, dominantColors, tags }), ...(countryLinks === undefined ? {} : { countryLinks: validatedCountryLinks(countryLinks) }) })),
  };
}

export function gameSprites(catalog: Catalog): Sprite[] {
  const gameThemes = new Set(catalog.themes.filter((t) => isGameCategory(t.category) && t.destination === "game").map((t) => t.id));
  return catalog.sprites.filter((s) => s.status === "ready" && s.source && gameThemes.has(s.themeId));
}

export function imageUrl(source: string | null): string | undefined {
  return source ? source.startsWith("studio:") ? `/__studio/image/${source.slice(7)}` : source : undefined;
}
