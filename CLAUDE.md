# Repères pour l'assistant

Prototype de l'**application unique** du Musée des Transmissions : mode visiteur
plein écran **et** mode administration, dans un seul programme Electron.

**L'utilisateur n'est pas développeur.** Expliquer chaque changement en clair,
une commande par bloc de code, un fichier à la fois. Éviter le jargon.

Autres documents : `DECISIONS.md` (décisions structurantes, avec leur raison —
**à lire en cas de doute sur un « pourquoi »**), `CONTEXTE.md` (historique,
partiellement daté), `CONCEPTION.md` (architecture client/serveur **abandonnée**,
ne pas s'y fier sans vérifier).

## Commandes

- `npm run appli` — construit l'interface et ouvre la fenêtre (`vite build && electron .`).
- `npm run construire` — construit seulement (vérifier que ça compile).
- `npm run verifier` — vérifie les types TypeScript. **Toujours lancer avant de conclure.**
- `npm run tester` — `node:test` sur `packages/contenu`. Aucune dépendance : le
  crochet `scripts/ts.mjs` fait résoudre les imports « ./x.js » vers « x.ts ».
- `npm install` à la racine — installe tout (monorepo npm workspaces).
- `npm run reparer-electron` — retélécharge le binaire Electron.

## Où en est le projet

**Fonctionne** : la borne (sommaire d'accueil, pages, défilement, plein écran
F11/Échap), l'accès admin caché, l'éditeur complet (textes, images, vidéos,
galeries, quiz, frises), l'import de médias depuis l'ordinateur (avec **image de
couverture** pour les vidéos), les couleurs réglables, le glisser-déposer des
blocs — **complet** depuis le 2026-08-05, menu d'ajout compris. Depuis le
2026-08-12 : le **mode borne verrouillé**, l'**export / import d'une page** par
clé USB (voir `DECISIONS.md`), le **retour automatique à l'accueil** et les
**sauvegardes** de `contenu.json`.

**Deux façons de fermer la borne**, arrivées par deux chemins et conservées
toutes les deux : **Ctrl + Maj + A** depuis l'écran d'administration (elle
enregistre d'abord, c'est celle à donner au musée) et **Ctrl + Alt + Maj + Q**
n'importe où, y compris devant un visiteur — la sortie de maintenance, à garder
pour vous. Les deux passent par `sortieAutorisee` dans `principal.cjs`.

**Reste à faire, par ordre d'importance.** Le détail chiffré est dans
**`A-FAIRE.md`** (liste de travail, estimations en demi-journées) — le résumé
ci-dessous en donne l'essentiel. L'étiquette indique la taille : une tâche
**longue** demande des essais, des échecs et des reprises — ne pas la commencer
si le budget de la session est court, on s'arrêterait au milieu.

1. **Empaquetage `.exe`** (electron-builder), démarrage automatique, plein écran
   par défaut. **Seule grande étape restante** — c'est ce qui rend l'installation
   tenable dans un musée où personne ne dépannera.
2. **Sauvegarde du contenu** : copie datée sur clé USB ou dossier réseau, contre
   la panne de disque ou la fausse manœuvre. **À cadrer avec le musée avant de
   coder** — où va la copie, à quelle fréquence, qui la déclenche (bouton dans
   l'admin ou automatique).
3. **Redimensionner les images à l'import** (canvas) — **en attente exprès** :
   à ne lancer que si le poids des photos devient gênant pour de vrai.

**Sans objet** : l'ancienne « étape 3 — dossier partagé ». Il n'y a **qu'un seul
ordinateur**, voir ci-dessous.

## Matériel — confirmé, ne pas se tromper là-dessus

- **Un seul ordinateur**, en salle d'exposition. Il fait tout : affichage
  visiteur **et** préparation du contenu.
- L'**écran tactile n'est pas un appareil autonome** : simple moniteur, HDMI pour
  l'image, USB pour le toucher. Ni stockage ni système.
- **1920 × 1080 paysage, confirmé.**
- Il n'y a donc **rien à synchroniser** entre deux postes.

## Contraintes à toujours garder en tête

- **Écran tactile.** Grandes cibles, pas de survol requis, pas de commande native
  minuscule. Exemple : le lecteur vidéo est **toute la vidéo** (toucher = lire /
  pause), et la frise se joue en **touchant** un élément puis sa case — pas en
  glissant. Le glissement n'est jamais le seul moyen : les flèches ▲▼ et le
  bouton de largeur doublent toujours le geste.
- **Personne ne dépannera l'installation.** Pas de service, pas de base de
  données. Le stockage est un `contenu.json` + un dossier `medias/`.
- **Pas de module natif** (`sharp` et compagnie). Dimensions, durées et
  redimensionnement passent par le navigateur (canvas, `<img>`, `<video>`).
- **Zod avant d'écrire.** Tout nouveau champ du contenu doit être **facultatif**
  (ou avoir une valeur par défaut) pour ne pas invalider l'existant, **et être
  déclaré dans le schéma** — sinon il est effacé silencieusement à
  l'enregistrement. Piège déjà rencontré plusieurs fois.

## Structure du code

- **`apps/appli/`** — l'application. C'est ici que se fait le travail.
  - `electron/principal.cjs` — processus principal : fenêtre, protocole
    `media://`, lecture **et écriture** du `contenu.json`, import de médias
    (`dialog.showOpenDialog` + copie), transport d'une page.
    - **Écriture atomique** : `.tmp`, `fsync`, puis renommage. Le `fsync` n'est
      pas décoratif — sans lui, une coupure de courant peut laisser un fichier
      vide, le renommage ayant été enregistré avant les octets.
    - **Sauvegardes** : copie dans `sauvegardes/` avant chaque écriture, au plus
      une par heure (le nom porte l'heure), 48 gardées. Au démarrage, un
      `contenu.json` illisible est **renommé** `.abime-<date>` et la sauvegarde
      la plus récente reprend sa place. Rien n'est jamais effacé.
  - `electron/passerelle.cjs` — `contextBridge` : **la seule** surface exposée à
    l'interface (`window.borne`). Ajouter une capacité = ajouter une ligne ici,
    **et** son type dans `src/passerelle.d.ts`. Huit à ce jour : lire et écrire
    le contenu, importer des médias, enregistrer une image fabriquée
    (couverture), les trois du transport de page (déposer un export, relire un
    export, copier ses médias), et fermer l'application.
  - `src/App.tsx` — bascule visiteur / admin.
  - `src/Visiteur.tsx` — borne : **sommaire d'accueil** (`.hub`) puis les pages.
    Une page ouverte se referme sur l'accueil après `minutesAvantVeille` sans
    contact — sauf pendant la lecture d'une vidéo, où le retour est repoussé.
  - `src/AccesAdmin.tsx` — accès caché (coin, appui 5 s, code PIN).
  - `src/Admin.tsx` — liste des pages, panneau « Apparence », enregistrement auto.
  - `src/EditeurPage.tsx` — **le gros fichier** : aperçu fidèle à gauche,
    panneau des blocs à droite, glisser-déposer, formulaires. Cliquer un bloc
    déplie **sous lui** son panneau (`PanneauBloc`) : contenu puis
    personnalisation. Rien en bas de la colonne.
  - `src/ChampTexteRiche.tsx` — saisie du texte mis en forme (gras, italique,
    souligné, listes) sans jamais stocker de HTML.
  - `src/RoueCouleur.tsx`, `src/couleurs.ts` — disque de couleur et conversions.
  - `src/contenu.ts` — chargement / enregistrement / import de médias.
- **`packages/contenu/`** — cœur du produit, partagé.
  - `src/types.ts` — types du contenu (`ContenuPage`, `BlocLibre`…) et constantes.
  - `src/manifeste.ts` — schémas Zod (validation à la lecture **et** à l'écriture).
  - `src/lecture.ts` — lecture typée : `lireTexte`, `lireSuite`, **`ordreCellules`**,
    `colonnesDe`…
  - `src/controles.ts` — contrôles affichés dans l'éditeur, messages en français.
  - `src/transfert.ts` — export / import d'une page (clé USB). **Ne touche pas au
    disque** : prépare et fusionne des données, la copie des fichiers est faite
    par `principal.cjs`. C'est ce qui le rend testable — `transfert.test.ts`.
  - `src/modeles/` — les 3 modèles (`t1`, `t2`, `t3`) et leurs emplacements.
  - `src/rendu/` — `RenduPage`, `Modeles.tsx` (dont `RenduGrille`),
    `ateliers.tsx` (**quiz et frise**), `blocs.tsx`, `ToileBorne`, `modeles.css`.
    **Le même rendu sert la borne et l'aperçu de l'admin** : l'aperçu est fidèle
    par construction — ne jamais dupliquer le rendu côté admin.
- **`contenu-exemple/`** — jeu de test lu/écrit par défaut (`BORNE_CONTENU` pour
  en pointer un autre).
- **`packages/ui/`** — composants génériques, peu utilisés.
- `apps/api`, `apps/admin`, `apps/borne` — **réservoir** de code de l'ancienne
  architecture. Ne tournent plus, ne sont plus installés, mais restent une
  source à piller (écrans, composants).

## Concepts clés

- **Modèle** (`t1`, `t2`, `t3`) = le **point de départ** d'une page : quels
  emplacements elle propose et leur largeur initiale. Ce n'est plus une mise en
  page figée.
- **Emplacement** = un bloc venu du modèle (`titre`, `image`, `texte`…).
  **Bloc ajouté** (`suite`) = un bloc libre ajouté à la page.
- **Texte enrichi** (`ValeurTexte`) = un texte se range sous deux angles :
  `valeur`, le texte **sans** mise en forme (c'est lui qu'on compte, qu'on
  contrôle, et qui dit si le bloc est vide), et `lignes`, la mise en forme.
  `lignes` est **facultatif** : absent, la mise en forme est relue de l'ancienne
  écriture (`**gras**`, `_italique_`, « - » en tête) rangée dans `valeur`. Outils
  dans `packages/contenu/src/texte.ts`. **Jamais de HTML stocké** : la saisie
  (`src/ChampTexteRiche.tsx`) relit le champ nœud par nœud, un collage arrive en
  texte brut.
- **Barre d'apparence** (`BarreMiseEnForme`) = posée **en tête du panneau du
  bloc**, avant le formulaire. **Tout** bloc sélectionné se règle donc, même
  sans champ texte (galerie, quiz, frise, photo pas encore choisie). Elle était
  auparavant confiée au champ texte (`ChampMisEnForme`) : ce n'est plus le cas.
  Piège toujours valable : ne **jamais** envelopper la barre dans un `<label>` —
  le libellé désignerait un de ses boutons, et cliquer dessus écrirait un
  alignement sur le disque (constaté).
- **Habillage** (`StyleBloc`) = l'apparence propre à **un bloc** : fond,
  **transparence du fond** (`opacite`, 0–100, absente = opaque ; elle ne touche
  que le fond — le texte posé dessus reste net, et sans fond elle ne fait rien)
  et mise en forme de son texte. Rangé dans `contenu.styles`, par nom de bloc — même
  clé que partout ailleurs (`titre`, `suite:<id>`). Appliqué par `Habillage`
  dans `rendu/Modeles.tsx`, par où passent tous les blocs. Un bloc sans
  habillage n'est pas enveloppé du tout, et un habillage remis à zéro est retiré
  du fichier (`estStyleVide`, `sansStylesVides`) — il part aussi avec son bloc
  quand on le retire.
- **`ordre`** = **la** liste des cellules d'une page, de haut en bas,
  emplacements du modèle et blocs ajoutés **mélangés** (`titre`, `suite:<id>`…).
  Elle décide de l'**ordre** et de la **présence** : un emplacement absent de la
  liste a été *retiré de la page* (sa valeur est conservée, on peut le remettre).
  Calculée par **`ordreCellules()`** (`lecture.ts`), utilisée à l'identique par
  le rendu, les contrôles et l'éditeur — l'aperçu ne peut donc pas diverger.
  Facultative : absente, on retombe sur l'ordre du modèle. `apres` (ancien
  ancrage par section) n'est plus que de l'héritage.
- **Grille de 12 colonnes** (`COLONNES_GRILLE`, minimum `COLONNES_MIN` = 3) = la
  mise en page de toute la page. Chaque cellule a une largeur réglée à la
  **poignée** sur son bord droit ; les cellules passent à la ligne d'elles-mêmes,
  donc une page ne peut ni se trouer ni faire se chevaucher deux blocs.
  - Où est rangée la largeur : un bloc ajouté porte `colonnes` ; un emplacement
    du modèle passe par `contenu.largeurs[nom]`. La poignée distingue les deux
    par la clé (`suite:<id>` ou le nom).
  - L'ancien champ `largeur: 'pleine' | 'moitie'` n'est plus écrit mais **reste
    lu** : ne pas le supprimer.
  - **Hauteur** : seules les images et galeries en ont une réglable (poignée
    basse) — la hauteur d'un texte découle de son contenu. Rangée dans `hauteur`
    (bloc) ou `contenu.hauteurs[nom]` (emplacement), en pixels de toile, lue par
    le rendu via la variable CSS `--hauteur-bloc`. Absente, l'image garde son
    plafond de 620 px et la galerie ses 260 px.
  - **Le modèle 3 fait exception** : sa composition vidéo est indivisible, ses
    emplacements ne passent pas par la grille. Ses blocs ajoutés, si.
- **Toile** (`ToileBorne`) = conteneur de référence **1920 px de large**, mis à
  l'échelle sur la largeur du parent avec **`zoom`** (et non `transform`). Une
  page plus haute qu'un écran **défile**.
- **`media://`** = protocole interne qui sert un fichier de `medias/` sans
  exposer le reste du disque. Il répond aussi l'en-tête
  `Access-Control-Allow-Origin` et déclare `corsEnabled` : sans cela l'interface
  peut **afficher** un média mais pas le **lire** (`fetch`), et l'image de
  couverture d'une vidéo devient impossible.
- **Image de couverture d'une vidéo** (`posterChemin`) = fabriquée à l'import,
  dans `contenu.ts` : les octets copiés sont relus, rejoués **depuis la mémoire**
  (`Blob` + `URL.createObjectURL`), la vidéo est placée à **1 seconde** (une
  vidéo commence presque toujours par une image noire), un canvas capture
  l'image, et le processus principal l'écrit dans `medias/` — l'interface
  n'écrit jamais elle-même sur le disque. Deux pièges vérifiés, coûteux à
  retrouver :
  - servie par `media://`, une vidéo est vue comme venant **d'un autre site** :
    le canvas refuse d'exporter l'image (« tainted canvas ») — d'où le détour
    par la mémoire ;
  - poser `crossOrigin="anonymous"` sur le lecteur **casse le déplacement dans
    la vidéo** : elle reste à zéro, on ne capturerait que l'image noire. Ne pas
    le faire.
  - une vidéo importée **avant** cette version n'a pas de couverture : le
    lecteur se place alors à la première seconde (`#t=1`) au lieu d'un écran
    noir. Réimporter la vidéo lui en donne une vraie.
- **Enregistrement automatique** : ~600 ms après la dernière frappe. Pas de
  bouton « Enregistrer » — ne pas en ajouter. Un indicateur d'état est en barre.
- **Annuler / Rétablir** (`Admin.tsx`) : **Ctrl + Z**, **Ctrl + Y** (ou
  Ctrl + Maj + Z), et deux boutons dans la barre — la salle n'a pas de clavier.
  Un pas d'historique est le **manifeste entier** tel qu'il était : le contenu
  tient en mémoire, rien ne peut se désynchroniser. Trois points à connaître :
  - tout passe par `modifier()`, seul endroit qui écrit le contenu — c'est ce
    qui rend l'historique complet sans le câbler action par action ;
  - les modifications espacées de moins de 600 ms ne font **qu'un** pas :
    sinon annuler une phrase demanderait autant d'appuis que de lettres ;
  - dans un champ de saisie, le raccourci est laissé au navigateur (on annule
    sa frappe, pas la dernière action de la page). Le compteur `generation`,
    passé à `EditeurPage` et glissé dans la clé du panneau, remonte le champ de
    texte enrichi : sans lui, un texte annulé resterait affiché à l'écran.
- **Accès admin** : coin haut-droit invisible, appui **5 s**, puis code PIN
  (`reglages.pinAdmin`, défaut **1975**). Raccourci équivalent au clavier :
  **Ctrl + Alt + A**. Le code est **en clair** dans `contenu.json` : il écarte un
  visiteur curieux, **ce n'est pas une sécurité** — ne jamais le présenter comme
  telle au musée.

## Glisser-déposer des blocs — état

**Complet** (2026-08-05) : glissement **dans le panneau** (poignée `⠿`),
glissement **sur l'aperçu** (`.emp[data-nom]`, seuil de 8 px pour distinguer le
clic), glissement **depuis le menu d'ajout** (on attrape le type, le bloc est
créé au moment du dépôt), **dépôt sur le flanc** = côte à côte avec répartition
des colonnes, **dépôt en haut/en bas** = le bloc passe en pleine largeur sur sa
propre rangée, et **défilement automatique** quand on approche d'un bord. Les
blocs du modèle se déplacent et se retirent comme les autres ; une rangée
« Retirés de cette page » permet de les remettre.

Un seul endroit range les cellules : **`placerCellule()`** (rang dans `ordre` +
répartition des colonnes). Le déplacement d'un bloc existant et l'arrivée d'un
bloc neuf y passent tous les deux — ne pas refaire ce calcul ailleurs.

Ce qu'il faut savoir avant d'y toucher :

- **Jamais l'API « drag and drop » HTML5** — elle ne fonctionne pas au doigt.
  Événements pointeur (`pointerdown` / `pointermove` / `pointerup` +
  `setPointerCapture`, enveloppé d'un `try`).
- **Pas de conversion de coordonnées à faire** : la toile utilise `zoom`, donc
  `getBoundingClientRect` et `clientX/clientY` sont dans le même repère. (Ce ne
  serait pas vrai avec `transform`.)
- `document.elementFromPoint` **ne voit que la zone visible** — d'où le
  défilement automatique, sans lequel une cible hors écran est inatteignable.
- La **poignée de largeur** (`.mdl__poignee`) a son propre glissement : ne pas le
  lui voler (tester la cible de l'événement).
- Sortir un bloc d'une paire (déplacement ou retrait) remet **automatiquement**
  l'autre en pleine largeur — `recollerOrphelins` dans `EditeurPage.tsx`. Un bloc
  déjà seul n'est pas touché : sa largeur a été choisie exprès. La poignée de
  largeur ne déclenche pas cette règle (sinon elle sauterait pendant le geste).
- Le drapeau `vientDeGlisser` (qui empêche le clic de fin de geste d'agir deux
  fois) doit **retomber tout seul**, par une minuterie à 0 ms. Le menu d'ajout se
  referme au dépôt : le clic de fin de geste n'a alors jamais lieu, et un drapeau
  resté levé avale le clic **suivant**. Défaut déjà rencontré, déjà corrigé.
- Le geste ne doit jamais être le seul moyen : les flèches ▲▼, le bouton de
  largeur et l'appui simple sur un type du menu (le bloc se pose en bas) doublent
  toujours le glissement.

## Pièges d'affichage déjà rencontrés

- **`box-sizing: border-box` est posé sur tout** dans `appli.css`, comme dans
  `modeles.css`. Sans lui, un champ en `width: 100 %` dépasse son conteneur de
  26 px — c'est ce qui faisait sortir les champs du quiz et de la frise du
  panneau.
- **Barre de défilement des champs texte** : habillée par `::-webkit-scrollbar`,
  ce qui **retire les boutons par défaut** — les flèches sont redessinées en
  SVG, et `:single-button` évite qu'une paire apparaisse à chaque bout.
- **`.roue__hex` est nommé à part** dans la règle des champs : le disque de
  couleur sert aussi hors du panneau, où le champ garderait sinon le fond blanc
  du navigateur.

## Méthode de test de la fenêtre

Sans écran tactile, piloter l'application par le protocole CDP :

- lancer avec `electron . --remote-debugging-port=9222` ;
- **sous Linux**, ajouter `--ozone-platform=x11` (voir « Installation ») ;
- Node intègre un client WebSocket — aucun paquet à installer.

Trois pièges déjà rencontrés :

1. **Fenêtre en arrière-plan** = page « masquée » : les `setTimeout` sont
   ralentis (l'appui 5 s ne se déclenche jamais) et les vidéos muettes se mettent
   en pause. Forcer `Emulation.setFocusEmulationEnabled` pour un test fiable.
2. **Captures d'écran** : `Page.captureScreenshot` via CDP capture même une
   fenêtre masquée ; une capture système attrape la fenêtre qui est réellement au
   premier plan (souvent une autre application). Toujours vérifier avant
   d'envoyer des frappes clavier ou souris système.
3. **Mesures périmées** : relever les rectangles *après* chaque défilement ou
   changement d'état, sinon on diagnostique un faux bug.

**Avant tout test qui écrit** : sauvegarder `contenu-exemple/contenu.json` et le
**restaurer** ensuite — les tests modifient le vrai fichier d'exemple. Vérifier
aussi qu'on ne supprime pas des pages créées par l'utilisateur.

## Installation — pannes courantes

**Node ≥ 22.12 obligatoire** (Electron 43). Le `.npmrc` du dépôt
(`engine-strict=true`) fait échouer `npm install` avec un message clair si la
version est trop ancienne. Vérifier avec `node -v`.

**Le binaire Electron (~270 Mo) se télécharge à part**, depuis GitHub. C'est
l'étape fragile : un réseau qui filtre GitHub la fait échouer et l'application ne
s'ouvre pas alors que `npm install` semblait passer. Remèdes, dans l'ordre :

1. `npm run reparer-electron` ;
2. derrière un proxy : `HTTPS_PROXY` (et `HTTP_PROXY`) ;
3. miroir : `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` ;
4. poste sans accès : copier `node_modules/electron/dist/` depuis une machine où
   l'installation a réussi.

**Ne jamais versionner `node_modules/`** : le binaire dépend du système.

**Plantage au démarrage sous Linux (`SIGSEGV`).** Sur un bureau moderne
l'affichage passe par Wayland, où Electron 43 s'écrase au lancement sur les
systèmes un peu anciens : aucune fenêtre, message `exited with signal SIGSEGV`.
Les scripts du dépôt passent donc `--ozone-platform=x11` (voir
`apps/appli/package.json`). En lançant Electron à la main, il faut le répéter.
Le régler depuis le code (`app.commandLine.appendSwitch`) **ne marche pas** : le
mode d'affichage est choisi avant que `principal.cjs` soit lu. Sans objet sous
Windows, le système du poste de la salle.

## Git

Dépôt distant : `github.com/JockoBesne/BorneAdmin.git`. Branche de travail
actuelle : `features/drag-and-drop`.

L'utilisateur travaille **aussi depuis un autre poste** : penser à
`git fetch` / `git pull` avant de commencer, sinon on code sur une base périmée
et on fabrique des conflits. Ne jamais commiter sans le lui demander.
