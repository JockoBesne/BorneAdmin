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

**Faits le 2026-08-18** (les deux points d'éditeur demandés le 12 août, § 1.4 et
1.5 de `A-FAIRE.md`) : la case « Recadrer la photo » ne s'écrase plus, et le
glissement **montre la rangée telle qu'elle sera** — un cadre par bloc, calculé
par `placerCellule` (`apercuDepot` dans `EditeurPage.tsx`). Même jour :
**toucher une photo l'affiche en grand** (`Visionneuse` dans `Visiteur.tsx`, la
borne écoute enfin `surImage`), et les photos d'une **galerie ne sont plus
rognées** (`object-fit: contain`). Enfin, le **bandeau du haut se règle page par
page** (voir « Bandeau du haut » dans les concepts).

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
    Barre du haut : le retour à l'accueil. **Au bout de la page**, dans la toile
    et non dans un bandeau (`.voisines`, composant `Voisine`) : les pages
    **précédente** et **suivante**, dans l'ordre du sommaire — on ne les atteint
    qu'en descendant, et elles ne mangent aucune hauteur d'écran le reste du
    temps. Aux deux bouts du parcours, le bouton reste en place mais éteint : la
    position des cibles ne bouge jamais d'une page à l'autre. Étant dans la
    toile, leurs tailles sont en **pixels de toile**, pas en `vw`.
  - `src/Accueil.tsx` — le sommaire. La vignette d'une carte est montrée
    **entière** (`object-fit: contain`), sur un fond fait de la même image
    floutée et assombrie (`.hub__fond`). Rognée (« cover »), une carte ou une
    planche de signaux devenait une bande illisible ; montrée entière sans ce
    fond, elle flottait au milieu d'un grand vide.
  - `src/AccesAdmin.tsx` — accès caché (coin, appui 5 s, code PIN).
  - `src/Admin.tsx` — liste des pages, panneau « Apparence », enregistrement auto.
    Le panneau « Écran d'accueil » règle aussi le **délai avant le retour
    automatique** (`minutesAvantVeille`, 1 à 60 minutes) : le réglage vivait dans
    le fichier de contenu sans que personne puisse le voir.
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
  en pointer un autre). Depuis le 2026-08-18, c'est aussi la **démonstration de
  présentation** : les 12 pages du 3ᵉ étage, refaites pour montrer tous les
  outils de mise en page (les quatre modèles, grille et décalages, hauteurs et
  recadrage, habillages, textes enrichis, quiz et frises, couleurs par page).
  L'état d'avant est gardé dans `contenu.json.avant-refonte-demo`.
  - **Piège, rencontré et payé cher : les légendes des médias ne décrivaient pas
    les fichiers.** « chappe-tour » est une *carte* du réseau, pas une tour ;
    « morse-manipulateur » est l'*alphabet* Morse ; « radio-philips » était le
    *logo* de la marque ; « pigeon-vitrine-1/2 » montrent l'appareil photo de
    Neubronner. Une démonstration bâtie sur ces légendes présente chaque pièce
    pour ce qu'elle n'est pas. **Regarder les fichiers avant de les placer** :
    on ouvre les images (une planche-contact injectée dans la fenêtre suffit),
    on relève ce qu'elles montrent, et seulement ensuite on écrit la page.
  - L'illustration générée par IA (`tours-signaux-chaine.png`) et le logo
    Philips ont été retirés de la bibliothèque ; les fichiers restent sur le
    disque. Deux pages n'ont donc **aucune photo** (l'entre-deux-guerres, la
    télévision) : il manque des clichés pris au musée.
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
  que le fond — le texte et les photos posés dessus restent nets). Son curseur
  s'affiche **dès l'ouverture du disque du fond**, avant qu'une couleur ait été
  choisie : le bouger en pose une (celle qu'affiche le disque, c'est-à-dire
  celle de la page), faute de quoi il n'aurait rien à rendre translucide et
  passerait pour cassé — reproche fait le 2026-08-18, sur une galerie,
  **taille du texte** (`taille`, en pourcentage, 60–200, absente = 100) et mise
  en forme de son texte. Rangé dans `contenu.styles`, par nom de bloc — même
  clé que partout ailleurs (`titre`, `suite:<id>`). Appliqué par `Habillage`
  dans `rendu/Modeles.tsx`, par où passent tous les blocs. Un bloc sans
  habillage n'est pas enveloppé du tout, et un habillage remis à zéro est retiré
  du fichier (`estStyleVide`, `sansStylesVides`) — il part aussi avec son bloc
  quand on le retire.
  - **Les fonds décoratifs cèdent à l'habillage.** Les cases d'une galerie
    (`.b-galerie__zone`) deviennent transparentes dès que le bloc a un fond :
    sans quoi chaque photo restait posée sur `--b-surface`, teinte fixe de la
    palette, et la couleur choisie ne se voyait que dans les gouttières. Même
    famille de défaut sur l'encart du modèle 3, dont le cadre portait la palette
    d'origine **recopiée en dur** (`rgba(14, 34, 55, 0.86)` = `#0e2237` à 86 %) :
    il lit maintenant `--b-fond`, `--b-accent` et `--b-texte`, donc il suit les
    couleurs de la page. Aspect par défaut inchangé dans les deux cas. Enfin la
    **barre de défilement de la toile** (`.toile::-webkit-scrollbar`), qui
    portait l'or de l'accent et un bleu fixe : curseur en `--b-texte-doux`,
    piste en `color-mix` du texte et du fond — elle suit donc la page ouverte,
    y compris dans l'aperçu de l'éditeur.
  - **La taille du texte est un facteur, pas une taille en points.** Le rendu
    pose une variable CSS `--facteur-texte` sur l'habillage ; chaque texte
    (`.b-h1`, `.b-h3`, `.b-corps`, `.b-petit`, `.b-legende`) multiplie **sa**
    taille par elle (`calc`). Un `font-size` posé sur l'enveloppe n'aurait rien
    changé — ces classes portent chacune leur taille en pixels. Conséquence
    voulue : les écarts entre un titre et un paragraphe sont conservés. Les
    ateliers (quiz, frise) gardent leurs tailles, leurs commandes étant
    dimensionnées au doigt.
  - Un réglage compté au pas (les deux « A » de la barre) part de la valeur
    **rangée dans le contenu**, jamais de celle qu'affiche la barre : deux
    appuis rapprochés partiraient sinon du même point et l'un serait perdu.
    Constaté, corrigé le 2026-08-18.
  - La taille **s'écrit aussi à la main** dans la barre. Deux points : ce qui
    est tapé vit dans un état à part tant qu'on n'a pas validé (sinon « 1 »,
    début de « 150 », serait aussitôt ramené à 60), et la case est nommée
    `.ruban input.ruban__valeur` — sans cette double mention, `.pan input` lui
    donnerait toute la largeur du panneau.
  - **L'aller-retour par clé USB est couvert** (`transfert.test.ts`) : la page
    est écrite, relue par le schéma puis réimportée, et son habillage doit
    ressortir entier. C'est le passage où un champ non déclaré disparaît.
- **Bandeau du haut** = la barre `.monde__barre` du mode visiteur (« ← Accueil »
  et le titre). Elle se règle **par page**, dans le panneau « Apparence de la
  page » de l'éditeur : quatre champs facultatifs sur la page —
  `couleurBandeau`, `couleurBandeauTexte`, `hauteurBandeau` (72–200 px) et
  `bandeauMasque`. Tous absents = le bandeau d'origine, inchangé.
  - Le rendu passe par des **variables CSS avec valeur de repli**
    (`var(--b-bandeau, #081726)`, posées par `stylesCouleurs` dans
    `couleurs.ts`) : tant que rien n'est réglé, aucune variable n'est écrite et
    la feuille de style garde son apparence d'avant. C'est ce qui évite d'avoir
    à migrer les contenus existants.
  - **La couleur du texte se calcule d'elle-même** (`surFondLisible`, luminance
    perçue) : presque noir sur un bandeau clair, presque blanc sur un sombre.
    Sans cela, un bandeau clair garderait le texte clair de la page — illisible,
    et personne au musée n'aurait le moyen de le rattraper. Une couleur choisie
    à la main l'emporte, et l'éditeur montre toujours celle qui s'affichera.
  - **Masqué, le bandeau ne disparaît pas** : il devient transparent et ne garde
    que le bouton de retour, posé sur la page (`.monde__barre--masque`). La
    sortie ne se retire jamais — sinon un visiteur entré sur cette page
    attendrait le retour automatique.
  - Le bandeau est **hors de la toile** : l'aperçu de l'éditeur ne le montre pas
    (il est en pixels d'écran, la toile en pixels de toile). Le réglage ne se
    voit qu'en mode visiteur — c'est assumé, un faux bandeau dans l'aperçu ne
    serait ni à la bonne échelle ni à la bonne place.

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
  donc deux blocs ne peuvent jamais se chevaucher.
  - **Décalage** (`decalage` sur un bloc, `contenu.decalages[nom]` pour un
    emplacement) = colonnes laissées **vides à gauche** d'un bloc. C'est le seul
    moyen de trouer une rangée, et il faut l'avoir demandé : on glisse un bloc
    dans le vide à droite de sa rangée, il se pose à la colonne visée. Rendu par
    la marge intérieure de `.mdl__cellule`, qui englobe le vide (`span décalage +
    largeur`) — le calcul tombe juste sur la grille, il dépend de
    `--gouttiere-grille`. Tout autre dépôt le remet à zéro : c'est ainsi qu'on
    supprime un espace. Absent = 0, le comportement d'avant.
  - **Trois bords se tirent** : le **droit** (la largeur), le **haut** et le
    **bas** (la hauteur, images et galeries). **Rien à gauche** — deux versions y
    ont été essayées, déplacer le bord gauche puis déplacer le bloc entier, et
    toutes deux **refusées par l'utilisateur** : la poignée restait immobile
    pendant que le bloc bougeait, et le glisser-déposer fait déjà le travail. Ne
    pas la remettre.
  - **Photos : une seule règle, et une case pour l'exception.** Une photo est
    **entière, jamais coupée**, remplit la largeur de son bloc (`width: 100 %`) et
    le bloc prend ses proportions. Il n'y a donc ni vide dans le bloc, ni hauteur
    à régler — les poignées haute et basse n'apparaissent pas.
    - **Exception explicite** : la case « Recadrer la photo » du panneau du bloc
      (`StyleBloc.recadre`). Cochée, le bloc reçoit une hauteur (poignées haute et
      basse) et la photo la remplit en se recadrant autour de son point focal.
      **On déplace alors la photo dans son cadre** (2026-08-19) : on sélectionne
      le bloc, puis on fait glisser la photo — le cadrage est rangé par bloc
      (`StyleBloc.focalX / focalY`, en %), la **même** photo peut donc être
      cadrée autrement ailleurs. Trois points : le geste n'existe que sur le
      bloc **sélectionné** (sinon il volerait le glisser-déposer, qui déplace le
      bloc), la photo suit le doigt par `image.style.objectPosition` sans passer
      par React (un rendu par mouvement traînerait), et le contenu n'est écrit
      **qu'au relâchement** — un seul pas d'annulation. La course du geste est
      ce qui dépasse du cadre (`cover`), cadre et débordement étant tous deux en
      pixels d'écran, le zoom de la toile ne s'en mêle pas.
      Cocher la case **mesure d'abord la hauteur qu'occupe déjà la photo** : rien
      ne bouge, rien n'est coupé tant qu'on n'a pas tiré une poignée.
    - `hauteurCellule` est le seul passage : une photo non recadrée n'a jamais de
      hauteur imposée, **même si le fichier en contient une** (les hauteurs
      écrites du temps où elles servaient de plafond sont ignorées, pas effacées).
      C'est ce qui a fait apparaître des photos coupées sans que personne ne l'ait
      demandé — le défaut le plus mal vécu de toute la mise en page.
    - **Choisir une photo rétrécit le bloc** juste assez pour que la photo ne
      dépasse pas `HAUTEUR_PHOTO_VISEE` (620 px, l'ancien plafond : la mise en
      page reste familière) — `colonnesPourPhoto`, jamais en dessous de
      `COLONNES_MIN`, jamais élargi. Sans quoi une photo en hauteur mise en pleine
      largeur ferait deux écrans. Le bloc cède, la photo n'est pas touchée.
      Vérifié par `lecture.test.ts`.
  - **Le glisser-déposer ne redimensionne pas le bloc déposé**, sauf quand il ne
    rentre pas (rangée trop pleine : partage des colonnes). Un dépôt au-dessus /
    en dessous lui donnait autrefois la pleine largeur : supprimé — déplacer
    n'est pas redimensionner. Un bloc déposé peut donc se retrouver côte à côte
    avec son voisin si sa largeur le permet.
  - Où est rangée la largeur : un bloc ajouté porte `colonnes` ; un emplacement
    du modèle passe par `contenu.largeurs[nom]`. La poignée distingue les deux
    par la clé (`suite:<id>` ou le nom).
  - L'ancien champ `largeur: 'pleine' | 'moitie'` n'est plus écrit mais **reste
    lu** : ne pas le supprimer.
  - **Hauteur** : **tout bloc** en a une réglable aux poignées haute et basse,
    sauf une photo — elle n'en a une que si on a coché « Recadrer »
    (`hauteurReglable(type, recadre)`). Depuis le 2026-08-19, sur un bloc qui
    s'écoule (texte, titre, quiz, frise) la hauteur est un **plancher**
    (`min-height` sur `.mdl__cellule` **et** sur `.b-hab`, qui sinon laisserait
    le fond s'arrêter au bas du texte) : elle ajoute de la place, elle n'en
    retire jamais — un texte ne peut donc pas être rogné ni déborder sur la
    rangée suivante. Galerie et photo recadrée gardent leur vraie hauteur, et
    une vidéo troque son cadre 16/9 contre la hauteur réglée. Dans un bloc dont
    la hauteur a été réglée, le contenu est **centré en hauteur** plutôt que
    collé en haut (`.mdl__cellule--hauteur`, posée seulement si une hauteur
    existe — sans quoi toutes les cellules passeraient en flex pour rien ; et
    reprise sur `.b-hab`, qui remplit la cellule et doit donc centrer lui-même
    son texte). **Piège** : le sélecteur de l'habillage doit être *descendant*,
    pas `>` — dans l'éditeur, `.emp` (le bloc cliquable) s'intercale entre la
    cellule et l'habillage, et le centrage ne marchait que côté borne.
    **Chaque poignée retient son bord opposé** : celle du bas laisse le haut en
    place (le bloc descend), celle du haut pose `StyleBloc.ancre = 'bas'`, d'où
    `align-self: end` sur la cellule — le bas ne bouge plus, c'est le haut qui
    monte. Limite assumée : un bloc qui est déjà le plus grand de sa rangée n'a
    rien à reprendre au-dessus de lui, la rangée grandit alors vers le bas.
    L'ancre s'écrit dans le **même** pas d'historique que la hauteur.
    **La hauteur réserve de la place, elle ne gonfle pas le bloc** : l'habillage
    n'a exprès *pas* de `min-height` (il l'a eu une demi-journée, le 2026-08-19 :
    le fond remplissait toute la hauteur et collait le bloc à ses voisins). Le
    bloc garde la taille de son contenu, il est centré dans la place réservée,
    et le vide au-dessus et au-dessous **est** l'espace entre les blocs — le
    seul moyen d'en régler un. Galerie et vidéo font exception : leur cellule a
    une hauteur ferme, elles remplissent. **Le choix est laissé** par la case
    « Le fond remplit toute la hauteur » (`StyleBloc.remplir`, `.b-hab--remplir`,
    dans le disque du fond) : cochée, l'aplat de couleur descend jusqu'aux bords
    de la place réservée ; décochée (le défaut, et l'état des pages existantes),
    le fond épouse le texte et la hauteur reste de l'espace. Elle n'apparaît
    qu'une fois un fond choisi — sans fond, elle ne changerait rien à l'œil.
    Rangée dans
    `hauteur` (bloc) ou `contenu.hauteurs[nom]` (emplacement), en pixels de toile,
    lue par le rendu via la variable CSS `--hauteur-bloc`. Absente, la galerie
    fait 260 px.
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
- **Mais tout ce qui vient d'une feuille de style, si.** `getComputedStyle` rend
  des pixels **de toile** (la gouttière de la grille, par exemple), les
  rectangles des pixels **d'écran** : mélanger les deux décale les cadres d'une
  dizaine de pixels et les rétrécit. Multiplier par `echelleDe(element)`
  (`currentCSSZoom`, mesuré à défaut). Même chose pour déplacer un bloc à la
  main : une distance d'écran se **divise** par cette échelle. Défaut constaté
  et corrigé le 2026-08-18.
- **Le bloc qu'on tient suit le doigt**, par une transformation écrite
  directement dans son style (`element.style.transform`), sans passer par React :
  un rendu par mouvement de pointeur ferait traîner le geste. Conséquence : le
  bloc est en permanence sous le pointeur, d'où `document.elementsFromPoint`
  (au pluriel) pour regarder **à travers** lui.
- **Il est porté réduit** (`ECHELLE_PORTE`, 45 %), et le rétrécissement se fait
  **autour du point saisi** (`transformOrigin` posé à la saisie) pour que
  l'endroit touché reste sous le doigt. À sa taille réelle, un bloc pleine
  largeur recouvrait la page et masquait les cadres qui annoncent le résultat —
  reproche fait au geste, corrigé le 2026-08-18. La place réelle est dite par
  les cadres, pas par le bloc porté.
- **Chaque cadre a la taille de son bloc** : largeur d'après le dépôt (calculée
  par `placerCellule`), hauteur du bloc lui-même. Celle du bloc porté est
  **relevée à la saisie** — le mesurer pendant le geste rendrait 45 % de sa
  taille. Une hauteur commune à toute la rangée donnait des cadres qui ne
  ressemblaient à aucun des blocs qu'ils annonçaient.
- **Ne changer l'état du dépôt que s'il a vraiment changé** (`memeDepot`,
  `viser`) : sinon chaque mouvement remplace l'état par un objet équivalent et
  redessine tout l'éditeur pour rien.
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
