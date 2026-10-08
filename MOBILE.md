# Find It sur mobile

Le jeu est publié de trois façons à partir du même code :

- **PWA** : le site s'installe depuis le navigateur et marche hors ligne.
- **Android** et **iOS** : l'app native est une coque Capacitor 7 qui embarque `dist/`.

## 1. Tester la PWA

```bash
pnpm build
npx vite preview --host --port 4173
```

- Ouvrez l'URL sur un téléphone, ou passez par un tunnel HTTPS : le service worker exige HTTPS, sauf sur `localhost`.
- Dans Chrome DevTools, onglet *Application* : le manifeste doit s'afficher sans erreur et le service worker doit être *activated*.
- Pour tester le hors-ligne : chargez la page une fois, cochez *Offline*, puis rechargez.
- Pour installer la PWA : sur Android, menu Chrome puis « Installer l'application ». Sur iOS, Safari, puis Partager, puis « Sur l'écran d'accueil ».
- Chaque compilation produit une version unique, visible dans **Options → Version du jeu**.
- Les mises à jour sont recherchées au démarrage, au retour dans l'application, au retour du réseau et toutes les cinq minutes lorsque le jeu est visible. Le bouton **Rechercher une mise à jour** permet de vérifier immédiatement.
- La PWA télécharge les fichiers modifiés, puis recharge automatiquement depuis un menu (accueil, options, album, aventure ou choix de partie). Une partie ou un salon en cours attend le retour à un menu. Les écritures de sauvegarde sont terminées avant le rechargement.
- `version.json` est lu directement sur le réseau, sans cache. Hors ligne, le jeu continue d'utiliser sa version installée.
- Si le téléchargement reste bloqué, **Actualiser maintenant** vérifie l'accès réseau puis réenregistre la PWA. Ce bouton conserve le cache du jeu et la progression ; il n'est disponible que dans les Options.

Les icônes sont générées par `pnpm icons` (`scripts/make-icons.mjs`) :

- `public/icons/` contient les icônes web ;
- `resources/` contient les sources natives.

Pour mettre à jour les icônes et le splash natifs :

```bash
npx @capacitor/assets generate --android --ios
```

## 2. Avant la première publication : l'appId

Dans `capacitor.config.ts`, remplacez `com.findit.game` par votre domaine inversé, par exemple `fr.mondomaine.findit`. Le stockage local de l'app est lié à cet identifiant, et **il ne pourra plus changer** une fois l'app publiée. Ensuite :

- **Android** : dans `android/app/build.gradle`, changez `namespace` et `applicationId`. Déplacez `MainActivity.java` dans le dossier qui correspond au nouveau package, et changez `package_name` et `custom_url_scheme` dans `res/values/strings.xml`.
- **iOS** : dans Xcode, changez *Bundle Identifier* (cible App, onglet *Signing & Capabilities*).
- Lancez `pnpm cap:sync`.

## 3. Android (Google Play)

### Construire une version de test

```bash
nvm use
corepack pnpm android:debug
```

Le script construit le web, synchronise Capacitor puis produit
`artifacts/find-it-debug.apk`. Sur macOS, il utilise le JDK 21 intégré à Android Studio
si le Java courant est trop ancien, sans modifier la configuration du terminal.
Il utilise le SDK dans `~/Library/Android/sdk` lorsque `ANDROID_HOME` n’est pas défini.
Sur les autres systèmes, définir `JAVA_HOME` (JDK 21) et `ANDROID_HOME`.

Brancher un téléphone Android autorisé pour le débogage USB, puis :

```bash
adb install -r artifacts/find-it-debug.apk
```

Cette APK est signée avec la clé de développement. Elle sert aux tests et ne remplace
pas l’App Bundle de production signé pour Google Play. L’atelier local des sprites
(`pnpm studio`) ne fait pas partie de l’application. Toute modification du catalogue
publié nécessite une nouvelle compilation pour apparaître sur le téléphone.

### Préparer la publication

1. Installez Android Studio (avec le JDK 21 fourni) et le SDK Android 35.
2. Lancez `pnpm cap:sync`, qui fait le build web puis la copie dans `android/`.
3. Lancez `pnpm cap:android` pour ouvrir le projet dans Android Studio. Testez sur un émulateur ou un téléphone en USB.
4. Changez la version dans `android/app/build.gradle`. `versionCode` doit augmenter à chaque envoi ; `versionName` est la version affichée, par exemple `1.0.0`.
5. Pour signer : *Build › Generate Signed App Bundle*, puis créez une clé `.jks`. Gardez-la, avec son mot de passe, **hors du dépôt** et sauvegardée. Activez aussi *Play App Signing*.
6. Dans la Play Console (compte développeur, 25 $ une fois) : créez l'app, puis envoyez le `.aab` en **test fermé**. Google exige au moins 12 testeurs pendant 14 jours pour un nouveau compte personnel. Ensuite, passez en production.

Vous pouvez aussi construire en ligne de commande : `cd android && ./gradlew bundleRelease`.

## 4. iOS (App Store)

Il faut un Mac avec Xcode 16 ou plus récent et un compte Apple Developer (99 $ par an).

1. Le dossier `ios/` est déjà généré. Il utilise Swift Package Manager, donc CocoaPods n'est pas nécessaire. S'il manque, lancez `npx cap add ios --packagemanager SPM`.
2. Lancez `pnpm install`, puis `pnpm cap:sync`, puis `pnpm cap:ios` pour ouvrir Xcode.
3. Dans *Signing & Capabilities*, choisissez votre équipe et le Bundle Identifier. Testez sur un simulateur, puis sur un iPhone.
4. Faites *Product › Archive*, puis *Distribute App* et *App Store Connect*.
5. Dans App Store Connect, testez d'abord avec **TestFlight** (testeurs internes, puis externes après une revue rapide). Soumettez ensuite à la revue.

Le portrait est verrouillé : `screenOrientation` dans `AndroidManifest.xml` sur Android, `Info.plist` sur iOS.

## 5. Check-list stores (public enfants)

- [ ] **Catégorie** :
  - Google Play : *Jeux › Famille / Éducatif*, et inscription au programme *Familles* (public cible : moins de 13 ans) ;
  - App Store : *Jeux › Famille*, et *Kids Category* avec une tranche d'âge (5 ans et moins, 6-8 ans ou 9-11 ans).
- [ ] **Ni publicité, ni tracking, ni analytics** : rien de tout cela n'est dans le code ; ne pas en ajouter. Le jeu ne fait aucun appel réseau, et la sauvegarde reste sur l'appareil (Preferences en natif).
- [ ] **Politique de confidentialité** : une URL publique est obligatoire sur les deux stores, même si aucune donnée n'est collectée. Elle peut être une simple page du site.
- [ ] **Google Play** : remplir la *Sécurité des données* (« aucune donnée collectée ni partagée ») et le questionnaire *Public cible et contenu*.
- [ ] **Apple** : déclarer *Data Not Collected* dans *App Privacy*. Pour la Kids Category, aucun lien sortant ni achat sans contrôle parental.
- [ ] **Classification d'âge** : questionnaire IARC sur Google Play (PEGI 3 attendu) ; questionnaire Apple (4+ attendu).
- [ ] **Fiche** : icône 512 px (Play) et 1024 px (Apple, voir `resources/icon-only.png`), captures d'écran de téléphone, descriptions en français.
