# Drapeaux

250 assets : les 249 entrées ISO 3166-1 (pays et territoires), plus le Kosovo
(`XK`, code utilisé conventionnellement). Les sources SVG sont conservées dans
`svg/`, avec une empreinte SHA-256 pour chaque fichier dans `countries.json`.
La provenance et les exceptions sont détaillées dans `provenance.json`, et
les déclarations de droits dans `LICENSE.txt`.

La collection est issue de
[hampusborgos/country-flags](https://github.com/hampusborgos/country-flags/tree/c09927e63705529bbf59ca6684cd9b23225dddad),
au commit `c09927e63705529bbf59ca6684cd9b23225dddad`.
Trois dessins obsolètes ont été remplacés par les SVG Wikimedia Commons
actuels : Afghanistan (blanc avec chahada, ratio 2:1), Kirghizistan (rayons
droits depuis 2023) et Martinique (rouge, vert et noir depuis 2023).
Le dessin syrien amont contient déjà les trois étoiles rouges sur bandes
verte, blanche et noire.

## Génération hors ligne

Depuis la racine du dépôt, avec la dépendance `sharp` déjà installée :

```sh
node scripts/make-flags.mjs
node scripts/make-flags.mjs --check
```

Le script génère les PNG dans `public/assets/images/characters/flags/`,
le catalogue `src/content/publishedFlags.json` et le rapport
`content/flags/visual-duplicates.json`. Aucun téléchargement n'est nécessaire.
`--check` valide les sources, les rendus RGBA, les dimensions, la transparence
des bords, le catalogue et le rapport sans écrire de fichier.

Chaque PNG mesure 512 × 512 px, avec une marge transparente minimale de
32 px. Le côté le plus long du drapeau mesure 448 px ; ses proportions et
son contour restent ceux du SVG. Le Népal conserve ainsi sa forme à deux
fanions et la Suisse et le Vatican leur forme carrée. Les champs blancs
restent opaques. Aucun accessoire, hampe, bordure ou effet n'est ajouté.

Les noms français sont figés dans `countries.json` pour que la génération
ne dépende pas de la version d'ICU du système. Les familles décrivent le
motif visuel ; les couleurs sont extraites des pixels opaques du rendu.

## Doublons et territoires

Tous les assets restent disponibles. Les dessins RGBA strictement identiques
sont regroupés dans `visual-duplicates.json`. Dans le catalogue, `duplicateOf`
référence le représentant souverain lorsqu'il existe. Le jeu peut ainsi
éviter de proposer deux noms pour un même dessin.

`AQ` conserve le dessin conventionnel de la source, sans revendiquer le
statut de drapeau officiel de l'Antarctique. `SH` représente le territoire
groupé Sainte-Hélène, Ascension et Tristan da Cunha avec le drapeau britannique
de la source. `AC` et `TA` ne sont pas des entrées ISO 3166-1 distinctes.
L'Union européenne et les subdivisions britanniques sont exclues.
