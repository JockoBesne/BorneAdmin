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
    droite ; blocs du modèle + blocs ajoutés (`suite`).
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
- lancer avec le port de débogage : `electron . --remote-debugging-port=9222` ;
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

Restent notamment : le dossier partagé et la publication versionnée (étape 3 de
`CONTEXTE.md`) et l'empaquetage `.exe` (étape 4).

## À faire

### Corrections et ajustements demandés (à faire en premier)

**1. Champ de couleur : permettre la saisie au clavier.** Aujourd'hui on ne peut
pas *écrire* un code couleur dans le champ hexadécimal, seulement coller un code
complet. Cause : dans `apps/appli/src/RoueCouleur.tsx`, le champ `.roue__hex` est
contrôlé et n'appelle `surChangement` que si la valeur saisie est un code complet
valide (`/^#[0-9a-fA-F]{6}$/`) — tant qu'on tape, la valeur reste bloquée sur
l'ancienne, donc rien ne s'affiche. À faire : garder la saisie en **état local**
(afficher ce que l'utilisateur tape), et ne répercuter la couleur que quand le
code est complet et valide. Accepter le code avec ou sans le « # ».

**2. Défilement de la zone « Couleurs de la page ».** Quand les deux disques sont
ouverts dans l'éditeur, on ne peut pas atteindre le bas (2ᵉ disque, bouton
« Suivre le thème général »). **Décision : tout le panneau de droite défile.**
Piste : le panneau `.pan` a bien `overflow-y: auto`, mais la grille `.edit`
(`apps/appli/src/appli.css`) doit borner la hauteur de la ligne
(`grid-template-rows: minmax(0, 1fr)` ou `100%`) et `.pan` garder `min-height: 0`,
sinon le contenu pousse la hauteur au lieu de faire défiler à l'intérieur.

**3. Retour à la ligne du texte qui dépasse la largeur du bloc.** Un texte plus
large que son bloc (surtout en demi-largeur) doit **revenir à la ligne** au lieu
de déborder. **Décisions (utilisateur) :** retour à la ligne **entre les mots**,
**sans couper un mot** en deux ; un mot plus long que le bloc part sur sa propre
ligne (cas rare, peut alors dépasser légèrement — accepté). S'applique **aussi
aux titres**. Piste : sur les classes de texte de
`packages/contenu/src/rendu/modeles.css` (`.b-corps`, `.b-h1`, `.b-h2`, `.b-h3`,
`.b-petit`, titres compris), s'assurer du retour à la ligne normal
(`overflow-wrap: normal`, pas de `white-space: nowrap`) et surtout que la largeur
du bloc est **bien contrainte** (`min-width: 0` sur les cellules `.suite__bloc`
et les colonnes de grille) — c'est souvent une largeur non bornée, et non le
texte, qui fait déborder. Ne pas forcer la coupure des mots
(`overflow-wrap: break-word`), l'utilisateur préfère les mots entiers.

### Déjà fait

Les quatre points demandés le 2026-08-03 — couleurs par page, texte du modèle
vidéo caché pendant la lecture, vidéo dans tous les modèles, blocs côte à côte —
ont été **réalisés** (voir « Avancement » et `DECISIONS.md`).

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
