# Find It

Un jeu d'observation pour toute la famille : trouve l'animal recherché dans la foule avant la fin du temps imparti. Le jeu propose plusieurs modes :

- Aventure, avec des mondes et des étoiles ;
- Infini ;
- Défi du jour ;
- Duel à deux sur le même écran.

Les animaux trouvés remplissent un album.

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
