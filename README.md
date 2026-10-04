# Find It

Un jeu d'observation pour toute la famille : trouve l'animal recherché dans la foule avant la fin du temps imparti. Le jeu propose plusieurs modes :

- Aventure, avec des mondes et des étoiles ;
- Infini ;
- Défi du jour ;
- Duel à deux sur le même écran.

Les animaux trouvés remplissent un album.

Le jeu principal propose les mondes Animaux et Océan. Les anciens mondes
Dinosaures, Halloween et Espace restent conservés comme thèmes expérimentaux,
hors de la progression et du Grand Mélange. Les anciennes sauvegardes sont préservées.

## Campagne web et obstacles

L'objectif des parties reste **retrouver l'unique animal affiché**. Aventure, Infini
et Défi du jour passent par `generatePlayableLevel`, qui désactive les objectifs
alternatifs. L’Aventure propose **40 étapes nommées** (20 Animaux, 20 Océan), puis
le Grand Mélange. Les décors, mouvements et obstacles de chaque étape sont définis
dans `src/content/scenes.ts`. Les étoiles existantes et les mondes déjà ouverts
sont conservés par la migration de sauvegarde v7.

Les étapes introduisent séparément le défilement, les **feuilles à écarter** (6),
les **vagues** (7), les oiseaux (9), les **rondes** (11) et les **départs/arrêts**
(12). Des étapes plus calmes alternent avec les combinaisons avancées. Enfant
réduit le nombre d’animaux, leur vitesse et les feuillages ; les feuilles et les
oiseaux ne s’y cumulent jamais.

Dans les scènes concernées, des goélands traversent le plateau : un seul, 2–3,
7–8 ou un géant. Délais, sens, positions et tailles varient avec la graine de la
partie. Pas deux formations identiques de suite ; les géants arrivent après au
moins deux autres passages, avec au moins 45 secondes de jeu actif entre eux.
Le chrono et le temps utilisé pour les étoiles continuent de tourner, même lorsque
le géant masque tout le plateau. La foule continue de se déplacer. Les touchers
sur les oiseaux sont ignorés ; les zones transparentes restent jouables hors
masque géant. Les passages attendent pendant les pauses et les transitions,
et respectent « réduire les animations ».

Les feuillages se dégagent par glissement au doigt ou à la souris, ou par
Entrée/Espace une fois leur bouton sélectionné au clavier. Un simple toucher
n’attrape pas l’animal caché derrière. Les feuilles reviennent au niveau suivant.
Les mouvements se figent pendant une vraie pause ou quand l’onglet est masqué,
sans bondir lors du retour. Les scènes n’ajoutent pas de lampe torche.

Pour essayer les quatre variantes sans attendre, lancer `pnpm studio`, puis ouvrir
`http://127.0.0.1:5174/game?seed=42&level=11&birds=1`. Les boutons d'aperçu sont
réservés au serveur de développement. Le sprite transparent se trouve dans
`public/assets/images/obstacles/seagull.png` ; son prompt et sa provenance dans
`content/sprites/seagull.prompt.txt`. Pour tester les feuilles, ouvrir
`http://127.0.0.1:5174/game?seed=42&level=6` ; les vagues sont à l’étape 7,
les rondes à 11 et les arrêts à 12. Ces raccourcis sont réservés au développement.

Le catalogue contient 20 têtes animales, toutes au format PNG transparent 512 × 512.
Les 14 anciens portraits ont été redessinés avec imagegen d’après les références
de la série ferme : tête seule de face, textures fines, finition mate et couleurs
naturelles. Les identifiants et chemins des personnages sont conservés pour
préserver l’album et la progression. Leurs PNG sont dans
`public/assets/images/characters/animals/`. La charte commune est conservée dans
`content/sprites/animal-style.prompt.txt`, et chaque prompt de refonte avec sa
provenance dans `content/sprites/<animal>.v2.prompt.txt`.
Le sprite de feuilles est dans `public/assets/images/obstacles/foliage.png`.

## Collections, pelages et déguisements

La première série **À la ferme** ajoute une vache Holstein, un cochon, un mouton,
une chèvre, un lapin et une poule. Avec le coq existant, sept portraits sont
disponibles dans cette catégorie. Depuis l’accueil, choisir une série puis **Infini**
pour jouer uniquement avec ses animaux (`/game?serie=ferme`). Une catégorie devient
jouable lorsqu’elle contient au moins cinq portraits validés. Le Défi du jour et
l’Aventure conservent leurs catalogues communs.

Chaque animal possède une espèce, une race/variété facultative, une couleur
principale, jusqu’à trois couleurs dominantes et plusieurs catégories. Le catalogue
et l’album se filtrent par espèce, catégorie ou couleur. Le générateur privilégie
les autres races de la même espèce comme sosies ; les familles visuelles et les
couleurs prennent le relais. Les suggestions de races dans l’atelier sont des
pistes de création : elles ne remplacent pas les portraits à générer et importer.

Six accessoires sont disponibles : **casquette, bob, lunettes de soleil, bandana,
nœud papillon et fausse moustache**. Ce sont des PNG transparents réutilisables,
composés avec les têtes au moment de l’affichage. L’atelier permet de les essayer
sur chaque animal, en grand et à 45 pixels. Le placement est partagé par l’aperçu,
le portrait recherché et le rendu du jeu.

Les accessoires apparaissent progressivement à partir de l’étape 13 (23 en Enfant),
avec un seul par animal et aucun aux étapes de respiration. Au moins deux leurres
portent aussi l’accessoire recherché. L’objectif reste de retrouver l’unique animal
affiché ; le chrono ne change pas. Pour un aperçu local forcé, ouvrir
`http://127.0.0.1:5174/game?serie=ferme&seed=42&level=13&accessory=moustache`.
Le paramètre `accessory` est ignoré en production.

Les accessoires sont dans `public/assets/images/accessories/`, leurs rectangles
de placement dans `src/content/accessories.ts`, et leurs prompts avec provenance
dans `content/accessories/prompts/`. Les originaux de génération de cette série
sont conservés localement sous `artifacts/sprite-originals/` ; les PNG optimisés
utilisés par le jeu sont versionnés dans Git.

Stack : React 18, Vite 6, TypeScript, Pixi.js 7 et Zustand. Le jeu est livré en PWA hors ligne et en app native avec Capacitor 7.

## Scripts

| Commande | Rôle |
| --- | --- |
| `pnpm dev` | serveur de développement |
| `pnpm build` | vérification TypeScript, puis build dans `dist/` (avec le service worker) |
| `pnpm preview` | sert le build |
| `pnpm test` | tests unitaires (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm icons` | régénère les icônes depuis le capybara |
| `pnpm cap:sync` | build, puis copie dans les projets natifs |
| `pnpm cap:android` / `pnpm cap:ios` | ouvre Android Studio / Xcode |
| `pnpm android:debug` | construit l’APK de test dans `artifacts/find-it-debug.apk` |
| `pnpm studio` | ouvre l’atelier local des sprites sur `http://127.0.0.1:5174/studio.html` |

Utilisez Node 22 (`nvm use`) et pnpm 10 (`corepack enable`).

## Atelier local des sprites

Lancer `pnpm studio`, puis ouvrir `http://127.0.0.1:5174/studio.html`.
Le backoffice est local : il n’est pas inclus dans le site de production ni dans l’APK.
Il n’utilise pas de compte, de serveur distant ou de clé d’API.

1. Choisir ou créer un thème. Animaux et vie marine alimentent le jeu ; personnes,
   histoire, politique, drapeaux et imaginaire restent des collections « pour le fun ».
2. Ajouter un sprite, renseigner son nom, le sujet du prompt, son espèce et sa
   race/variété, ses couleurs dominantes, ses catégories et sa famille visuelle.
   Le prompt reprend l’espèce, la variété et la palette choisies. Essayer les six
   accessoires dans la boîte à déguisements : cet aperçu ne modifie pas l’image source.
3. Copier le prompt, basé sur la référence de l’hippopotame. Le fond transparent est
   proposé pour les sprites ; décocher cette option pour retrouver le fond blanc.
   La génération se fait dans votre outil d’image habituel, puis le résultat est importé.
   Les prompts des personnes préservent leur coiffure ; ceux des drapeaux leurs symboles.
4. Importer un PNG ou WebP (8 Mo et 4096 × 4096 pixels maximum), comparer sur les fonds
   clair/sombre/damier et dans l’aperçu à 45 pixels. Enregistrer en brouillon ou validé.
5. Cliquer sur **Mettre à jour le jeu**. Seuls les animaux validés sont exportés.
   Les images du jeu doivent être carrées, transparentes, mesurer au moins 128 pixels
   et peser au maximum 5 Mo. Au moins 5 personnages sont requis.
6. Tester dans le navigateur, puis refaire `pnpm android:debug` pour embarquer les images
   dans l’APK. Ce bouton ne déploie rien sur Internet ou sur le Play Store.

Le catalogue est enregistré dans `content/sprites/catalog.json`, les imports originaux
dans `content/sprites/images/`. Ils se sauvegardent avec le projet. Le manifeste consommé
par le jeu est `src/content/publishedAnimals.json`, avec les images publiées dans
`public/assets/images/characters/catalog/`. Les identifiants existants sont conservés
pour garder la collection des joueurs. Les thèmes de l’atelier organisent le catalogue ;
ils ne créent pas automatiquement de nouveaux mondes d’Aventure. Les nouvelles images
animalières rejoignent le pack Animaux. Le monde Océan utilise encore ses emojis existants.

Pour retirer un sprite du prochain build, le repasser en brouillon puis mettre à jour
le jeu. Les fichiers sources sont conservés. Deux onglets ne peuvent pas écraser
silencieusement leurs modifications : une révision périmée demande de recharger.

## Structure

- `src/engine` : génération des niveaux. Elle est pure et déterministe (graine) : règles, courbe de difficulté, validation.
- `src/content` : les mondes de l'Aventure et le calcul de la progression (étoiles, déblocages).
- `src/save` : la sauvegarde versionnée (schéma, migrations, store Zustand) et l'interface `StorageAdapter`.
- `src/game` : les modes de jeu et la résolution d'un toucher pendant une partie.
- `src/platform` : ce qui dépend de l'appareil (haptique, stockage natif, bouton retour Android, barre d'état). Ces modules ne font rien sur le web.
- `src/pages`, `src/components` : l'interface (accueil, carte, partie, album, options, duel).
- `public/assets` : les images et les sons. `public/icons` : les icônes PWA.

## Déploiement web (Docker / Coolify)

Le `Dockerfile` construit le jeu avec pnpm (lockfile figé), puis le sert avec nginx (`nginx.conf`) :

- les routes de la SPA renvoient vers `index.html` ;
- les fichiers hashés sont en cache pendant 1 an ;
- `index.html`, `sw.js` et le manifeste ne sont jamais mis en cache longtemps ;
- un fichier manquant sous `/assets/` renvoie une vraie 404.

Dans Coolify, choisissez le build pack *Dockerfile* et le port 80.

```bash
docker build -t find-it . && docker run -p 8080:80 find-it
```

## Mobile

Pour la PWA, Android, iOS et la check-list des stores, voir [MOBILE.md](MOBILE.md).
