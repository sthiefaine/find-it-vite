# Find It

Un jeu d'observation pour toute la famille : trouve l'animal recherché dans la foule avant la fin du temps imparti. Le jeu propose plusieurs modes :

- Aventure, avec des mondes et des étoiles ;
- Infini ;
- Défi du jour ;
- Duel à deux en salon en ligne ou sur le même écran.

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
(12), puis les **groupes traversants** (18). Des étapes plus calmes alternent avec les combinaisons avancées. Enfant
réduit le nombre d’animaux, leur vitesse et les feuillages ; les feuilles et les
oiseaux ne s’y cumulent jamais.

Les défilements des étapes 4 et 10, puis tous ceux à partir de l’étape 13,
remplissent leurs rangées. Les premières découvertes (3, 7 et 12) restent plus
espacées. Des grilles fixes remplissent aussi le plateau : 88 portraits alignés,
ou 93 en quinconce avec des demi-têtes de leurres sur les côtés. La cible reste
entière dans les grilles fixes. Certains défilements ajoutent deux demi-rangées
aux bords transverses : leurs leurres restent coupés, la cible est dans les rangées
intérieures. Les tas denses retrouvent leur fond de 88 animaux et leurs portraits
superposés aléatoirement. Dans les tas sans feuilles, la cible peut être largement
recouverte : 18–65 % de sa zone centrale visible en Normal, 15–50 % en Expert
(estimation conservatrice par les carrés des sprites). Une ouverture cliquable
reste garantie. Si la cible porte un accessoire, sa zone entière est protégée des
autres portraits, y compris dans les tas les plus denses. Les trois cercles
historiques sont disponibles en debug. Le nom et la description de la scène
ne prennent plus de place au-dessus du plateau.

Après l’étape 40, chaque cycle de seize étapes alterne quatre grilles pleines,
quatre défilements pleins, quatre tas et quatre foules mobiles, dont une ronde,
une dispersion et deux traversées par vagues. Les petites grilles d’introduction ne reviennent
plus. Les tas dépassent 380 portraits (plafond de 340 + 88 en fond), les rondes
avancées dépassent 140. Dès la première ronde Normal, les animaux se dépassent
et changent de couronne à des moments différents. Leurs pistes décentrées se
recoupent, avec des rythmes et des oscillations individuels ; les petites rondes
Enfant gardent trois ellipses simples. À partir du deuxième cycle de reprises
(étape 57), les parades Normal et Expert alternent vagues et marche-arrêt, avec
plus de flux opposés. Les vagues avancées varient aussi leur forme par rangée.
Les vagues traversantes arrivent des deux côtés, avec des groupes asynchrones et des courbes
seedées renouvelées hors écran. La cible suit les mêmes lois que les leurres.
L’Enfant conserve des grilles plus petites, des tas sans fond supplémentaire et
au maximum 60 animaux mobiles.

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
les rondes à 11 et les arrêts à 12. Pour les foules avancées : tas caché à 43,
demi-colonnes à 46, rondes croisées à 47 et groupes traversants à 53. Ces raccourcis
sont réservés au développement.

À chaque niveau, les images sont téléchargées et décodées et leurs textures Pixi
sont préparées avant de libérer le chrono et le plateau. Les bouquets de feuilles
sont dessinés directement depuis l’image décodée, avec leur masque de toucher,
avant la première peinture du navigateur. La première frame Pixi est aussi dessinée
à ce moment : les animaux et les feuilles apparaissent ensemble. Le délai minimal reste
de 3 secondes à chaque avis, avec le portrait, son nom complet et le décompte
3–2–1 dans le cadre Wanted. La grille reste vide pendant cette transition. Le
niveau suivant est préchargé pendant le niveau courant, sans faire avancer la partie. Une erreur ou un délai de 15 secondes
permet de réessayer ou de revenir à l’accueil ; un ancien chargement ne peut pas
débloquer un nouveau niveau. Le Duel attend aussi le décodage de son pool avant
la première manche. Les noms complets se répartissent sur plusieurs lignes dans
l’avis de recherche.

Le catalogue contient 48 têtes animales, toutes au format PNG transparent 512 × 512.
Les 14 anciens portraits ont été redessinés avec imagegen d’après les références
de la série ferme : tête seule de face, textures fines, finition mate et couleurs
naturelles. Les identifiants et chemins des personnages sont conservés pour
préserver l’album et la progression. Leurs PNG sont dans
`public/assets/images/characters/animals/`. La charte commune est conservée dans
`content/sprites/animal-style.prompt.txt`, et chaque prompt de refonte avec sa
provenance dans `content/sprites/<animal>.v2.prompt.txt`. Les nouvelles espèces
conservent leur prompt et leur provenance dans `content/sprites/<animal>.prompt.txt`.
Le sprite de feuilles est dans `public/assets/images/obstacles/foliage.png`.

L’accueil réunit six portraits autour du capybara, avec un mouvement léger
désactivé si les animations sont réduites. Ses boutons, trophées et aperçus de
thèmes utilisent les SVG personnalisés de `src/components/Icons/GameIcon.tsx` ;
les portraits restent les sprites du catalogue.

## Collections, pelages et déguisements

La série **À la ferme** réunit une vache Holstein, un cochon, un mouton,
une chèvre, un lapin, une poule, un coq, un âne, un canard colvert, une oie et une dinde.
Le tigre, l’ours, le loup, le singe capucin, l’écureuil, le hérisson, le hibou,
le raton laveur, le crocodile et le koala complètent les animaux sauvages.
Les variantes comprennent quatre races de chats (Siamois, British Shorthair,
Maine Coon, Sphynx), quatre races de chiens (Husky, Dalmatien, Berger allemand,
Golden Retriever), trois moutons (Mérinos, Suffolk, Nez noir du Valais) et trois
vaches (Normande, Highland, Charolaise). Chaque portrait a un identifiant propre,
une espèce commune aux autres races et ses repères d’accessoires ; les races
proches servent de leurres, sans dupliquer l’animal recherché.
Les catégories servent à parcourir l’atelier et l’album. Après un clic sur **Infini**
ou **Duel** sur l’accueil, une page propose les thèmes sous forme de cartes,
avec **Animaux** sélectionné par défaut. Les biomes Ferme, Forêt, Savane et Océan
permettent de restreindre la collection ; Personnes et Drapeaux sont annoncés
« Bientôt » et restent désactivés.

En Infini, la cible et tous les leurres du thème sont choisis parmi les animaux
débloqués : chat, chien, mouton, vache et cochon dès le
départ, puis chaque portrait trouvé dans l’Aventure ou le défi du jour. Les anciennes
captures sont conservées ; aucun compteur n’est augmenté artificiellement.
Un biome demande au moins trois animaux débloqués. Le Duel utilise tous les
personnages publiés du thème choisi. Un lien vers un thème inconnu ou indisponible
revient au catalogue Animaux autorisé pour le mode ; Rejouer garde le thème choisi.
L’Aventure et le Défi conservent leurs catalogues communs pour découvrir de nouveaux
animaux. L’ancien paramètre `serie` ne permet pas de contourner les déblocages.

Chaque animal possède une espèce, une race/variété facultative, une couleur
principale, jusqu’à trois couleurs dominantes et plusieurs catégories. Le catalogue
et l’album se filtrent par espèce, catégorie ou couleur. Le moteur distingue
la ressemblance des couleurs du risque de confusion. En Normal, les silhouettes
voisines arrivent à partir de 9, les races contrastées à 21, les quasi-sosies
(guépard/léopard, coq/poule, loup/husky…) à 41, avec des quotas progressifs. Enfant
repousse ces seuils à 15/36/71 ; Expert les avance à 5/13/25. Les boss respectent
ces seuils. Un petit pool de races utilise les portraits disponibles les moins
confondables, sans ajouter d’animal verrouillé. Les suggestions de races dans l’atelier sont des
pistes de création : elles ne remplacent pas les portraits à générer et importer.

Cinq accessoires sont disponibles : **casquette, bob, lunettes de soleil,
nœud papillon et fausse moustache**. Ce sont des PNG transparents réutilisables,
composés avec les têtes au moment de l’affichage. L’atelier permet de les essayer
sur chaque animal, en grand et à 45 pixels. Le placement est partagé par l’aperçu,
le portrait recherché et le rendu du jeu.

Les accessoires apparaissent progressivement à partir de l’étape 13 (23 en Enfant),
avec un seul par animal et aucun aux étapes de respiration. Au moins deux leurres
portent aussi l’accessoire recherché. L’objectif reste de retrouver l’unique animal
affiché ; le chrono ne change pas. Pour un aperçu local forcé, ouvrir
`http://127.0.0.1:5174/game?seed=42&level=13&accessory=moustache`.
Le paramètre `accessory` est ignoré en production.

### Plancher de difficulté et variantes de foule

Un plancher (`src/engine/difficultyFloor.ts`) monte avec le niveau, quelle que soit
la densité de la scène : en Normal, pas de grille sous 6×6 après 10, ni sous 7×7
après 20, et grille pleine après 50 ; les tas, essaims, remplissages et rangées
de défilement ont aussi leur minimum. Les vitesses de défilement et des foules
mobiles progressent également, dans les limites de chaque profil. Enfant monte
plus doucement ; en Normal et Expert, les respirations gardent au moins 5×5
au niveau 15 et 7×7 après 20, sans obstacles ni accessoires.

Des variantes de foule se mêlent ensuite aux niveaux classiques
(`src/game/crowdVariants.ts`), toujours avec une seule cible :
**tous pareils** (toute la foule est de l’espèce recherchée) ou **deux espèces**
(elle et un sosie), combinées à trois plans d’accessoires : A, seule la cible
porte l’accessoire de l’avis parmi son espèce (dès 15) ; B, tout le monde est
habillé sauf la cible, et l’avis porte un badge « sans accessoire » (dès 25, sur
les grilles et défilements lisibles, sans portraits coupés ni superpositions) ;
C, tout le monde est habillé et les autres de son espèce portent
d’autres accessoires, parfois ressemblants (dès 35). Les deux espèces arrivent à 20 ;
Enfant décale tout de dix niveaux. Leur fréquence monte avec le niveau et une même
variante ne sort jamais trois fois de suite. Les salons en ligne n’en ont pas.
Aperçu local forcé : `/game?seed=42&level=30&variant=same-bare` (`same|two` ×
`single|bare|mixed`).

Les essaims « dispersion » (`scatter`) arrivent à 20 (30 en Enfant) ; après le
premier cycle de reprises, les traversées deviennent de plus en plus souvent des
rondes ou des dispersions, et les rondes sont plus denses.

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
   Le prompt reprend l’espèce, la variété et la palette choisies. Essayer les cinq
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


## Salons multijoueurs

Le bouton **Duel** propose **En ligne** (chacun son appareil) ou **Côte à côte**
(le duel existant sur un seul écran). L’hôte choisit un thème puis crée un salon
privé de deux joueurs ; son code comporte cinq lettres/chiffres sans caractères
ambigus. Le QR et le lien d’invitation contiennent ce code, jamais le jeton privé
de reconnexion.

Les deux joueurs cherchent sur **la même grille**, avec les mêmes positions et
mouvements. Le premier qui trouve marque un point et fait passer les deux joueurs
au niveau suivant. Chacun commence avec trois vies et un chrono personnel de
60 secondes. Une erreur enlève une vie ; trouver rapporte 5 secondes, sans dépasser
60. Dès que les vies ou le chrono d’un joueur atteignent zéro, la partie se termine
immédiatement et l’autre gagne, quel que soit le score. Si les deux chronos expirent
exactement ensemble, la partie est une égalité. Les temps restants sont conservés
pendant le chargement commun et le décompte 3–2–1 dans le cadre Wanted ; le plateau
reste vide jusqu’au départ synchronisé. Un abandon ou une déconnexion de plus de
20 secondes donne la victoire à l’autre joueur. Le serveur décide des scores,
vies, délais et changements de niveau : aucun score déclaré par le client
n’est accepté. Les grilles, tas, défilements, rondes et accessoires sont présents ;
les feuilles et goélands restent pour l’instant réservés aux parties solo.

Pour développer, garder deux terminaux ouverts :

```sh
pnpm multiplayer:dev
pnpm studio
```

Le serveur écoute par défaut `127.0.0.1:3001`. Vite relaie `/ws` vers lui,
y compris sur le studio à `http://127.0.0.1:5174`. `MULTIPLAYER_PROXY_TARGET`
permet de changer cette cible de développement.

Pour essayer sur deux appareils du même réseau, servir le jeu compilé directement
avec le serveur multijoueur (cela n’expose pas le backoffice du studio) :

```sh
pnpm build
HOST=0.0.0.0 PORT=3001 pnpm multiplayer
```

Ouvrir `http://ADRESSE_RESEAU_DU_MAC:3001` sur les deux appareils. Le lien et le
QR sont construits depuis cette adresse ; un lien `127.0.0.1` ne peut pas inviter
un autre appareil.

Pour une mise en ligne, le serveur Node doit tourner en continu avec HTTPS et
WebSocket (`/ws`). L’image dédiée sert à la fois les fichiers du jeu et les salons :

```sh
docker build -f server/Dockerfile -t find-it-multiplayer .
docker run --rm -p 3001:3001 find-it-multiplayer
```

Le contrôle de santé est `GET /health`. Si le frontend reste sur Vercel ou un
hébergeur statique, construire avec `VITE_MULTIPLAYER_URL=wss://SERVEUR/ws` et
configurer `MULTIPLAYER_ALLOWED_ORIGINS=https://DOMAINE_DU_JEU` sur le serveur
(liste séparée par virgules). Sans cette variable, seule l’origine de même hôte
est acceptée pour les navigateurs. `TRUST_PROXY=1` ne s’active que derrière un
proxy de confiance qui remplace `X-Forwarded-For`. Les salons sont en mémoire :
un redémarrage les termine. Une seule instance est prévue pour cette version.
Le push Git seul ne déploie pas ce nouveau service sur un hébergeur statique.
