// Mondes du mode Aventure : 20 étapes chacun, débloqués en terminant le précédent.
import { animalsPack } from "../helpers/characters";
import type { CharacterColor, CharacterDetails } from "../helpers/characters";
import { emojiImage } from "../helpers/emojiImage";
import legacyAnimalIds from "./legacyAnimalIds.json";

const animalById = new Map(animalsPack.map(animal => [animal.name, animal]));
const legacyAnimals = legacyAnimalIds.map(id => animalById.get(id)).filter((animal): animal is CharacterDetails => !!animal);

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

export const LEVELS_PER_WORLD = 20;

// Emoji ≤ 12.0 seulement (Unicode 12, 2019) : Android 10 et moins n'ont pas
// les glyphes plus récents (🦤, 🪶, 🦭… en Emoji 13.0) et les dessinent tous
// en carrés vides identiques, impossibles à distinguer en jeu. Pas de séquence
// ZWJ non plus (🐻‍❄️, 🐈‍⬛… sont en 13.0). Vérifié par isEmojiAfter12 dans les tests.
const EMOJI_13_PLUS: [number, number][] = [
  [0x1f6d6, 0x1f6d7], [0x1f6dc, 0x1f6df], [0x1f6fb, 0x1f6fc], [0x1f7f0, 0x1f7f0],
  [0x1f90c, 0x1f90c], [0x1f972, 0x1f972], [0x1f977, 0x1f979], [0x1f9a3, 0x1f9a4],
  [0x1f9ab, 0x1f9ad], [0x1f9cb, 0x1f9cc], [0x1fa74, 0x1fa77], [0x1fa7b, 0x1fa7f],
  [0x1fa83, 0x1fa8f], [0x1fa96, 0x1faff],
];

// Vrai si l'emoji demande Emoji 13.0 ou plus (codepoint récent ou séquence ZWJ)
export function isEmojiAfter12(emoji: string): boolean {
  for (const ch of emoji) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x200d) return true;
    if (EMOJI_13_PLUS.some(([a, b]) => cp >= a && cp <= b)) return true;
  }
  return false;
}

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
  ["poisson-bleu", "🐟", "Poisson bleu", "blue", "poisson"],
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
  ["aigle", "🦅", "Aigle", "brown", "oiseau"],
  ["perroquet", "🦜", "Perroquet", "red", "oiseau"],
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

const ORIGINAL_WORLDS: World[] = [
  {
    id: "animaux",
    name: "Animaux",
    emoji: "🦁",
    startIndex: 1,
    characters: legacyAnimals,
    background: "linear-gradient(160deg, #ffe08a 0%, #f6b94c 55%, #d9893a 100%)",
    accent: "#e07a1f",
    unlockStars: 0,
  },
  {
    id: "ocean",
    name: "Océan",
    emoji: "🐳",
    startIndex: 21,
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

// Le jeu principal reste animalier. Les anciens thèmes expérimentaux sont
// conservés séparément ; ils ne participent ni à l’Aventure ni au Grand Mélange.
export const WORLDS = ORIGINAL_WORLDS.filter((world) => world.id === "animaux" || world.id === "ocean");
export const FUN_WORLDS = ORIGINAL_WORLDS.filter((world) => !WORLDS.includes(world));

export function getWorld(id: string): World | undefined {
  return WORLDS.find((w) => w.id === id);
}

export function allCharacters(): CharacterDetails[] {
  return [...animalsPack, ...ocean];
}

export function worldOfCharacter(name: string): World | undefined {
  if (animalsPack.some(character => character.name === name)) return getWorld("animaux");
  return WORLDS.find((w) => w.characters.some((c) => c.name === name));
}
