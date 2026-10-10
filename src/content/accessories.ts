export type AccessoryId = "cap" | "bucket-hat" | "sunglasses" | "bow-tie" | "moustache" | "clown-nose";

export type Accessory = {
  id: AccessoryId;
  label: string;
  imageSrc: string;
  // Rectangle dans le carré du portrait, commun au DOM et au rendu Pixi.
  box: { x: number; y: number; width: number; height: number };
};

export const ACCESSORIES: readonly Accessory[] = [
  { id: "cap", label: "Casquette", imageSrc: "/assets/images/accessories/cap.png", box: { x: .17, y: .02, width: .66, height: .4125 } },
  { id: "bucket-hat", label: "Bob", imageSrc: "/assets/images/accessories/bucket-hat.png", box: { x: .12, y: .025, width: .76, height: .3978125 } },
  { id: "sunglasses", label: "Lunettes de soleil", imageSrc: "/assets/images/accessories/sunglasses.png", box: { x: .17, y: .40, width: .66, height: .1546875 } },
  { id: "bow-tie", label: "Nœud papillon", imageSrc: "/assets/images/accessories/bow-tie.png", box: { x: .31, y: .80, width: .38, height: .18109375 } },
  { id: "moustache", label: "Fausse moustache", imageSrc: "/assets/images/accessories/moustache.png", box: { x: .24, y: .66, width: .52, height: .114765625 } },
  { id: "clown-nose", label: "Nez de clown", imageSrc: "/assets/images/accessories/clown-nose.png", box: { x: .39, y: .54, width: .22, height: .22 } },
];

// Accessoires faciles à confondre à 45 px : deux couvre-chefs, deux barres
// horizontales sur le visage, deux formes sous le museau.
export const ACCESSORY_LOOKALIKES: Readonly<Record<AccessoryId, readonly AccessoryId[]>> = {
  cap: ["bucket-hat"],
  "bucket-hat": ["cap"],
  sunglasses: ["moustache"],
  moustache: ["sunglasses", "bow-tie"],
  "bow-tie": ["moustache"],
  "clown-nose": [],
};

const BY_ID = new Map(ACCESSORIES.map((accessory) => [accessory.id, accessory]));
export const getAccessory = (id: AccessoryId | null | undefined): Accessory | undefined => id ? BY_ID.get(id) : undefined;
export const isAccessoryId = (id: string): id is AccessoryId => BY_ID.has(id as AccessoryId);

// Les accessoires noirs se confondent avec les museaux/fourrures noirs à 45 px.
// Une silhouette claire décalée sous l'image garde leur contour perceptible.
export const ACCESSORY_OUTLINE_OFFSETS = [
  { x: -.018, y: 0 }, { x: .018, y: 0 }, { x: 0, y: -.018 }, { x: 0, y: .018 },
] as const;
export const needsAccessoryOutline = (accessory: Accessory) =>
  accessory.id === "moustache" || accessory.id === "sunglasses";
export const accessoryOutlineSource = (imageSrc: string) => `${imageSrc}#contrast-outline`;

// Repères normalisés sur l'image : les oreilles d'un lapin ne doivent pas être
// prises pour le front. Le catalogue de repères peut s'enrichir sans modifier
// les composants du studio, du portrait ou de la foule.
export type AnimalAccessoryProfile = {
  eyesY: number;
  muzzleY: number;
  glassesScale?: number;
  hat?: { centerY: number; scale: number };
  chin?: { centerY: number; scale: number };
};

const ANIMAL_PROFILES: Readonly<Record<string, AnimalAccessoryProfile>> = {
  chat: { eyesY: .5, muzzleY: .72 },
  chien: { eyesY: .475, muzzleY: .72 },
  capybara: { eyesY: .385, muzzleY: .72 },
  coq: { eyesY: .48, muzzleY: .69 },
  elephant: { eyesY: .46, muzzleY: .7 },
  hippopotame: { eyesY: .36, muzzleY: .78 },
  pigeon: { eyesY: .43, muzzleY: .65 },
  giraffe: { eyesY: .51, muzzleY: .82 },
  leopard: { eyesY: .44, muzzleY: .76 },
  guepard: { eyesY: .445, muzzleY: .765 },
  zebre: { eyesY: .51, muzzleY: .84 },
  serpent: { eyesY: .45, muzzleY: .7 },
  renard: { eyesY: .565, muzzleY: .8, hat: { centerY: .275, scale: 1 } },
  panda: { eyesY: .535, muzzleY: .76 },
  vache: { eyesY: .44, muzzleY: .78 },
  cochon: { eyesY: .48, muzzleY: .78 },
  mouton: { eyesY: .50, muzzleY: .72 },
  chevre: { eyesY: .43, muzzleY: .71 },
  poule: { eyesY: .46, muzzleY: .71 },
  lapin: { eyesY: .61, muzzleY: .80, hat: { centerY: .385, scale: .8 }, chin: { centerY: .90, scale: .7 } },
  koala: { eyesY: 0.51, muzzleY: 0.74 },
  ane: { eyesY: 0.56, muzzleY: 0.82, hat: { centerY: 0.37, scale: 0.75 }, chin: { centerY: 0.91, scale: 0.7 } },
  canard: { eyesY: 0.445, muzzleY: 0.69 },
  oie: { eyesY: 0.435, muzzleY: 0.69 },
  dinde: { eyesY: 0.34, muzzleY: 0.57 },
  tigre: { eyesY: 0.45, muzzleY: 0.73 },
  ours: { eyesY: 0.46, muzzleY: 0.72 },
  loup: { eyesY: 0.51, muzzleY: 0.85, hat: { centerY: 0.265, scale: 0.9 } },
  singe: { eyesY: 0.49, muzzleY: 0.73 },
  ecureuil: { eyesY: 0.53, muzzleY: 0.755, hat: { centerY: 0.28, scale: 1 } },
  herisson: { eyesY: 0.57, muzzleY: 0.77 },
  hibou: { eyesY: 0.485, muzzleY: 0.7 },
  "raton-laveur": { eyesY: 0.51, muzzleY: 0.755 },
  crocodile: { eyesY: 0.4, muzzleY: 0.72 },
  "mouton-merinos": { eyesY: 0.5, muzzleY: 0.72 },
  "mouton-suffolk": { eyesY: 0.485, muzzleY: 0.71 },
  "mouton-nez-noir-valais": { eyesY: 0.5, muzzleY: 0.73 },
  "vache-normande": { eyesY: 0.44, muzzleY: 0.78 },
  "vache-highland": { eyesY: 0.46, muzzleY: 0.78 },
  "vache-charolaise": { eyesY: 0.44, muzzleY: 0.78 },
  "chat-siamois": { eyesY: 0.525, muzzleY: 0.745, hat: { centerY: 0.3, scale: 0.9 } },
  "chat-british-shorthair": { eyesY: 0.495, muzzleY: 0.72 },
  "chat-maine-coon": { eyesY: 0.54, muzzleY: 0.75, hat: { centerY: 0.305, scale: 0.9 } },
  "chat-sphynx": { eyesY: 0.55, muzzleY: 0.76, hat: { centerY: 0.32, scale: 0.85 } },
  "chien-husky": { eyesY: 0.5345, muzzleY: 0.7855, hat: { centerY: 0.3031, scale: 0.8367 } },
  "chien-dalmatien": { eyesY: 0.4754, muzzleY: 0.7362 },
  "chien-berger-allemand": { eyesY: 0.5443, muzzleY: 0.8248, hat: { centerY: 0.3425, scale: 0.8367 } },
  "chien-golden-retriever": { eyesY: 0.4655, muzzleY: 0.7362 },
  "cochon-kunekune": { eyesY: .47, muzzleY: .72 },
  "poney-shetland": { eyesY: .5, muzzleY: .79, hat: { centerY: .23, scale: .9 } },
  lama: { eyesY: .51, muzzleY: .7, hat: { centerY: .29, scale: .75 }, chin: { centerY: .94, scale: .7 } },
  alpaga: { eyesY: .54, muzzleY: .77, hat: { centerY: .26, scale: .8 } },
  "chevre-angora": { eyesY: .45, muzzleY: .66 },
  "chevre-saanen": { eyesY: .42, muzzleY: .66 },
  "lapin-belier": { eyesY: .48, muzzleY: .61, hat: { centerY: .27, scale: .85 }, chin: { centerY: .84, scale: .7 } },
  "lapin-angora": { eyesY: .59, muzzleY: .72, hat: { centerY: .385, scale: .8 }, chin: { centerY: .94, scale: .7 } },
  "poule-soie": { eyesY: .52, muzzleY: .65 },
  "canard-pekin": { eyesY: .46, muzzleY: .68 },
  rhinoceros: { eyesY: .43, muzzleY: .81 },
  lynx: { eyesY: .52, muzzleY: .76, hat: { centerY: .32, scale: .85 } },
  "panda-roux": { eyesY: .525, muzzleY: .775, hat: { centerY: .3, scale: .95 } },
  cerf: { eyesY: .55, muzzleY: .8, hat: { centerY: .37, scale: .8 }, chin: { centerY: .925, scale: .7 } },
  blaireau: { eyesY: .485, muzzleY: .735 },
  castor: { eyesY: .4, muzzleY: .67 },
  "chat-ragdoll": { eyesY: .51, muzzleY: .745, hat: { centerY: .3, scale: .9 } },
  "chat-bengal": { eyesY: .485, muzzleY: .735, hat: { centerY: .29, scale: .9 } },
  "chien-shiba-inu": { eyesY: .52, muzzleY: .77, hat: { centerY: .29, scale: .9 } },
  "chien-berger-australien": { eyesY: .46, muzzleY: .735 },
  dauphin: { eyesY: .45, muzzleY: .7 },
  orque: { eyesY: .435, muzzleY: .665 },
  phoque: { eyesY: .415, muzzleY: .64 },
  morse: { eyesY: .295, muzzleY: .66 },
  "loutre-de-mer": { eyesY: .44, muzzleY: .69 },
  "tortue-marine": { eyesY: .415, muzzleY: .71 },
  "requin-marteau": { eyesY: .39, muzzleY: .66, glassesScale: 1.4, hat: { centerY: .3, scale: .65 }, chin: { centerY: .79, scale: .7 } },
  poulpe: { eyesY: .445, muzzleY: .63 },
  "manchot-empereur": { eyesY: .485, muzzleY: .68 },
  beluga: { eyesY: .5, muzzleY: .72 },
  "ara-bleu": {"eyesY":0.4,"muzzleY":0.72},
  "ara-rouge": {"eyesY":0.39,"muzzleY":0.7},
  "perroquet-gris-du-gabon": {"eyesY":0.4,"muzzleY":0.64},
  "perroquet-amazone": {"eyesY":0.405,"muzzleY":0.65},
  "cacatoes": {"eyesY":0.515,"muzzleY":0.68,"glassesScale":0.85},
  "perruche-ondulee": {"eyesY":0.42,"muzzleY":0.64},
  "toucan": {"eyesY":0.37,"muzzleY":0.74},
  "flamant-rose": {"eyesY":0.37,"muzzleY":0.69,"glassesScale":0.85},
  "pelican": {"eyesY":0.34,"muzzleY":0.75,"glassesScale":0.8},
  "aigle": {"eyesY":0.4,"muzzleY":0.62},
  "macareux": {"eyesY":0.41,"muzzleY":0.7},
  "paon": {"eyesY":0.54,"muzzleY":0.67,"glassesScale":0.85,"hat":{"centerY":0.32,"scale":0.75}},
  "cameleon": {"eyesY":0.48,"muzzleY":0.77,"glassesScale":1.22},
  "iguane": {"eyesY":0.41,"muzzleY":0.67,"glassesScale":1.05},
  "gecko": {"eyesY":0.41,"muzzleY":0.65,"glassesScale":1.1},
  "dragon-barbu": {"eyesY":0.4,"muzzleY":0.65},
  "axolotl": {"eyesY":0.53,"muzzleY":0.73,"glassesScale":1.05},
  "grenouille": {"eyesY":0.33,"muzzleY":0.65,"glassesScale":1.15},
  "lion": {"eyesY":0.46,"muzzleY":0.69},
  "hyene": {"eyesY":0.47,"muzzleY":0.73},
  "suricate": {"eyesY":0.47,"muzzleY":0.71},
  "phacochere": {"eyesY":0.435,"muzzleY":0.83},
  "buffle-africain": {"eyesY":0.46,"muzzleY":0.73},
  "gnou": {"eyesY":0.43,"muzzleY":0.78},
  "gazelle": {"eyesY":0.53,"muzzleY":0.77,"hat":{"centerY":0.34,"scale":0.78},"chin":{"centerY":0.925,"scale":0.7}},
  "oryx": {"eyesY":0.61,"muzzleY":0.84,"hat":{"centerY":0.43,"scale":0.7},"chin":{"centerY":0.94,"scale":0.68}},
  "impala": {"eyesY":0.56,"muzzleY":0.82,"hat":{"centerY":0.38,"scale":0.8},"chin":{"centerY":0.925,"scale":0.7}},
  "serval": {"eyesY":0.56,"muzzleY":0.79,"hat":{"centerY":0.34,"scale":0.8}},
  "sanglier": {"eyesY":0.455,"muzzleY":0.79},
  "elan": {"eyesY":0.53,"muzzleY":0.855,"hat":{"centerY":0.35,"scale":0.78},"chin":{"centerY":0.93,"scale":0.7}},
  "renne": {"eyesY":0.555,"muzzleY":0.8,"hat":{"centerY":0.36,"scale":0.8},"chin":{"centerY":0.93,"scale":0.7}},
  "mouflon": {"eyesY":0.45,"muzzleY":0.72,"hat":{"centerY":0.26,"scale":0.8},"chin":{"centerY":0.875,"scale":0.75}},
  "marmotte": {"eyesY":0.36,"muzzleY":0.65},
  "chauve-souris": {"eyesY":0.65,"muzzleY":0.845,"hat":{"centerY":0.45,"scale":0.72},"chin":{"centerY":0.96,"scale":0.7}},
  "glouton": {"eyesY":0.44,"muzzleY":0.73},
  "bison": {"eyesY":0.445,"muzzleY":0.73},
  "lievre": {"eyesY":0.63,"muzzleY":0.855,"hat":{"centerY":0.43,"scale":0.7},"chin":{"centerY":0.96,"scale":0.4}},
  "chevreuil": {"eyesY":0.55,"muzzleY":0.795,"hat":{"centerY":0.36,"scale":0.8},"chin":{"centerY":0.93,"scale":0.7}},
  "gorille": {"eyesY":0.49,"muzzleY":0.7},
  "orang-outan": {"eyesY":0.465,"muzzleY":0.69},
  "lemurien": {"eyesY":0.54,"muzzleY":0.77,"hat":{"centerY":0.29,"scale":0.9}},
  "paresseux": {"eyesY":0.5,"muzzleY":0.7},
  "tapir": {"eyesY":0.455,"muzzleY":0.89,"chin":{"centerY":0.96,"scale":0.4}},
  "tamanoir": {"eyesY":0.36,"muzzleY":0.91,"glassesScale":0.9,"chin":{"centerY":0.965,"scale":0.35}},
  "pangolin": {"eyesY":0.48,"muzzleY":0.73},
  "okapi": {"eyesY":0.5,"muzzleY":0.82,"hat":{"centerY":0.28,"scale":0.8},"chin":{"centerY":0.95,"scale":0.5}},
  "mandrill": {"eyesY":0.42,"muzzleY":0.72},
  "tarsier": {"eyesY":0.53,"muzzleY":0.73,"hat":{"centerY":0.31,"scale":0.85}},
  "hamster": {"eyesY":0.43,"muzzleY":0.68},
  "cochon-inde": {"eyesY":0.4,"muzzleY":0.67},
  "furet": {"eyesY":0.455,"muzzleY":0.7},
  "chinchilla": {"eyesY":0.52,"muzzleY":0.76,"hat":{"centerY":0.3,"scale":0.9}},
  "gerbille": {"eyesY":0.425,"muzzleY":0.71},
  "cheval-frison": {"eyesY":0.51,"muzzleY":0.87,"hat":{"centerY":0.28,"scale":0.75},"chin":{"centerY":0.965,"scale":0.4}},
  "poisson-ange": {"eyesY":0.455,"muzzleY":0.665},
  "poisson-globe": {"eyesY":0.46,"muzzleY":0.65},
  "hippocampe": {"eyesY":0.44,"muzzleY":0.86,"glassesScale":0.9,"chin":{"centerY":0.96,"scale":0.4}},
  "crabe": {"eyesY":0.33,"muzzleY":0.55},
  "homard": {"eyesY":0.34,"muzzleY":0.72},
  "raie-manta": {"eyesY":0.43,"muzzleY":0.67},
  "ours-polaire": {"eyesY":0.43,"muzzleY":0.69},
  "renard-polaire": {"eyesY":0.55,"muzzleY":0.79,"hat":{"centerY":0.3,"scale":0.9}},
  "panthere-des-neiges": {"eyesY":0.44,"muzzleY":0.75},
  "narval": {"eyesY":0.585,"muzzleY":0.725,"hat":{"centerY":0.32,"scale":0.85}},
};

export function getAccessoryBox(accessory: Accessory, imageSrc: string, fitting?: AnimalAccessoryProfile): Accessory["box"] {
  const animalId = /^\/assets\/images\/characters\/animals\/([a-z-]+)\.png(?:[?#].*)?$/.exec(imageSrc)?.[1];
  const profile = fitting ?? (animalId ? ANIMAL_PROFILES[animalId] : undefined);
  if (!profile) return accessory.box;
  const box = accessory.box;
  let centerY = box.y + box.height / 2;
  let scale = 1;
  switch (accessory.id) {
    case "sunglasses": centerY = profile.eyesY; scale = profile.glassesScale ?? 1; break;
    case "moustache": centerY = profile.muzzleY; break;
    case "clown-nose": centerY = profile.eyesY + (profile.muzzleY - profile.eyesY) * .65; break;
    case "cap":
    case "bucket-hat": {
      // Les visières laissent les yeux visibles, même sur les visages courts.
      scale = profile.hat?.scale ?? Math.min(1, Math.max(.45, (profile.eyesY - .08 - box.y) / box.height));
      centerY = profile.hat?.centerY ?? box.y + box.height * scale / 2;
      break;
    }
    case "bow-tie":
      if (profile.chin) ({ centerY, scale } = profile.chin);
      break;
  }
  const width = box.width * scale;
  const height = box.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: Math.max(0, Math.min(1 - height, centerY - height / 2)),
    width,
    height,
  };
}
