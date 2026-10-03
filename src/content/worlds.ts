// Mondes du mode Aventure : 10 niveaux chacun, débloqués avec les étoiles.
import { animalsPack } from "../helpers/characters";
import type { CharacterColor, CharacterDetails } from "../helpers/characters";
import { emojiImage } from "../helpers/emojiImage";

export type WorldId = "animaux" | "ocean" | "dinos" | "halloween" | "espace";

export type World = {
  id: WorldId;
  name: string;
  emoji: string;
  startIndex: number; // index moteur du niveau 1
  characters: CharacterDetails[];
  background: string; // dégradé CSS
  accent: string;
  unlockStars: number;
};

export const LEVELS_PER_WORLD = 10;

type EmojiDef = [slug: string, emoji: string, label: string, color: CharacterColor, family: string];

// L'image est dessinée au premier accès à imageSrc (rien n'est dessiné à l'import)
function emojiCharacters(world: WorldId, defs: EmojiDef[]): CharacterDetails[] {
  return defs.map(([slug, emoji, label, color, family]) => ({
    get imageSrc() {
      return emojiImage(emoji);
    },
    name: `${world}-${slug}`,
    label,
    serie: world,
    color,
    family,
    emoji,
  }));
}

// Familles = persos qui se ressemblent, pour le modificateur « sosies »
const ocean = emojiCharacters("ocean", [
  ["requin", "🦈", "Requin", "grey", "gris"],
  ["dauphin", "🐬", "Dauphin", "grey", "gris"],
  ["phoque", "🦭", "Phoque", "grey", "gris"],
  ["baleine", "🐳", "Baleine", "blue", "baleine"],
  ["rorqual", "🐋", "Rorqual", "blue", "baleine"],
  ["poulpe", "🐙", "Poulpe", "pink", "tentacules"],
  ["calamar", "🦑", "Calamar", "pink", "tentacules"],
  ["crabe", "🦀", "Crabe", "red", "pinces"],
  ["homard", "🦞", "Homard", "red", "pinces"],
  ["poisson", "🐠", "Poisson-clown", "yellow", "poisson"],
  ["globe", "🐡", "Poisson-globe", "yellow", "poisson"],
  ["tortue", "🐢", "Tortue", "green", "tortue"], // seule de sa famille (exception assumée)
]);

const dinos = emojiCharacters("dinos", [
  ["trex", "🦖", "T-Rex", "green", "dino"],
  ["diplodocus", "🦕", "Diplodocus", "green", "dino"],
  ["crocodile", "🐊", "Crocodile", "green", "reptile"],
  ["lezard", "🦎", "Lézard", "green", "reptile"],
  ["dragon", "🐉", "Dragon", "green", "dragon"],
  ["tete-dragon", "🐲", "Bébé dragon", "green", "dragon"],
  ["serpent", "🐍", "Serpent", "green", "petit-vert"],
  ["grenouille", "🐸", "Grenouille", "green", "petit-vert"],
  ["oeuf", "🥚", "Œuf", "white", "fossile"],
  ["os", "🦴", "Os", "white", "fossile"],
  ["dodo", "🦤", "Dodo", "grey", "oiseau"],
  ["plume", "🪶", "Plume", "grey", "oiseau"],
]);

const halloween = emojiCharacters("halloween", [
  ["citrouille", "🎃", "Citrouille", "orange", "orange"],
  ["chat", "🐈", "Chat", "orange", "orange"],
  ["bonbon", "🍬", "Bonbon", "orange", "orange"],
  ["fantome", "👻", "Fantôme", "white", "blanc"],
  ["crane", "💀", "Crâne", "white", "blanc"],
  ["araignee", "🕷️", "Araignée", "black", "araignee"],
  ["toile", "🕸️", "Toile", "black", "araignee"],
  ["vampire", "🧛", "Vampire", "purple", "monstre"],
  ["zombie", "🧟", "Zombie", "green", "monstre"],
  ["sorcier", "🧙", "Sorcier", "purple", "monstre"],
  ["chauve-souris", "🦇", "Chauve-souris", "brown", "volant"],
  ["hibou", "🦉", "Hibou", "brown", "volant"],
]);

const espace = emojiCharacters("espace", [
  ["alien", "👽", "Alien", "green", "alien"],
  ["monstre", "👾", "Petit monstre", "purple", "alien"],
  ["fusee", "🚀", "Fusée", "red", "vaisseau"],
  ["soucoupe", "🛸", "Soucoupe", "grey", "vaisseau"],
  ["robot", "🤖", "Robot", "grey", "metal"],
  ["satellite", "🛰️", "Satellite", "grey", "metal"],
  ["terre", "🌍", "Terre", "blue", "planete"],
  ["saturne", "🪐", "Saturne", "orange", "planete"],
  ["lune", "🌙", "Lune", "yellow", "jaune"],
  ["etoile", "⭐", "Étoile", "yellow", "jaune"],
  ["soleil", "🌞", "Soleil", "yellow", "feu"],
  ["comete", "☄️", "Comète", "orange", "feu"],
]);

export const WORLDS: World[] = [
  {
    id: "animaux",
    name: "Animaux",
    emoji: "🦁",
    startIndex: 1,
    characters: animalsPack,
    background: "linear-gradient(160deg, #ffe08a 0%, #f6b94c 55%, #d9893a 100%)",
    accent: "#e07a1f",
    unlockStars: 0,
  },
  {
    id: "ocean",
    name: "Océan",
    emoji: "🐳",
    startIndex: 11,
    characters: ocean,
    background: "linear-gradient(160deg, #7fd8ff 0%, #2e8fd8 55%, #15467f 100%)",
    accent: "#1f7ae0",
    unlockStars: 12,
  },
  {
    id: "dinos",
    name: "Dinosaures",
    emoji: "🦖",
    startIndex: 21,
    characters: dinos,
    background: "linear-gradient(160deg, #c8ef8a 0%, #6cbf4a 55%, #2f6e33 100%)",
    accent: "#3f9a2f",
    unlockStars: 24,
  },
  {
    id: "halloween",
    name: "Halloween",
    emoji: "🎃",
    startIndex: 31,
    characters: halloween,
    background: "linear-gradient(160deg, #c79bff 0%, #7a3fd1 55%, #3a1670 100%)",
    accent: "#ff8a1f",
    unlockStars: 36,
  },
  {
    id: "espace",
    name: "Espace",
    emoji: "🚀",
    startIndex: 41,
    characters: espace,
    background: "radial-gradient(circle at 30% 20%, #4b5bd6 0%, #1c2266 45%, #070a24 100%)",
    accent: "#ffd23f",
    unlockStars: 48,
  },
];

export function getWorld(id: string): World | undefined {
  return WORLDS.find((w) => w.id === id);
}

export function allCharacters(): CharacterDetails[] {
  return WORLDS.flatMap((w) => w.characters);
}

export function worldOfCharacter(name: string): World | undefined {
  return WORLDS.find((w) => w.characters.some((c) => c.name === name));
}
