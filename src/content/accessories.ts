export type AccessoryId = "cap" | "bucket-hat" | "sunglasses" | "bow-tie" | "moustache";

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
];

// Accessoires faciles à confondre à 45 px : deux couvre-chefs, deux barres
// horizontales sur le visage, deux formes sous le museau.
export const ACCESSORY_LOOKALIKES: Readonly<Record<AccessoryId, readonly AccessoryId[]>> = {
  cap: ["bucket-hat"],
  "bucket-hat": ["cap"],
  sunglasses: ["moustache"],
  moustache: ["sunglasses", "bow-tie"],
  "bow-tie": ["moustache"],
};

const BY_ID = new Map(ACCESSORIES.map((accessory) => [accessory.id, accessory]));
export const getAccessory = (id: AccessoryId | null | undefined): Accessory | undefined => id ? BY_ID.get(id) : undefined;
export const isAccessoryId = (id: string): id is AccessoryId => BY_ID.has(id as AccessoryId);

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
