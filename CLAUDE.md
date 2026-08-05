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
- `npm install` à la racine — installe tout (monorepo npm workspaces).
- `npm run reparer-electron` — retélécharge le binaire Electron.

## Où en est le projet

**Fonctionne** : la borne (sommaire d'accueil, pages, défilement, plein écran
F11/Échap), l'accès admin caché, l'éditeur complet (textes, images, vidéos,
galeries, quiz, frises), l'import de médias depuis l'ordinateur, les couleurs
réglables, le glisser-déposer des blocs.

**Reste à faire, par ordre d'importance :**

1. **Empaquetage `.exe`** (electron-builder), démarrage automatique, plein écran
   par défaut. **Seule grande étape restante** — c'est ce qui rend l'installation
   tenable dans un musée où personne ne dépannera.
2. **Sauvegarde du contenu** : copie datée sur clé USB ou dossier réseau, contre
   la panne de disque ou la fausse manœuvre. À cadrer avec le musée.
3. **Glisser depuis le menu d'ajout** vers une position choisie (le seul point
   non fait du glisser-déposer ; peu urgent, on ajoute puis on glisse).
4. Confort, sans urgence : redimensionner les images à l'import ; image de
   couverture pour une vidéo importée (sinon écran sombre) ; réordonner les
   photos dans une galerie ; fins de ligne CRLF/LF ; supprimer `arborescence.txt`.

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
    `media://`, lecture **et écriture** du `contenu.json` (écriture atomique :
    `.tmp` puis renommage), import de médias (`dialog.showOpenDialog` + copie).
  - `electron/passerelle.cjs` — `contextBridge` : **la seule** surface exposée à
    l'interface (`window.borne`). Ajouter une capacité = ajouter une ligne ici.
  - `src/App.tsx` — bascule visiteur / admin.
  - `src/Visiteur.tsx` — borne : **sommaire d'accueil** (`.hub`) puis les pages.
  - `src/AccesAdmin.tsx` — accès caché (coin, appui 5 s, code PIN).
  - `src/Admin.tsx` — liste des pages, panneau « Apparence », enregistrement auto.
  - `src/EditeurPage.tsx` — **le gros fichier** (~1300 lignes) : aperçu fidèle à
    gauche, panneau des blocs à droite, glisser-déposer, formulaires.
  - `src/RoueCouleur.tsx`, `src/couleurs.ts` — disque de couleur et conversions.
  - `src/contenu.ts` — chargement / enregistrement / import de médias.
- **`packages/contenu/`** — cœur du produit, partagé.
  - `src/types.ts` — types du contenu (`ContenuPage`, `BlocLibre`…) et constantes.
  - `src/manifeste.ts` — schémas Zod (validation à la lecture **et** à l'écriture).
  - `src/lecture.ts` — lecture typée : `lireTexte`, `lireSuite`, **`ordreCellules`**,
    `colonnesDe`…
  - `src/controles.ts` — contrôles affichés dans l'éditeur, messages en français.
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
  - **Le modèle 3 fait exception** : sa composition vidéo est indivisible, ses
    emplacements ne passent pas par la grille. Ses blocs ajoutés, si.
- **Toile** (`ToileBorne`) = conteneur de référence **1920 px de large**, mis à
  l'échelle sur la largeur du parent avec **`zoom`** (et non `transform`). Une
  page plus haute qu'un écran **défile**.
- **`media://`** = protocole interne qui sert un fichier de `medias/` sans
  exposer le reste du disque.
- **Enregistrement automatique** : ~600 ms après la dernière frappe. Pas de
  bouton « Enregistrer » — ne pas en ajouter. Un indicateur d'état est en barre.
- **Accès admin** : coin haut-droit invisible, appui **5 s**, puis code PIN
  (`reglages.pinAdmin`, défaut **1975**). Raccourci équivalent au clavier :
  **Ctrl + Alt + A**. Le code est **en clair** dans `contenu.json` : il écarte un
  visiteur curieux, **ce n'est pas une sécurité** — ne jamais le présenter comme
  telle au musée.

## Glisser-déposer des blocs — état

Fait : glissement **dans le panneau** (poignée `⠿`), glissement **sur l'aperçu**
(`.emp[data-nom]`, seuil de 8 px pour distinguer le clic), **dépôt sur le flanc**
= côte à côte avec répartition des colonnes, **dépôt en haut/en bas** = le bloc
passe en pleine largeur sur sa propre rangée, et **défilement automatique** quand
on approche d'un bord. Les blocs du modèle se déplacent et se retirent comme les
autres ; une rangée « Retirés de cette page » permet de les remettre.

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
- Sortir un bloc d'une paire laisse l'autre en demi-largeur, seul sur sa rangée.

## Méthode de test de la fenêtre

Sans écran tactile, piloter l'application par le protocole CDP :

- lancer avec `electron . --remote-debugging-port=9222` ;
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

## Git

Dépôt distant : `github.com/JockoBesne/BorneAdmin.git`. Branche de travail
actuelle : `features/drag-and-drop`.

L'utilisateur travaille **aussi depuis un autre poste** : penser à
`git fetch` / `git pull` avant de commencer, sinon on code sur une base périmée
et on fabrique des conflits. Ne jamais commiter sans le lui demander.
