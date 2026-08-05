# Journal des décisions

Décisions structurantes du projet, avec leur raison. Le détail de l'architecture
reste dans `CONTEXTE.md` ; ce fichier en donne la trace courte et durable.
Format : **contexte → décision → pourquoi**.

---

## 2026-08-03 — Architecture : application Electron unique

**Contexte.** `CONCEPTION.md` prévoyait un client/serveur (API Fastify + SQLite +
agent de synchronisation).

**Décision.** Abandon du client/serveur au profit d'une **application Electron
unique**, installée deux fois : mode administration sur le PC du bureau, mode
visiteur plein écran sur le PC de la salle. Un **dossier partagé Windows** fait le
lien. Stockage = un `contenu.json` + un dossier `medias/`, pas de base de données.

**Pourquoi.** Le contenu se prépare depuis un PC de bureau du musée, et **personne
ne dépannera** l'installation dans un an. Un service Windows qui ne redémarre pas
après une coupure, sans personne pour le relancer, c'est une exposition éteinte.
Détail complet dans `CONTEXTE.md` (à recopier ici au besoin).

## 2026-08-03 — Les pages défilent (plus de rognage)

**Contexte.** Chaque page était contrainte à un écran exact (1920×1080) ; tout ce
qui dépassait était coupé — ce qui rognait les images pour faire tenir le texte.

**Décision.** La toile est mise à l'échelle sur sa **largeur** seule ; une page
peut être plus haute qu'un écran et **défiler** au doigt. Les images gardent leurs
proportions et ne sont jamais rognées.

**Pourquoi.** Corrige le défaut d'affichage, et surtout **rend possible l'ajout de
blocs** : une page à hauteur libre n'a plus de limite imposée.

## 2026-08-03 — Accès admin par code, non sécurisé (assumé)

**Contexte.** Le personnel doit accéder à l'administration depuis la borne.

**Décision.** Coin haut-droit invisible, appui maintenu **5 secondes**, puis code
à 4 chiffres (`reglages.pinAdmin`, défaut `1975`). Le code est **en clair** dans
`contenu.json`.

**Pourquoi.** Écarte un visiteur curieux sans rien à installer. **Ce n'est pas une
sécurité** et ne doit pas être présenté comme telle au musée — quiconque a le
clavier de la borne peut de toute façon en sortir.

## 2026-08-03 — Blocs libres en « suite », mise en page du modèle préservée

**Contexte.** L'utilisateur veut ajouter/retirer des blocs dans une page. Une
première piste envisageait de convertir les 3 modèles en listes de blocs
entièrement libres.

**Décision.** Chaque page **garde la mise en page garantie de son modèle** ; la
liberté s'exerce dans une **`suite`** de blocs ajoutés, ancrés après une section
du modèle (champ `apres`). Les blocs se déplacent, y compris entre les
emplacements du modèle.

**Pourquoi.** Préserve les garanties de mise en page (colonnes du modèle 2, vidéo
en surimpression du modèle 3), et surtout **le contenu existant reste valide sans
conversion** — une page sans bloc ajouté ne change pas d'un octet.

## 2026-08-03 — Lecteur vidéo tactile : toute la vidéo est la cible

**Contexte.** Sur la borne, les commandes natives d'une balise vidéo (petit bouton
lecture, barre de progression) sont difficiles à viser au doigt, et sur le modèle
« Vidéo en avant » la barre passe même sous la navigation.

**Décision.** Supprimer les commandes natives : **toute la vidéo est un bouton**
(toucher = lire, retoucher = pause). Un grand ▶ marque l'arrêt.

**Pourquoi.** Cible tactile fiable pour une borne. Les clips sont courts (le film
complet est projeté en salle) : une barre de progression n'est pas nécessaire.

## 2026-08-03 — Couleurs : global + par page (cumulés)

**Contexte.** L'utilisateur veut régler les couleurs (fond, texte), et que chaque
page puisse avoir les siennes.

**Décision.** Garder un **réglage global** (valeur par défaut de toute la borne)
**et** ajouter un réglage **par page** dans l'éditeur ; la page l'emporte sur le
global quand elle est personnalisée. Les couleurs par page seront **facultatives**
(absentes = suit le global).

**Pourquoi.** Le plus souple pour l'utilisateur, sans casser le thème d'ensemble
ni les contenus existants. *(Réalisé : couleurs par page facultatives sur
`PageManifeste`, réglées depuis l'éditeur, avec retour au thème global.)*

## 2026-08-03 — Pas de module natif pour les médias

**Contexte.** Redimensionner les images / lire les dimensions d'un média.

**Décision.** Tout se fait via le **moteur du navigateur** (canvas, `<img>`,
`<video>`), jamais via un module natif type `sharp`.

**Pourquoi.** Un module natif se recompile à chaque montée de version de Node /
Electron — fragile pour une installation que personne ne maintiendra.

## 2026-08-05 — Habillage d'un bloc : un seul rangement, par nom de bloc

**Contexte.** L'utilisateur veut personnaliser un bloc depuis l'éditeur : fond
du bloc, et mise en forme de son texte (gras, italique, souligné, alignement,
couleur). La liste de droite mélange les blocs du modèle et les blocs ajoutés.

**Décision.** Un seul champ facultatif, `contenu.styles`, rangé **par nom de
bloc** : le nom de l'emplacement pour un bloc du modèle, `suite:<identifiant>`
pour un bloc ajouté. C'est déjà le nom qu'emploient l'éditeur et l'enveloppe du
rendu.

**Pourquoi.** L'autre voie — un champ `style` sur `BlocLibre` et un rangement à
part pour les emplacements — obligeait à tenir deux chemins pour un réglage
unique. Un seul rangement donne un seul point d'application dans le rendu
(`Habillage`), donc un aperçu fidèle sans rien tenir en double. L'habillage
d'un bloc retiré part avec lui, et un habillage remis à zéro est effacé : une
page qu'on personnalise puis qu'on remet comme avant retrouve son fichier
d'origine.

## 2026-08-05 — Un seul panneau par bloc, ouvert sous lui

**Contexte.** Le formulaire de contenu d'un bloc (son texte, sa photo, les
réponses de son quiz…) s'affichait tout en bas du panneau de droite, loin du
bloc cliqué. La personnalisation, elle, venait d'être ajoutée sous le bloc :
deux endroits pour un même bloc.

**Décision.** **Tout** ce qui concerne un bloc s'ouvre sous lui, dans un seul
panneau. Plus rien en bas de la colonne. Le panneau se ferme par une croix ou en
recliquant le bloc — la même action que celle qui l'a ouvert.

*(L'ordre a été inversé depuis : la barre d'outils passe **avant** le contenu —
voir l'entrée « Barre d'outils » plus bas.)*

**Pourquoi.** On modifie le bloc là où on vient de le cliquer, sans chercher
ailleurs dans la colonne où le réglage a pu s'afficher. Deux conséquences à
connaître :

- l'`autoFocus` des formulaires est devenu `focus({ preventScroll: true })` :
  sinon, ouvrir un bloc emportait la vue jusqu'au champ, par-dessus le panneau
  qui venait de se déplier ;
- à l'ouverture, c'est la **ligne entière** (le bloc *et* son panneau) qu'on
  amène dans la vue, pas le panneau seul : un panneau plus haut que la colonne
  se collerait en haut et chasserait de l'écran le bloc qu'on vient de cliquer.

## 2026-08-05 — Texte enrichi : la mise en forme se pose dans le champ

**Contexte.** Un texte se tapait avec des marques : `**gras**`, `_italique_`.
Il fallait donc connaître cette écriture, et le champ montrait des étoiles là où
la page montre du gras.

**Décision.** Le champ d'un bloc de texte devient un vrai éditeur : on
sélectionne un morceau, on clique **G / I / S**, et le champ l'affiche mis en
forme. Les trois boutons de la personnalisation agissent, sur un bloc de texte,
**sur la sélection** — pas sur le bloc entier.

**Pourquoi.** Ce qu'on voit dans le champ est ce que le visiteur verra. Personne
n'a plus à apprendre une écriture, et « ce mot est en gras » cesse d'être
confondu avec « ce bloc est en gras ».

**Comment, et pourquoi comme ça.**

- Le texte est rangé en **morceaux marqués** (`lignes`), jamais en HTML. La
  règle « aucun HTML n'entre dans le contenu » tient donc toujours : le champ
  est relu nœud par nœud, et un collage est réinséré en texte brut.
- `valeur` reste le texte **sans** mise en forme. Tout ce qui s'appuyait dessus
  — compteur de signes, contrôles avant publication, « ce bloc est-il vide ? »,
  résumé dans la liste — continue de marcher sans être touché.
- `lignes` est **facultatif** dans les deux sens : les textes déjà écrits sont
  relus de l'ancienne écriture (et convertis au premier passage dans
  l'éditeur), et un texte sans mise en forme n'écrit rien de plus.
- Les listes ne changent pas de règle : une ligne commençant par « - » reste une
  puce, dans le champ comme sur la page.
- Le champ est **maître de son contenu** : son texte n'est posé qu'à
  l'ouverture. Le réécrire à chaque rendu, comme le fait un champ contrôlé de
  React, replacerait le curseur au début à chaque lettre.

## 2026-08-05 — Barre d'outils au-dessus du champ, sans mode d'emploi

**Contexte.** Les réglages d'un bloc s'affichaient sous son champ de saisie, en
gros boutons en pastille, accompagnés de phrases expliquant comment s'en servir
(« Sélectionnez un mot, puis G / I / S… », plus le `conseil` du modèle).

**Décision.** Les réglages passent **au-dessus** du champ, ramassés en une
**barre d'outils** de boutons carrés — gras, italique, souligné | alignement |
couleur du texte, fond du bloc — séparés par un filet, à la manière d'un
traitement de texte. Aucune règle d'utilisation n'est écrite dans le panneau :
les `conseil` des modèles ne sont plus affichés.

**Pourquoi.** C'est la disposition que le personnel du musée connaît déjà : les
icônes se reconnaissent sans être expliquées. Au-dessus du champ, les boutons
restent en vue pendant la saisie, au lieu de descendre avec un texte qui
s'allonge.

**À savoir.** Les boutons font 28 px, et non les 32 des autres boutons de
l'administration : c'est ce qui fait tenir les huit commandes sur une seule
ligne, y compris dans le panneau resserré d'un bloc ajouté. On vise à la souris,
sur le PC du bureau — la borne, elle, n'a pas d'administration. Les icônes
d'alignement sont **dessinées** en SVG : les caractères d'alignement d'Unicode
manquent à beaucoup de polices et s'afficheraient en carrés vides.

## 2026-08-05 — La barre appartient au champ texte, pas au panneau

**Contexte.** La barre de mise en forme était posée par le panneau, en tête. Sur
un bloc photo ou galerie, on ne savait plus à quoi elle se rapportait ni où elle
devait aller.

**Décision.** La barre devient un composant que le **formulaire** place lui-même,
juste au-dessus de son champ texte. Chaque champ texte principal porte donc sa
barre. Portée retenue : les champs principaux — texte, titre, légende, question
du quiz, consigne de la frise ; les listes qui se répètent (chaque réponse,
chaque événement) suivent la mise en forme du bloc.

**Pourquoi.** La place de la barre n'est plus une question : elle est là où on
écrit. Et comme chaque type de bloc n'a qu'un seul champ texte principal, cette
règle ne multiplie pas les barres — il y en a toujours **une par bloc**, et les
réglages continuent de porter sur le bloc entier (d'où « couleur du fond du
bloc »). Deux blocs n'ont pas de champ où l'accrocher : la galerie et une photo
ou vidéo pas encore choisie. La barre y prend la tête du formulaire.

**Piège rencontré.** Envelopper le champ et sa barre dans un `<label>` casse
tout : un libellé désigne son **premier élément de formulaire**, qui devient
alors un bouton de la barre au lieu de la zone de saisie — cliquer le mot
« Titre » enfonçait une commande de mise en forme, et l'écrivait sur le disque.
Ces champs sont donc des `<div>`, avec un `aria-label` sur la saisie.

**Formulations.** « Personnalisation » disparaît (la barre se comprend seule),
« Fond du bloc » devient « Couleur du fond du bloc », et « Remettre ce bloc comme
les autres » devient « **Rétablir par défaut** ». « Apparence » a été écarté pour
le titre de section : le nom est déjà pris par les réglages généraux de la borne.

## 2026-08-05 — Le champ et sa barre ne font qu'un composant

**Contexte.** La barre de mise en forme restait un élément que chaque formulaire
plaçait à la main. Rien n'empêchait de l'oublier, de la mettre au mauvais
endroit, ou de l'afficher là où il n'y a rien à écrire.

**Décision.** Un seul composant, `ChampMisEnForme`, réunit le libellé, la barre,
la saisie et le compteur. La barre ne s'obtient qu'en passant par lui.

**Pourquoi.** « Pas de champ texte, pas de barre » devient vrai par
construction, et non par vigilance. La galerie, le quiz, la frise et une photo
ou vidéo pas encore choisie n'ont donc plus de barre du tout.

**Conséquence assumée.** Ces blocs ne se règlent plus depuis l'éditeur : ni
couleur de fond, ni alignement. Un habillage déjà enregistré sur l'un d'eux
continue de s'afficher, mais ne peut plus être modifié ni remis à zéro. C'était
le choix demandé : la barre n'a de sens qu'à côté d'un texte.

## 2026-08-05 — Les largeurs incluent marges et bordure (`box-sizing`)

**Contexte.** Les champs du quiz et de la frise sortaient de leur cadre de 13 px
de chaque côté, et le panneau se mettait à défiler horizontalement.

**Décision.** `appli.css` pose désormais `box-sizing: border-box` sur tout, comme
le fait déjà le rendu de la borne (`modeles.css`).

**Pourquoi.** La feuille de l'application ne l'avait jamais posée : un champ en
`width: 100 %` avec 12 px de marge intérieure et 1 px de bordure mesurait donc
26 px de plus que son conteneur. Corriger champ par champ aurait laissé le piège
en place pour le suivant.

## 2026-08-05 — Barre de défilement des champs texte

**Contexte.** La barre du système est large et posée sur un fond clair, qui
tranche dans un panneau sombre.

**Décision.** Barre reprise en entier pour les champs texte de l'administration :
fine (10 px), sans fond, curseur à la couleur d'accent, **flèches conservées** en
haut et en bas.

**Pourquoi.** Elle se fond dans le panneau, et les flèches restent utiles à la
souris sur le PC du bureau.

**À savoir.** Dès qu'on habille une barre par `::-webkit-scrollbar`, le
navigateur **retire ses boutons par défaut** : les flèches sont donc dessinées à
la main, en SVG glissé dans `background-image`. Le sélecteur `:single-button` est
indispensable — sans lui, une paire de boutons apparaît à chaque bout.
