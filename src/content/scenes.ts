import type { Layout, LayoutParams, LevelScene } from "../engine/types";

// Chaque étape conserve cinq portraits à retrouver. Seuls la foule, son
// déplacement et le décor changent ; les introductions n'empilent pas d'obstacles.
export type SceneDefinition = LevelScene & {
  layout: Layout;
  density: number;
  movement?: LayoutParams["movement"];
  direction?: LayoutParams["scrollDirection"];
  alternate?: boolean;
  breather?: boolean;
};

const PALETTES = {
  meadow: { background: "linear-gradient(155deg, #ecf6c5 0%, #b9d997 100%)", accent: "#527b35" },
  forest: { background: "linear-gradient(155deg, #cee8bd 0%, #81b392 100%)", accent: "#386d4c" },
  sunset: { background: "linear-gradient(155deg, #ffe0ad 0%, #edb585 100%)", accent: "#a26538" },
  lagoon: { background: "linear-gradient(155deg, #d3f4ed 0%, #8bcbd2 100%)", accent: "#267885" },
  reef: { background: "linear-gradient(155deg, #b8e9f2 0%, #8aaed6 100%)", accent: "#426c9e" },
  sand: { background: "linear-gradient(155deg, #fff0c9 0%, #b8ded2 100%)", accent: "#6c8977" },
} as const;

type SceneInput = Omit<SceneDefinition, "background" | "accent" | "seagulls"> & {
  palette: keyof typeof PALETTES;
  seagulls?: boolean;
};
const scene = ({ palette, seagulls = false, ...definition }: SceneInput): SceneDefinition => ({
  ...PALETTES[palette], ...definition, seagulls,
});

export const SCENES: readonly SceneDefinition[] = [
  scene({ id: "clairiere", name: "La clairière", hint: "Retrouve l’animal du portrait.", palette: "meadow", layout: "grid", density: .05 }),
  scene({ id: "petit-sentier", name: "Petit sentier", hint: "Observe chaque visage.", palette: "meadow", layout: "grid", density: .18 }),
  scene({ id: "parade", name: "La parade", hint: "Suis les animaux qui défilent.", palette: "sunset", layout: "scroll", movement: "linear", direction: "horizontal", density: .12 }),
  scene({ id: "croisements", name: "Croisements", hint: "Les rangées partent en sens inverse.", palette: "meadow", layout: "scroll", movement: "linear", direction: "horizontal", alternate: true, density: .2 }),
  scene({ id: "au-calme", name: "Au calme", hint: "Une petite pause pour observer.", palette: "sunset", layout: "grid", density: .1, breather: true }),
  scene({ id: "sous-les-feuilles", name: "Sous les feuilles", hint: "Écarte les feuilles pour regarder.", palette: "forest", layout: "grid", density: .2, foliage: "light" }),
  scene({ id: "sentier-ondule", name: "Sentier ondulé", hint: "Suis la foule qui ondule.", palette: "meadow", layout: "scroll", movement: "wave", direction: "horizontal", density: .24 }),
  scene({ id: "buissons", name: "Les buissons", hint: "Écarte les feuilles et scrute la foule.", palette: "forest", layout: "pile", density: .26, foliage: "light" }),
  scene({ id: "premier-vol", name: "Premier vol", hint: "Garde le cap quand les oiseaux passent.", palette: "sunset", layout: "grid", density: .28, seagulls: true }),
  scene({ id: "grande-parade", name: "Grande parade", hint: "Retrouve ton animal entre les passages.", palette: "sunset", layout: "scroll", movement: "linear", direction: "horizontal", density: .38, seagulls: true }),
  scene({ id: "ronde", name: "La ronde", hint: "Suis les animaux qui tournent.", palette: "meadow", layout: "swarm", movement: "orbit", density: .2 }),
  scene({ id: "petits-arrets", name: "Petits arrêts", hint: "Profite des arrêts pour observer.", palette: "forest", layout: "scroll", movement: "stopGo", direction: "vertical", density: .3 }),
  scene({ id: "brise-legere", name: "Brise légère", hint: "Les rangées ondulent en sens inverse.", palette: "meadow", layout: "scroll", movement: "wave", direction: "horizontal", alternate: true, density: .36 }),
  scene({ id: "canopee", name: "La canopée", hint: "Ouvre un passage dans les feuilles.", palette: "forest", layout: "pile", density: .42, foliage: "dense" }),
  scene({ id: "sieste", name: "La sieste", hint: "Prends le temps de bien regarder.", palette: "sunset", layout: "grid", density: .16, breather: true }),
  scene({ id: "ronde-feuillue", name: "Ronde feuillue", hint: "Écarte les feuilles puis suis la ronde.", palette: "forest", layout: "swarm", movement: "orbit", density: .34, foliage: "light" }),
  scene({ id: "vol-en-bande", name: "Vol en bande", hint: "Repère ton animal pendant les arrêts.", palette: "sunset", layout: "scroll", movement: "stopGo", direction: "horizontal", density: .4, seagulls: true }),
  scene({ id: "course-herbe", name: "Dans l’herbe", hint: "Suis les animaux qui se croisent.", palette: "meadow", layout: "swarm", movement: "linear", density: .46 }),
  scene({ id: "foret-animee", name: "Forêt animée", hint: "Dégage les feuilles et garde ton animal en vue.", palette: "forest", layout: "scroll", movement: "wave", direction: "horizontal", density: .32, foliage: "light", seagulls: true }),
  scene({ id: "grand-rendez-vous", name: "Le rendez-vous", hint: "Suis la ronde malgré les oiseaux.", palette: "sunset", layout: "swarm", movement: "orbit", density: .5, seagulls: true }),
  scene({ id: "lagon-bleu", name: "Lagon bleu", hint: "Découvre les visages du lagon.", palette: "lagoon", layout: "grid", density: .24 }),
  scene({ id: "courant", name: "Le courant", hint: "Suis les animaux emportés par le courant.", palette: "reef", layout: "scroll", movement: "linear", direction: "vertical", density: .34 }),
  scene({ id: "vague-douce", name: "Vague douce", hint: "Suis le mouvement des vagues.", palette: "lagoon", layout: "scroll", movement: "wave", direction: "horizontal", density: .38 }),
  scene({ id: "jardin-marin", name: "Jardin marin", hint: "Écarte les feuilles pour explorer le lagon.", palette: "lagoon", layout: "grid", density: .4, foliage: "light" }),
  scene({ id: "banc-sable", name: "Banc de sable", hint: "Un coin tranquille pour observer.", palette: "sand", layout: "grid", density: .18, breather: true }),
  scene({ id: "maree-tranquille", name: "La marée", hint: "Observe quand le courant s’arrête.", palette: "reef", layout: "scroll", movement: "stopGo", direction: "vertical", density: .36 }),
  scene({ id: "danse-recif", name: "Danse du récif", hint: "Suis la ronde du récif.", palette: "reef", layout: "swarm", movement: "orbit", density: .4 }),
  scene({ id: "sous-palmes", name: "Sous les palmes", hint: "Écarte les feuilles pour fouiller la foule.", palette: "sand", layout: "pile", density: .46, foliage: "dense" }),
  scene({ id: "vol-large", name: "Le vol du large", hint: "Garde ton animal en vue entre les oiseaux.", palette: "lagoon", layout: "scroll", movement: "wave", direction: "horizontal", density: .44, seagulls: true }),
  scene({ id: "traversee", name: "La traversée", hint: "Suis la foule malgré les passages.", palette: "reef", layout: "swarm", movement: "linear", density: .54, seagulls: true }),
  scene({ id: "courants-croises", name: "Courants croisés", hint: "Deux courants vont en sens inverse.", palette: "lagoon", layout: "scroll", movement: "linear", direction: "vertical", alternate: true, density: .46 }),
  scene({ id: "baie-oiseaux", name: "Baie des oiseaux", hint: "Retrouve ton animal entre deux vols.", palette: "sand", layout: "grid", density: .52, seagulls: true }),
  scene({ id: "recif-tournant", name: "Récif tournant", hint: "Dégage les feuilles et suis la ronde.", palette: "reef", layout: "swarm", movement: "orbit", density: .5, foliage: "light" }),
  scene({ id: "ressac", name: "Le ressac", hint: "Suis les vagues qui remontent.", palette: "lagoon", layout: "scroll", movement: "wave", direction: "vertical", alternate: true, density: .54 }),
  scene({ id: "crique-secrete", name: "Crique secrète", hint: "Une dernière escale au calme.", palette: "sand", layout: "grid", density: .22, breather: true }),
  scene({ id: "banc-pause", name: "Banc en pause", hint: "Profite des arrêts de la foule.", palette: "reef", layout: "swarm", movement: "stopGo", density: .5 }),
  scene({ id: "tempete-plumes", name: "Plumes au vent", hint: "Suis les vagues entre les vols.", palette: "lagoon", layout: "scroll", movement: "wave", direction: "horizontal", alternate: true, density: .54, seagulls: true }),
  scene({ id: "mangrove", name: "La mangrove", hint: "Écarte les feuilles et regarde attentivement.", palette: "forest", layout: "pile", density: .6, foliage: "dense" }),
  scene({ id: "cote-sauvage", name: "Côte sauvage", hint: "Dégage ton regard, puis profite des arrêts.", palette: "sand", layout: "scroll", movement: "stopGo", direction: "vertical", density: .46, foliage: "light", seagulls: true }),
  scene({ id: "fete-lagon", name: "Fête du lagon", hint: "Suis ton animal au milieu de la fête.", palette: "lagoon", layout: "swarm", movement: "orbit", density: .54, foliage: "light", seagulls: true }),
];

// Après la campagne, un pas de 7 parcourt les 30 scènes avancées sans répéter
// l'ordre de l'Aventure. L'index suffit : même programme pour tous au Défi du jour.
export function sceneForIndex(index: number): SceneDefinition {
  if (!Number.isInteger(index) || index < 1) throw new Error(`Scène : index invalide ${index}`);
  if (index <= SCENES.length) return SCENES[index - 1];
  return SCENES[10 + ((index - SCENES.length - 1) * 7) % 30];
}
