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

### 1.2 Placer un bloc sur sa ligne — *½ j*

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

1. ~~**1.1 hauteur des images**~~, ~~**2.2 écriture**~~, ~~**2.3 sauvegarde**~~,
   ~~**4 retour à l'accueil**~~ — faits.
2. **2.4 fins de ligne** — avant tout autre commit, sinon l'historique se dégrade.
3. **2.1 tests** — le schéma Zod est couvert ; enchaîner sur `controles.ts`.
4. **1.2 placement sur la ligne** — court, et complète la mise en page.
5. **3.2 empaquetage `.exe`** — dès que le contenu réel du musée existe.

Le reste au fil de l'eau.

---

## Ce qu'il ne faut pas faire

- **Positionnement libre au pixel** des blocs. La grille garantit qu'une page ne
  peut ni se trouer ni faire se chevaucher deux blocs. Cette garantie est ce qui
  permet à quelqu'un qui n'est pas graphiste de produire une page correcte du
  premier coup — la perdre, c'est perdre le produit.
- **Réintroduire un module natif** (`sharp`, `better-sqlite3`). Ils obligent à
  reconstruire à chaque montée de version de Node : personne ne le fera.
- **Un service à maintenir** (serveur, base de données). La contrainte fondatrice
  du projet est que personne ne dépannera l'installation dans un an.
- **Un champ de contenu non déclaré dans le schéma Zod.** Il est effacé
  silencieusement à l'enregistrement. Déjà rencontré deux fois.
