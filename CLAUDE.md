# Repères pour l'assistant

Ce dépôt est le prototype de l'**application unique** du Musée des Transmissions
(mode visiteur plein écran + mode administration, dans un seul programme Electron).
La source de vérité sur l'état du projet et l'architecture est **`CONTEXTE.md`** —
à lire en premier. `CONCEPTION.md` décrit une architecture en partie abandonnée
(voir `CONTEXTE.md` § « Sections devenues obsolètes »).

L'utilisateur **n'est pas développeur** : expliquer chaque changement en clair,
une commande par bloc de code, un fichier à la fois.

Lancer l'application : `npm run appli` (= `vite build && electron .`).

## Commandes

- `npm run appli` — construit l'interface et ouvre la fenêtre Electron.
- `npm run construire` — construit l'interface seule (vérifier que ça compile).
- `npm run verifier` — vérifie les types TypeScript (`tsc`), sans rien produire.
- `npm install` à la racine — installe tout (monorepo npm workspaces).
- `npm run reparer-electron` — retélécharge le binaire Electron (voir ci-dessous).

## Installation — pannes courantes

**Node ≥ 22.12 est obligatoire** (exigence d'Electron 43). Le dépôt contient un
`.npmrc` avec `engine-strict=true` : un Node trop ancien fait échouer
`npm install` avec un message clair plutôt qu'une erreur obscure plus loin.
Vérifier avec `node -v` ; sinon installer Node 22 LTS (ou plus récent).

**Le binaire Electron (~270 Mo) se télécharge à part**, depuis GitHub, à
l'installation. C'est l'étape fragile : un réseau d'entreprise/musée qui filtre
GitHub la fait échouer, et l'application ne se lance pas alors que
`npm install` semblait passer. Signes : « Electron failed to install correctly »,
binaire introuvable, ou fenêtre qui ne s'ouvre pas.

Remèdes, dans l'ordre :
1. `npm run reparer-electron` — relance le seul téléchargement du binaire.
2. Derrière un proxy : renseigner `HTTPS_PROXY` (et `HTTP_PROXY`).
3. Réseau qui bloque GitHub : utiliser un miroir, p. ex.
   `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` avant l'installation.
4. Poste sans accès : copier le dossier `node_modules/electron/dist/` depuis une
   machine où l'installation a réussi.

Bon à savoir : depuis Electron 43, si le binaire manque, il est **téléchargé à la
demande** au premier lancement — la panne est donc moins fréquente qu'avant.

**Ne jamais versionner `node_modules/`** (déjà dans `.gitignore`) : le binaire
Electron dépend du système d'exploitation.

**Plantage au démarrage sous Linux (`SIGSEGV`).** Sur un bureau Linux moderne,
l'affichage passe par **Wayland** ; Electron 43 s'y écrase au lancement sur les
systèmes un peu anciens (constaté sur Ubuntu 22.04 / GNOME 42, carte Intel).
Aucune fenêtre ne s'ouvre, le message est `electron exited with signal SIGSEGV`.
Les commandes du dépôt passent donc `--ozone-platform=x11` (voir les scripts
`demarrer` et `electron` de `apps/appli/package.json`) : l'application utilise
l'affichage historique X11, disponible partout, sans rien changer au rendu. Ce
drapeau ne concerne que Linux — Windows, le système du poste de la salle,
l'ignore. **En lançant Electron à la main** (test CDP, par exemple), il faut le
répéter : `electron . --ozone-platform=x11 --remote-debugging-port=9222`.
Le régler depuis le code (`app.commandLine.appendSwitch`) **ne marche pas** :
le mode d'affichage est choisi avant que `principal.cjs` soit lu.

Les workspaces actifs sont `packages/contenu`, `packages/ui`, `apps/appli`.
`apps/api`, `apps/admin`, `apps/borne` restent sur le disque comme **réservoir**
de code (voir `CONTEXTE.md`) mais ne sont plus installés ni construits.

## Structure du code

- **`apps/appli/`** — l'application. C'est ici que se fait le travail.
  - `electron/principal.cjs` — processus principal : fenêtre, protocole `media://`
    (sert les fichiers du dossier de contenu), lecture **et écriture** disque du
    `contenu.json` (écriture atomique : fichier `.tmp` puis renommage), import de
    médias (`dialog.showOpenDialog` + copie dans `medias/`).
  - `electron/passerelle.cjs` — `contextBridge` : **la seule** surface exposée à
    l'interface (`window.borne`). Ajouter une capacité = ajouter une ligne ici.
  - `src/App.tsx` — bascule entre mode visiteur et mode admin.
  - `src/Visiteur.tsx` — mode visiteur (affichage des pages, navigation).
  - `src/AccesAdmin.tsx` — accès caché (coin haut-droit, appui 5 s, code PIN).
  - `src/Admin.tsx` — administration : liste des pages (créer / dupliquer /
    supprimer / réordonner), panneau « Apparence », enregistrement automatique.
  - `src/EditeurPage.tsx` — éditeur d'une page : aperçu fidèle à gauche, blocs à
    droite ; blocs du modèle + blocs ajoutés (`suite`). Cliquer un bloc déplie
    **sous lui** son panneau (`PanneauBloc`) : contenu (`FormulaireBloc`) puis
    personnalisation.
  - `src/RoueCouleur.tsx` — disque de couleur (canvas TSV + luminosité + hex).
  - `src/couleurs.ts` — conversions de couleur + fabrique des variables CSS.
  - `src/contenu.ts` — chargement/enregistrement du contenu, résolution des
    médias, import (mesure des dimensions/durée côté navigateur, **pas** de
    module natif).
- **`packages/contenu/`** — cœur du produit, partagé. Le modèle de contenu :
  - `src/modeles/` — les 3 modèles de page (`t1`, `t2`, `t3`), leurs
    emplacements typés et leurs **sections** (points d'ancrage des blocs ajoutés).
  - `src/manifeste.ts` — schémas Zod (validation à la lecture ET à l'écriture).
  - `src/types.ts` — types du contenu (`ContenuPage`, `BlocLibre`, `Reglages`…).
  - `src/controles.ts` — contrôles avant publication (messages en français).
  - `src/lecture.ts` — lecture typée du contenu (`lireTexte`, `lireSuite`…).
  - `src/rendu/` — composants React de rendu (`RenduPage`, `Modeles`, `blocs`,
    `ToileBorne`) + `modeles.css`. **Le même rendu sert la borne et l'aperçu de
    l'admin** : l'aperçu est donc fidèle par construction.
- **`packages/ui/`** — composants d'interface génériques (conservé, peu utilisé
  par `apps/appli` pour l'instant).
- **`contenu-exemple/`** — jeu de test : `contenu.json` + `medias/`. Préfigure le
  dossier partagé. C'est ce dossier que l'application lit/écrit par défaut
  (variable d'environnement `BORNE_CONTENU` pour en pointer un autre).

## Concepts clés

- **Modèle** (`t1`, `t2`, `t3`) = une page entière et sa mise en page. Chaque
  modèle déclare ses **sections** (`sections` dans `definir-modele`).
- **Emplacement** = un morceau imposé par le modèle (titre, image, texte…).
- **Bloc ajouté** / **suite** = blocs libres qu'on ajoute à une page, en plus des
  emplacements du modèle. Un bloc mémorise `apres` (la section après laquelle il
  s'affiche) : les flèches ▲▼ le déplacent, y compris entre les emplacements.
- **Texte enrichi** (`ValeurTexte`) = un texte se range sous deux angles :
  `valeur`, le texte **sans** mise en forme (c'est lui qu'on compte, qu'on
  contrôle, et qui dit si le bloc est vide), et `lignes`, la mise en forme —
  une liste de lignes faites de morceaux portant leurs marques (`gras`,
  `italique`, `souligne`), plus `puce` pour une ligne de liste. `lignes` est
  **facultatif** : absent, la mise en forme est relue de l'ancienne écriture
  (`**gras**`, `_italique_`, « - » en tête) rangée dans `valeur` — les contenus
  déjà écrits s'affichent donc sans conversion. Un texte sans aucune mise en
  forme n'écrit pas ses lignes non plus. Outils dans `packages/contenu/src/texte.ts`
  (`lignesDeTexte`, `texteBrut`, `sansMiseEnForme`). **Jamais de HTML stocké** :
  la saisie (`apps/appli/src/ChampTexteRiche.tsx`) relit le champ nœud par nœud,
  et un collage arrive en texte brut.
- **Champ mis en forme** (`ChampMisEnForme`) = un champ texte **et** sa barre
  d'outils, réunis en un seul composant : libellé, barre, saisie, compteur. La
  barre (`BarreMiseEnForme` : gras, italique, souligné | alignement | couleur du
  texte, couleur du fond du bloc, plus « Rétablir par défaut ») ne s'obtient
  qu'en passant par lui. **Pas de champ texte, pas de barre** — et c'est vrai
  sans qu'on ait à y penser : la galerie, le quiz, la frise et une photo ou
  vidéo pas encore choisie n'en ont donc aucune. Conséquence assumée : ces blocs
  ne se règlent pas depuis l'éditeur (ni fond, ni alignement).
  Il y a **une barre par bloc** au plus : chaque type de bloc n'a qu'un champ
  texte principal (texte, titre, légende).
  Piège : ce champ et sa barre ne doivent **jamais** être enveloppés dans un
  `<label>` — un libellé désigne son premier élément de formulaire, qui serait un
  bouton de la barre, et cliquer le libellé enfoncerait une commande (constaté :
  ça écrivait un alignement sur le disque). D'où le `<div className="champ">` de
  `ChampMisEnForme` et les `aria-label` sur les saisies.
- **Habillage** (`StyleBloc`) = l'apparence propre à **un bloc** : fond, et mise
  en forme de son texte (gras, italique, souligné, alignement, couleur). Rangé
  dans `contenu.styles`, par nom de bloc — le nom de l'emplacement (`titre`,
  `image`…) ou `suite:<identifiant>` pour un bloc ajouté. Un seul rangement
  couvre donc les deux sortes de blocs. Appliqué par `Habillage` dans
  `rendu/Modeles.tsx`, par où passent **tous** les blocs : la borne et l'aperçu
  habillent pareil. Un bloc sans habillage n'est pas enveloppé du tout.
  Les classes `.b-hab--*` visent aussi les descendants (`.b-hab--gras *`) :
  chaque bloc se donne déjà sa couleur et sa graisse (`.b-h1`, `.b-corps`), qu'une
  valeur simplement héritée ne remplacerait pas.
- **Grille de 12 colonnes** (`COLONNES_GRILLE`) = la mise en page de **toute la
  page**. Emplacements du modèle et blocs ajoutés sont des cellules de même
  nature (`RenduGrille` dans `rendu/Modeles.tsx`), chacune d'une largeur de 3 à
  12 colonnes réglée à la **poignée** sur son bord droit. Les cellules passent à
  la ligne d'elles-mêmes : une page ne peut donc ni se trouer ni faire se
  chevaucher deux blocs — c'est ce qui distingue cette grille d'un
  positionnement libre. Le bouton ◧/▭ du panneau fait la même chose au clavier
  (le glissement ne doit jamais être le seul moyen).
  - Où est stockée la largeur : un bloc ajouté porte `colonnes` ; un emplacement
    du modèle passe par `contenu.largeurs[nom]` (on ne réécrit pas la
    déclaration du modèle). La poignée distingue les deux par sa clé —
    `suite:<id>` ou le nom de l'emplacement.
  - Largeur de départ : `colonnes` dans la déclaration de l'emplacement
    (`modeles/index.ts`). C'est ce qui donne au modèle sa mise en page d'origine
    — le modèle 2 a ainsi image 5 / texte 7, l'équivalent de son ancienne
    colonne fixe de 760 px.
  - **Le modèle 3 fait exception** : sa composition vidéo est déclarée
    indivisible (une seule section), ses emplacements ne passent pas par la
    grille. Ses blocs ajoutés, si.
  - **Hauteur** : seules les images et galeries en ont une réglable (poignée
    basse), la hauteur d'un texte découlant de son contenu. Stockée dans
    `hauteur` (bloc) ou `contenu.hauteurs[nom]` (emplacement), en pixels de
    toile, et lue par le rendu via la variable CSS `--hauteur-bloc`. Absente,
    l'image garde son plafond de 620 px et la galerie ses 260 px.
  - L'ancien champ `largeur` ('pleine'/'moitie') n'est plus écrit mais reste lu :
    les contenus antérieurs restent valides.
- **Toile** (`ToileBorne`) = conteneur de référence **1920 px de large**, mis à
  l'échelle sur la largeur du parent (`zoom`). Une page **défile** si elle est
  plus haute qu'un écran (les images ne sont plus jamais rognées).
- **media://** = protocole interne qui sert un fichier du dossier `medias/` à
  l'interface, sans exposer le reste du disque.
- **Enregistrement automatique** : dans l'admin, tout changement est écrit ~600 ms
  après la dernière frappe. Pas de bouton « Enregistrer ». Un indicateur d'état
  est affiché dans la barre.
- **Accès admin** : coin haut-droit invisible, appui **5 s**, code PIN (par défaut
  `1975`, dans `reglages.pinAdmin`). Le code est en clair dans `contenu.json` :
  il écarte un visiteur curieux, **ce n'est pas une sécurité**.
  Raccourci équivalent sur le PC du bureau : **Ctrl + Alt + A** (l'écran de la
  salle n'a pas de clavier, un visiteur ne peut donc pas s'en servir).
  L'appui capture le pointeur pour tolérer le glissement du doigt ; la capture
  est enveloppée d'un `try` — si elle échoue, l'appui doit rester valable.

## Pièges d'affichage déjà rencontrés

- **`box-sizing: border-box` est posé sur tout** dans `appli.css`, comme dans
  `modeles.css`. Sans lui, un champ en `width: 100 %` avec ses marges intérieures
  dépasse son conteneur de 26 px — c'est ce qui faisait sortir les champs du quiz
  et de la frise hors du panneau.
- **Barre de défilement des champs texte** : reprise en entier (fine, sans fond,
  couleur d'accent). Habiller une barre par `::-webkit-scrollbar` **retire les
  boutons par défaut** : les flèches sont redessinées en SVG, et `:single-button`
  évite qu'une paire apparaisse à chaque bout.
- **`.roue__hex` est nommé à part** dans la règle des champs : le disque de
  couleur sert aussi hors du panneau (fenêtre « Apparence de la borne »), où le
  champ garderait sinon le fond blanc du navigateur.

## Contraintes à toujours garder en tête

- **Écran tactile.** La borne est un écran tactile 1920×1080 (paysage supposé,
  non confirmé). Toute interaction doit être utilisable au doigt : grandes cibles,
  pas de survol requis, pas de commandes natives minuscules. Ex. : le lecteur
  vidéo est **toute la vidéo** (toucher = lire / pause), pas les contrôles natifs.
- **Personne ne dépannera l'installation.** Pas de service à maintenir, pas de
  base de données. Le stockage est un `contenu.json` + un dossier `medias/`.
- **Pas de module natif.** Le redimensionnement d'images et la lecture des
  dimensions se font via le navigateur (canvas / `<img>` / `<video>`), jamais via
  `sharp` ou équivalent.
- Valider le contenu avec **Zod avant d'écrire** sur le disque ; tout nouveau
  champ du contenu doit être **facultatif** (ou avoir une valeur par défaut) pour
  ne pas invalider les contenus existants — et **déclaré dans le schéma**, sinon
  il est effacé silencieusement à l'enregistrement.

## Méthode de test de la fenêtre

L'application est une fenêtre Electron. Pour vérifier un changement sans écran
tactile :
- lancer avec le port de débogage :
  `electron . --ozone-platform=x11 --remote-debugging-port=9222` (le drapeau
  `--ozone-platform` évite le plantage Wayland, voir plus haut) ;
- piloter/inspecter la page via le protocole CDP (WebSocket sur `:9222`) — Node
  intègre un client WebSocket, aucun paquet à installer.
- Deux pièges observés :
  1. **Fenêtre en arrière-plan** = page « masquée » : les `setTimeout` sont
     ralentis (l'appui 5 s de l'accès admin ne se déclenche pas) et les vidéos
     muettes se mettent en pause. Forcer `Emulation.setFocusEmulationEnabled`
     pour un test fiable.
  2. **Captures d'écran** : préférer `Page.captureScreenshot` via CDP (capture la
     page même masquée) à une capture système (une autre fenêtre peut passer au
     premier plan). Toujours vérifier quelle fenêtre est réellement au premier
     plan avant d'envoyer des frappes clavier/souris système.
- **Avant de tester des écritures**, sauvegarder `contenu-exemple/contenu.json`,
  et le **restaurer** après : les tests modifient le vrai fichier d'exemple.

## Avancement (depuis la rédaction de `CONTEXTE.md`)

`CONTEXTE.md` a été écrit avant que l'étape 1 tourne. Depuis, sont **faits** :
- **Étape 1** — l'application se lance, les 3 pages d'exemple s'affichent, la
  navigation, le plein écran (F11 / Échap) et la vidéo fonctionnent. Défaut de
  mise en page corrigé : les pages **défilent** au lieu de rogner les images.
- **Accès admin caché** + **mode administration** : liste des pages (créer,
  dupliquer, supprimer, réordonner) et **éditeur en place** (textes, images,
  vidéos, galeries) avec enregistrement automatique sur le disque.
- **Import de médias** depuis l'ordinateur (photos et vidéos).
- **Blocs ajoutés** (`suite`) : ajout / retrait / déplacement, y compris entre les
  emplacements du modèle. Un bloc vide n'apparaît pas côté visiteur.
- **Lecteur vidéo tactile** (toute la vidéo est la cible de lecture/pause).
- **Couleurs de la borne** (fond + texte) réglables avec un **disque de couleur**,
  aperçu en direct : **thème global** (panneau « Apparence ») **et couleurs par
  page** (dans l'éditeur de page, la page l'emporte sur le global).
- **Texte du modèle vidéo caché pendant la lecture** (revient à la pause / fin).
- **Vidéo comme bloc ajouté** : on peut insérer une vidéo dans n'importe quelle
  page (`video` est un type de bloc libre).
- **Disposition des blocs ajoutés** : chaque bloc peut être en pleine largeur ou
  en **demi-largeur** ; deux blocs « demi » consécutifs se placent côte à côte.
- **Saisie du code couleur au clavier** dans le disque (`RoueCouleur`) : on tape
  le code, avec ou sans « # » ; état local, la couleur ne s'applique qu'au code
  complet.
- **Défilement du panneau de l'éditeur** : la grille `.edit` borne la hauteur de
  ligne et les sections ne se compriment plus (`.pan > * { flex-shrink: 0 }`) —
  on atteint les deux disques de couleur et le bouton du bas.
- **Un seul panneau par bloc, ouvert sous lui.** Dans l'éditeur, cliquer un bloc
  de la liste de droite déplie **sous lui** tout ce qui le concerne. Plus rien en
  bas de la colonne ; fermeture par la croix (dans le coin, à la hauteur du
  libellé du premier champ — elle ne prend pas de ligne à elle) ou en recliquant
  le bloc. Le panneau ne porte ni titre de section ni règle d'utilisation — les `conseil` des modèles
  ne sont plus affichés. Vaut pour les blocs du modèle comme pour les blocs
  ajoutés. Voir « Barre de mise en forme » et « Habillage » dans les concepts
  clés.
- **Champ de texte enrichi.** Un bloc de texte se saisit **mis en forme** : on
  sélectionne un mot, on clique G / I / S, et le champ l'affiche aussitôt en
  gras, en italique ou souligné. Plus de `**` ni de `_` à taper. Sur un bloc de
  texte, ces trois boutons agissent donc sur **la sélection**, pas sur le bloc
  entier ; ailleurs (titre, image, atelier…) ils habillent le bloc comme avant.
  Voir « Texte enrichi » dans les concepts clés.
- **Retour à la ligne du texte** (`overflow-wrap: break-word` hérité par `.mdl`,
  titres compris) : on revient à la ligne entre les mots ; seul un mot plus large
  que son bloc (adresse web, code collé) est coupé au bord — rien ne déborde.

Restent notamment : le dossier partagé et la publication versionnée (étape 3 de
`CONTEXTE.md`) et l'empaquetage `.exe` (étape 4).

## À faire

### Déjà fait

Deux séries de demandes du 2026-08-03 ont été **réalisées** (voir « Avancement »
et `DECISIONS.md`) :

- couleurs par page, texte du modèle vidéo caché pendant la lecture, vidéo dans
  tous les modèles, blocs côte à côte ;
- saisie du code couleur au clavier, défilement du panneau de l'éditeur, retour
  à la ligne du texte trop large.

Note sur le retour à la ligne : la décision a **évolué** en cours de route. Le
choix final (après avoir constaté qu'un mot très long déborde de plus du double
du bloc s'il n'est pas coupé) est de **couper au bord uniquement un mot plus
large que son bloc** (`overflow-wrap: break-word` posé sur `.mdl`) ; les mots
normaux restent entiers.

Restent les grandes étapes de `CONTEXTE.md` :

- **Étape 3 — dossier partagé.** Réglage du chemin, copie locale au démarrage
  puis périodique, publication versionnée (garder les N derniers dossiers datés).
- **Étape 4 — empaquetage.** `.exe` (electron-builder), démarrage automatique,
  plein écran par défaut sur le poste de la salle.

Détails à surveiller, sans urgence :

- redimensionner les images à l'import (via le canvas) si leur poids devient gênant ;
- générer une image de couverture pour une vidéo importée (sinon écran sombre
  avant lecture) ;
- réordonner les photos à l'intérieur d'une galerie ;
- fins de ligne CRLF/LF, `arborescence.txt` à supprimer (dette listée dans
  `CONTEXTE.md`).
