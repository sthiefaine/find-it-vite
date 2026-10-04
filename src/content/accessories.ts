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

const BY_ID = new Map(ACCESSORIES.map((accessory) => [accessory.id, accessory]));
export const getAccessory = (id: AccessoryId | null | undefined): Accessory | undefined => id ? BY_ID.get(id) : undefined;
export const isAccessoryId = (id: string): id is AccessoryId => BY_ID.has(id as AccessoryId);

// Repères normalisés sur l'image : les oreilles d'un lapin ne doivent pas être
// prises pour le front. Le catalogue de repères peut s'enrichir sans modifier
// les composants du studio, du portrait ou de la foule.
export type AnimalAccessoryProfile = {
  eyesY: number;
  muzzleY: number;
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
};

export function getAccessoryBox(accessory: Accessory, imageSrc: string, fitting?: AnimalAccessoryProfile): Accessory["box"] {
  const animalId = /^\/assets\/images\/characters\/animals\/([a-z-]+)\.png(?:[?#].*)?$/.exec(imageSrc)?.[1];
  const profile = fitting ?? (animalId ? ANIMAL_PROFILES[animalId] : undefined);
  if (!profile) return accessory.box;
  const box = accessory.box;
  let centerY = box.y + box.height / 2;
  let scale = 1;
  switch (accessory.id) {
    case "sunglasses": centerY = profile.eyesY; break;
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
