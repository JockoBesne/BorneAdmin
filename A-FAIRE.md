# Ce qu'il reste à faire

*Établi le 3 août 2026, après la refonte de la mise en page en grille.*

Ce fichier est la liste de travail. `CONTEXTE.md` décrit l'architecture et les
décisions ; `CLAUDE.md` les repères de code. Ici, uniquement : quoi faire,
pourquoi, dans quel ordre.

Chaque tâche porte une estimation en demi-journées de travail (½ j).

---

## 1. Mise en page — finir ce qui vient d'être commencé

La grille de 12 colonnes règle la **largeur** de chaque bloc. Deux manques
apparaissent immédiatement à l'usage.

### 1.1 Hauteur réglable des images et des galeries — ~~*1 j*~~ **FAIT (3 août)**

**Le problème, précisément.** Une image est aujourd'hui plafonnée à 620 px de
haut (`.b-image__fichier { max-height: 620px }`). Sur une cellule de 12
colonnes — 1 728 px utiles — une photo 1920 × 1080 est donc limitée par sa
hauteur et s'arrête vers 1 100 px de large : **elargir la cellule ne l'élargit
plus**. C'est exactement ce que vous avez constaté.

**Ce qu'il faut.** Une seconde poignée, en bas de la cellule, qui règle la
hauteur — et seulement pour les images et les galeries, les seuls blocs dont la
hauteur ne découle pas du texte.

**Comment.** Sur le modèle de ce qui existe déjà pour la largeur :

- champ `hauteur?: number` (en pixels de toile, borné, ex. 200 à 1 400) sur le
  bloc et dans `contenu.largeurs`… à renommer plutôt `contenu.dimensions` ;
- **déclarer le champ dans le schéma Zod**, sinon il est effacé à
  l'enregistrement (piège déjà rencontré) ;
- le plafond de 620 px devient la valeur par défaut, pas une limite dure ;
- poignée en bas, glissement vertical, aimantation par paliers de 20 px ;
- alternative clavier (flèches haut/bas), comme pour la largeur.

**Fait ainsi.** Champ `hauteur` sur le bloc, `contenu.hauteurs[nom]` pour les
emplacements, tous deux déclarés dans le schéma Zod. Le rendu lit une variable
CSS `--hauteur-bloc` : absente, l'image garde son plafond de 620 px et la
galerie ses 260 px — les contenus existants sont donc inchangés. Poignée basse
(glissement, pas de 20 px, bornes 160–1400) et flèches haut/bas au clavier.

Mesuré avant/après sur le contenu d'exemple : image affichée 460 × 259 après
élargissement à 12 colonnes — *sans changement*, le plafond de hauteur bloquant
— puis 722 × 406 une fois le plafond porté à 1280 px. C'est bien la hauteur, et
non la largeur, qui empêchait la photo de s'étendre.

### 1.2 Placer un bloc sur sa ligne — ~~*½ j*~~ **FAIT (12 août)**

Champ `decalage` sur le bloc, `contenu.decalages[nom]` pour les emplacements,
tous deux déclarés dans le schéma Zod. Réglé en glissant le bloc dans le vide à
droite d'une rangée : il se pose à la colonne visée. Rendu par la marge
intérieure de `.mdl__cellule`, qui englobe le vide — le calcul tombe juste sur la
grille. Une poignée sur le bord **gauche** a été essayée dans les deux sens
(déplacer le bord, puis déplacer le bloc entier) : **refusée deux fois**, elle
restait immobile pendant que le bloc bougeait. Ne pas la remettre.

### 1.4 Montrer le redimensionnement **avant** le dépôt — ~~*½ j*~~ **FAIT (18 août)**

**Le problème.** Pendant qu'on glisse un bloc, on ne voit pas ce que le dépôt va
faire aux blocs **déjà là**. Sur une rangée pleine, `placerCellule` partage les
colonnes (le voisin passe à la moitié) : le bloc déposé et son voisin changent
tous les deux de taille, et on ne l'apprend qu'après. Ce qui existe aujourd'hui
ne le dit pas :

- `emp--depot-<ou>` allume **un bord** du bloc visé — il dit « ici », pas
  « voilà la taille que tu auras » ;
- `.edit__fantome` (cadre pointillé) donne la place exacte, mais **seulement**
  pour un dépôt dans le vide d'une rangée, et seulement pour le bloc déposé.

**Ce qu'il faut.** Étendre le fantôme à **toute la rangée visée**, telle qu'elle
sera après le dépôt : un cadre par bloc, aux largeurs d'après.

**Comment — la bonne façon, sans dupliquer les règles.** `placerCellule` est une
fonction **pure** (contenu → contenu) : pendant le glissement, l'appeler pour
obtenir le contenu tel qu'il serait, puis dessiner la rangée depuis ce résultat.

1. dans `auPointeurDeplace`, à côté de `setDepot`, calculer
   `placerCellule(contenu, cleGlisse, depot)` — ne rien enregistrer, c'est un
   aperçu ;
2. retrouver la rangée visée avec `rangeesDe(apercu)`, et pour chaque cellule
   calculer son rectangle avec le même calcul de colonnes que `depotDansLeVide`
   (`cadreGrille`, largeur d'une colonne, gouttière relue sur la grille) ;
3. le haut et la hauteur : la bande de la rangée actuelle, comme le fantôme le
   fait déjà ;
4. dessiner : le bloc déposé en cadre plein (c'est lui qu'on tient), les blocs
   déplacés en cadre pointillé plus discret. Tous en `position: fixed` hors de
   l'aperçu — **surtout pas** dans la toile, dont le `zoom` déplacerait un
   élément « fixed » (voir `.edit__fantome`).

**Le piège à éviter.** Ne pas recalculer les largeurs « à la main » pour
l'aperçu : c'est exactement ce qui finit par afficher une chose et en faire une
autre. Tout doit venir de `placerCellule`.

**Fait ainsi.** `apercuDepot` (dans `EditeurPage.tsx`) appelle `placerCellule`
pendant le geste — elle est pure, rien n'est enregistré — puis dessine la rangée
visée du résultat : un cadre par bloc, plein pour celui qu'on tient, pointillé
discret pour ceux qui vont rétrécir. Aucune largeur n'est recalculée à la main.
La bande verticale est celle qu'occupe la rangée aujourd'hui, ou la hauteur du
bloc tenu s'il est plus grand. Quand le bloc atterrit seul sur sa rangée,
l'ancien cadre fantôme prend le relais.

**Complété le 18 août** (geste jugé peu réactif et peu parlant) : le bloc qu'on
tient **suit le doigt**, la place visée n'est plus recalculée quand elle n'a pas
changé (l'éditeur ne se redessine donc plus à chaque pixel), et le pointeur voit
**à travers** le bloc tenu (`elementsFromPoint`). Mesuré par CDP : le bloc se
déplace exactement de la distance parcourue par le pointeur, et les cadres
annoncés (431 px de large, à 81 et 532) tombent au pixel sur les blocs obtenus
après le dépôt.

### 1.5 Texte de la case « Recadrer la photo » écrasé sur le côté — ~~*¼ j*~~ **FAIT (18 août)**

**Le symptôme.** Dans le panneau d'un bloc photo, l'explication sous « Recadrer
la photo » est comprimée en une colonne étroite à droite.

**La cause, trouvée.** `.pan input` (`appli.css`, ~ligne 959) impose
`width: 100 %` à **toute** zone de saisie du panneau. La règle
`.perso__bascule input` (~ligne 512) a la **même spécificité** (une classe + un
élément) et vient **avant** : elle perd. La case à cocher fait donc toute la
largeur, et le texte se serre dans ce qui reste.

**Le correctif.** Monter la spécificité de la règle de la case — le fichier a
déjà deux précédents pour ce piège exact, `.roue__hex` (nommée à part dans la
règle des champs) et `.perso .perso__glissiere input` (nommée deux fois). Le plus
simple ici :

```css
.perso__bascule input[type='checkbox'] { /* … */ }
```

**Fait ainsi**, exactement : sélecteur `.perso__bascule input[type='checkbox']`,
plus `padding: 0; border: 0; background: none` (le champ du panneau lui en
posait), et `flex: 1; min-width: 0` sur `.perso__bascule > span`.

Aujourd'hui un bloc d'un quart de largeur reste collé à gauche, et l'espace
libre de la rangée est perdu. Il faut pouvoir le pousser au centre ou à droite.

**Comment.** Un champ `decalage?: number` (colonnes vides à gauche, 0 à 9), posé
en CSS par `grid-column: <decalage+1> / span <colonnes>`. Réglé soit par
glissement du bloc lui-même, soit par trois boutons *gauche / centre / droite*
dans le panneau — le second est plus simple et suffit sans doute.

**Le garde-fou à conserver :** un décalage ne doit jamais pouvoir faire sortir
un bloc de la grille ni le faire chevaucher son voisin. Borner
`decalage + colonnes ≤ 12` à l'écriture *et* à la lecture.

### 1.3 Modèle 3 sur la grille — *½ j* — *à décider*

Le modèle « vidéo en avant » est resté hors de la grille : sa déclaration dit sa
composition indivisible. À trancher : soit on l'y fait entrer (et il perd ce qui
le distingue), soit on assume qu'il reste une composition figée. **Ne rien faire
tant que le musée ne l'a pas demandé.**

---

## 2. Robustesse — ce qui protège le musée

### 2.1 Tests automatisés — *2 j* — **le manque le plus grave**

Presque aucun. Chaque modification est vérifiée à la main, et rien n'empêche de
casser en silence ce qui marchait. Deux régressions l'ont déjà montré cette
semaine (la règle CSS de l'accès admin supprimée par un nettoyage, la poignée
cassée par une exception non gardée).

**Amorcé le 2026-08-12** : `npm run tester`, avec `transfert.test.ts` (export /
import d'une page) et `manifeste.test.ts` (**point 1 ci-dessous, fait**). Reste :

1. ~~**Le schéma Zod**~~ — fait. Un contenu utilisant *tous* les champs
   facultatifs doit ressortir identique de deux allers-retours, et le
   `contenu-exemple` du dépôt doit rester valide. Ajouter un champ à `types.ts`
   sans le déclarer dans `manifeste.ts` fait maintenant échouer le test.
2. **Les contrôles avant publication** (`controles.ts`) — messages et gravités.
3. **La lecture du contenu** (`lecture.ts`) — largeurs, positions, blocs vides.
4. **Les ateliers** — verdicts du quiz et de la frise.

Outil : `node:test` suffit, aucune dépendance à ajouter.

### 2.2 Écriture du contenu — ~~*½ j*~~ **FAIT (12 août)**

L'écriture était annoncée atomique (`.tmp` puis renommage) mais ne l'était pas
tout à fait : sans `fsync`, le système peut enregistrer le nouveau nom avant le
contenu qu'il désigne, et une coupure de courant laisse un `contenu.json`
**vide** — précisément ce que le renommage devait empêcher. Le descripteur est
maintenant synchronisé avant renommage.

### 2.3 Sauvegarde et retour arrière — ~~*1 j*~~ **FAIT pour la sauvegarde (12 août)**

Une copie de `contenu.json` est mise de côté dans `sauvegardes/` avant chaque
écriture, **au plus une par heure** (le nom porte l'heure, la deuxième écriture
de l'heure ne fait rien — l'enregistrement automatique se déclenche toutes les
600 ms). Les 48 dernières sont gardées.

Au démarrage, un `contenu.json` illisible n'affiche plus d'écran d'erreur : la
sauvegarde la plus récente est reprise, et le fichier abîmé est **renommé**
`.abime-<date>`, jamais effacé. Plus rien de lisible du tout : contenu vide, et
les fichiers abîmés restent à côté.

**Reste à faire** : l'écran « revenir à la version de… » dans l'administration.
Aujourd'hui la reprise est automatique en cas de fichier cassé, mais revenir
volontairement à hier demande de copier un fichier à la main. *½ j*

### 2.4 Fins de ligne CRLF/LF — *½ j*

Les 92 fichiers suivis apparaissent modifiés à chaque fois. Tant que ce n'est
pas réglé (`.gitattributes` + `core.autocrlf`), l'historique Git est illisible
et le travail à plusieurs pénible. À faire **avant** le prochain vrai commit.

---

## 3. Déploiement — sans quoi rien n'arrive en salle

### 3.1 Dossier partagé (étape 3 de `CONTEXTE.md`) — *2 j*

Réglage du chemin, copie locale au démarrage puis périodique, publication
versionnée. **Règle non négociable :** la borne copie, puis lit sa copie. Elle
ne lit jamais directement sur le réseau — sinon une coupure réseau éteint
l'exposition.

### 3.2 Empaquetage `.exe` (étape 4) — *2 j*

`electron-builder`, démarrage automatique à l'ouverture de session, plein écran
par défaut sur le poste de la salle. Sans cela, l'installation reste un travail
de développeur — ce que personne ne fera dans un an.

### 3.3 Réglages Windows de la borne — *½ j*

Veille désactivée, pas de verrouillage, mises à jour hors heures d'ouverture.
À écrire dans une fiche que le musée pourra suivre seul.

---

## 4. Confort d'usage — ce qui fera la différence au quotidien

| Tâche | Effort | Pourquoi |
|---|---|---|
| ~~**Retour automatique à l'accueil**~~ | — | **FAIT (12 août).** `minutesAvantVeille` est branché dans `Visiteur.tsx` : après ce délai sans toucher l'écran, la page se referme sur l'accueil. Une vidéo en cours de lecture repousse le retour — le visiteur regarde, justement sans toucher. Reste possible, si le musée le demande : un vrai **écran de veille** (titre + invitation) plutôt que l'accueil. |
| **Redimensionner les images à l'import** (canvas) | 1 j | Une photo de 8 Mo copiée telle quelle alourdit le dossier et ralentit l'affichage. À faire via le navigateur — **jamais** en réintroduisant `sharp`. |
| **Image de couverture d'une vidéo** | ½ j | Sans elle, une vidéo est un rectangle noir avant lecture. Extraction par `<video>` + canvas. |
| **Réordonner les photos d'une galerie** | ½ j | Manque signalé de longue date. |
| ~~**Taille du texte réglable par bloc**~~ | — | **FAIT (18 août).** Deux boutons `A` (pas de 10 %) et une case où écrire la valeur, de 60 à 200 %. C'est un facteur : titres et paragraphes gardent leurs écarts. Champ `taille` de `StyleBloc`, déclaré dans le schéma Zod et vérifié à l'aller-retour par clé USB (`transfert.test.ts`). Les ateliers (quiz, frise) gardent leurs tailles, leurs commandes étant dimensionnées au doigt. |
| ~~**Agrandir une photo au toucher**~~ | — | **FAIT (18 août).** Toucher une photo (galerie ou bloc image) l'affiche en grand par-dessus la page ; toucher n'importe où referme. Le rendu savait déjà le demander (`surImage`), la borne ne l'écoutait pas. |
| **Dupliquer un bloc** | ¼ j | Refaire un quiz avec d'autres questions demande aujourd'hui tout ressaisir. |
| **Annuler la dernière action** | 1 j | Il n'y a aucun retour arrière dans l'éditeur. Sur un outil à enregistrement automatique, c'est le principal filet qui manque. |

---

## 5. Nettoyage

- **`apps/api`, `apps/admin`, `apps/borne`** — dossiers « réservoir » qui ne
  tournent plus. Ils contiennent encore du code contradictoire avec
  l'architecture actuelle (comptes, rôles, SQLite), ce qui égare à la lecture.
  Décider : supprimer, ou déplacer dans un dossier `archive/` clairement nommé.
  *½ j*
- **`arborescence.txt`** à supprimer (sortie brute de `tree`, en UTF-16).
- **`CONCEPTION.md`** — garder comme mémoire du raisonnement, mais son en-tête
  doit dire d'emblée quelles sections ne décrivent plus le produit.

---

## Ordre conseillé

1. ~~**1.1 hauteur des images**~~, ~~**1.2 placement sur la ligne**~~,
   ~~**2.2 écriture**~~, ~~**2.3 sauvegarde**~~, ~~**4 retour à l'accueil**~~ —
   faits.
2. ~~**1.5 texte de la case « Recadrer »**~~, ~~**1.4 aperçu du
   redimensionnement avant dépôt**~~ — faits le 18 août.
4. **2.4 fins de ligne** — avant tout autre commit, sinon l'historique se dégrade.
5. **2.1 tests** — le schéma Zod et `lecture.ts` sont couverts ; enchaîner sur
   `controles.ts`.
6. **3.2 empaquetage `.exe`** — dès que le contenu réel du musée existe.

Le reste au fil de l'eau.

---

## Ce qu'il ne faut pas faire

- **Positionnement libre au pixel** des blocs. La grille garantit que deux blocs
  ne peuvent pas se chevaucher, et qu'un vide n'apparaît que là où on l'a demandé
  (`decalage`). Cette garantie est ce qui permet à quelqu'un qui n'est pas
  graphiste de produire une page correcte du premier coup — la perdre, c'est
  perdre le produit.
- **Couper une photo sans qu'on l'ait demandé.** Une photo est entière par
  défaut ; seule la case « Recadrer » du panneau autorise le recadrage. Des
  photos coupées apparues toutes seules ont été le défaut le plus mal vécu de
  l'éditeur — ne jamais rétablir une hauteur imposée par défaut sur une image.
- **Redimensionner un bloc parce qu'on l'a déplacé.** Le glisser-déposer ne
  change une largeur que si le bloc ne rentre pas. Même remarque : c'est vécu
  comme une perte de contrôle.
- **Réintroduire un module natif** (`sharp`, `better-sqlite3`). Ils obligent à
  reconstruire à chaque montée de version de Node : personne ne le fera.
- **Un service à maintenir** (serveur, base de données). La contrainte fondatrice
  du projet est que personne ne dépannera l'installation dans un an.
- **Un champ de contenu non déclaré dans le schéma Zod.** Il est effacé
  silencieusement à l'enregistrement. Déjà rencontré deux fois.
