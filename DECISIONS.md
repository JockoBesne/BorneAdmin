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
