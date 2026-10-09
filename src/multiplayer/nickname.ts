import type { Locale } from "../i18n/locales";

export const NICKNAME_KEY = "find-it:multiplayer:nickname:v1";
export const NICKNAME_MAX_LENGTH = 20;

const animals = ["Renard", "Hibou", "Panda", "Lynx", "Toucan", "Koala", "Dauphin", "Tigre", "Loup", "Manchot", "Hérisson", "Capybara", "Chat", "Lapin", "Castor", "Poulpe", "Flamant", "Faucon", "Écureuil", "Perroquet", "Crabe", "Caméléon", "Béluga", "Raton"];
const adjectives = ["Futé", "Agile", "Malin", "Curieux", "Joyeux", "Vif", "Rusé", "Doré", "Furtif", "Espiègle", "Intrépide", "Serein", "Rapide", "Rêveur", "Vaillant", "Cosmique"];
const englishAnimals = ["Fox", "Owl", "Panda", "Lynx", "Toucan", "Koala", "Dolphin", "Tiger", "Wolf", "Penguin", "Hedgehog", "Capybara", "Cat", "Rabbit", "Beaver", "Octopus", "Flamingo", "Falcon", "Squirrel", "Parrot", "Crab", "Chameleon", "Beluga", "Raccoon"];
const englishAdjectives = ["Clever", "Nimble", "Witty", "Curious", "Cheerful", "Swift", "Crafty", "Golden", "Sneaky", "Playful", "Fearless", "Serene", "Speedy", "Dreamy", "Brave", "Cosmic"];

export function generateNickname(locale: Locale, previous = ""): string {
  const names = locale === "fr" ? animals : englishAnimals;
  const qualities = locale === "fr" ? adjectives : englishAdjectives;
  // Enumerate complete combinations so the longest names stay within the
  // server's limit and a new roll always differs from the displayed name.
  const choices = names.flatMap(animal => qualities.map(adjective => locale === "fr"
    ? `${animal} ${adjective}` : `${adjective} ${animal}`))
    .filter(name => name.length <= NICKNAME_MAX_LENGTH && name !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}

export function readNickname(locale: Locale): string {
  try {
    const saved = localStorage.getItem(NICKNAME_KEY)?.trim();
    if (saved && saved.length <= NICKNAME_MAX_LENGTH) return saved;
  } catch { /* A blocked store still gets a playable nickname. */ }
  const name = generateNickname(locale);
  saveNickname(name);
  return name;
}

export function saveNickname(name: string): void {
  const normalized = name.trim();
  if (!normalized || normalized.length > NICKNAME_MAX_LENGTH) return;
  try { localStorage.setItem(NICKNAME_KEY, normalized); }
  catch { /* Keep playing when storage is unavailable. */ }
}
