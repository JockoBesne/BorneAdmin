# Appli Expositions — état du prototype

*Mis à jour le 2026-08-03. Ce fichier est la source de vérité sur l'état réel du projet. `CONCEPTION.md` décrit une architecture qui a été abandonnée en partie — voir « Décisions actées ».*

## Décision d'architecture du 03/08/2026 — à lire en premier

> **Correction du 04/08/2026 — le point 1 ci-dessous était faux.** Il n'y a
> **qu'un seul ordinateur** : celui de la salle, branché à l'écran tactile par
> HDMI. Le contenu se prépare **sur ce même ordinateur**. L'écran tactile n'est
> qu'un moniteur, sans stockage ni système.
>
> Conséquence : **il n'y a rien à synchroniser**, et l'**étape 3 (dossier
> partagé, copie périodique, publication versionnée) devient sans objet** — voir
> « Ce qui reste à faire — après ». Le choix de l'application Electron unique,
> lui, reste le bon : il est même renforcé (un seul programme, un seul poste,
> aucun service réseau).

Le projet **abandonne l'architecture client/serveur** décrite dans `CONCEPTION.md` (API Fastify + SQLite + agent de synchronisation) au profit d'une **application Electron unique**, installée deux fois : en mode administration sur le PC du bureau, en mode visiteur plein écran sur le PC de la salle d'exposition.

**Pourquoi.** Deux contraintes ont été confirmées avec l'utilisateur :

1. Le personnel prépare le contenu **depuis un PC de bureau relié au réseau** du musée.
2. **Personne** n'installera ni ne dépannera l'application dans un an — ni informaticien du musée, ni prestataire.

Un dossier partagé Windows fait le lien bureau↔salle aussi bien qu'un serveur HTTP, sans service à maintenir, sans port, sans module natif à reconstruire à chaque montée de version de Node. La seconde contrainte tranche : un service Windows qui ne redémarre pas après une coupure de courant, sans personne pour le relancer, c'est une exposition éteinte.

S'ajoute le fait que le code de `CONCEPTION.md` **n'avait jamais été exécuté** (aucun `node_modules`, aucun dossier `donnees/`, un seul commit) : le coût de bascule était bien plus faible qu'il n'y paraissait.

**Règle non négociable conservée de `CONCEPTION.md` §7.1 :** la borne **copie** le contenu depuis le dossier partagé au démarrage puis périodiquement. Elle ne lit jamais directement sur le réseau, et affiche donc la dernière version reçue même réseau coupé ou PC du bureau éteint.

**Effet de bord voulu :** le « plan B clé USB » (§14.5) et le mode réseau deviennent le même chemin de code, à un réglage de chemin près. Le risque R1 du registre des risques disparaît.

## Matériel confirmé

*Mis à jour le 2026-08-04 : un seul ordinateur, résolution confirmée.*

- **Un seul ordinateur** Windows 11, en salle d'exposition. C'est lui qui fait
  tout : affichage visiteur **et** préparation du contenu.
- L'**écran tactile n'est pas un appareil autonome** : c'est un simple moniteur,
  HDMI pour l'image, USB pour le toucher. Il n'a ni stockage ni système.
- Résolution **1920×1080 paysage — confirmée**. C'est bien l'hypothèse de la
  toile de rendu (`ToileBorne`) et des trois modèles.
- Pas de second PC : le personnel branche clavier et souris sur l'ordinateur de
  la salle le temps de modifier, puis le laisse en mode visiteur.

## Stack

Monorepo **npm workspaces**, TypeScript strict (`tsconfig.base.json` : `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUnusedLocals`).

- **`apps/appli`** — **nouveau, c'est ici que se fait le travail.** Application Electron unique. `electron/principal.cjs` (processus principal : fenêtre, protocole `media://`, lecture disque), `electron/passerelle.cjs` (contextBridge — la seule surface exposée à l'interface), `src/` (interface React 19 + Vite).
- **`packages/contenu`** — **conservé intégralement.** Modèle de contenu : 3 modèles de page à emplacements typés, schémas Zod, composants de rendu partagés. C'est le cœur du produit et la partie la plus précieuse de l'ancien prototype.
- **`packages/ui`** — **conservé**, sera utilisé par le mode administration.
- **`apps/admin`** — ancien front d'administration. **Ne tourne plus**, gardé comme réservoir : les écrans (`pages/`, `editeur/`) seront repris dans `apps/appli`, seul `api.ts` étant remplacé par des accès disque.
- **`apps/borne`** — ancienne application borne. **Ne tourne plus**, gardée comme réservoir (écrans veille / sommaire / visionneuse).
- **`apps/api`** — **abandonné.** Fastify, SQLite, sessions, CSRF, rôles, journal d'audit. Rien de tout cela n'est repris. Le dossier n'est pas supprimé pour l'instant.

Le stockage devient : un fichier `contenu.json` + un dossier `medias/`. Pas de base de données. Sauvegarde = copier un dossier ; restauration = le coller ; retour arrière = garder les N derniers dossiers publiés datés.

## Arborescence des nouveaux fichiers

```
BorneAdmin/
├── apps/appli/                     ← l'application
│   ├── electron/
│   │   ├── principal.cjs           processus principal, protocole media://
│   │   └── passerelle.cjs          contextBridge (surface exposée à l'interface)
│   ├── src/
│   │   ├── principal.tsx           point d'entrée React
│   │   ├── Visiteur.tsx            mode visiteur (étape 1, minimal)
│   │   ├── contenu.ts              chargement + validation Zod + résolution des médias
│   │   ├── appli.css               habillage de la fenêtre
│   │   └── passerelle.d.ts         typage de window.borne
│   ├── index.html, package.json, tsconfig.json, vite.config.ts
└── contenu-exemple/                ← jeu de test (préfigure le dossier partagé)
    ├── contenu.json                3 pages, une par modèle
    └── medias/                     onde.jpg, galerie-1..3.jpg, demo.mp4, demo-couverture.jpg
```

## Ce qui fonctionne déjà

- `packages/contenu` et `packages/ui` : code complet, jamais exécuté.
- `contenu-exemple/contenu.json` : **validé** contre le schéma `schemaManifeste` et contre les contraintes des 3 modèles (emplacements requis, limites de signes, références de médias, présence des fichiers sur le disque). 0 erreur.
- `electron/principal.cjs` et `electron/passerelle.cjs` : syntaxe vérifiée (`node --check`).

## Ce qui reste à faire — étape 1

**L'étape 1 n'a jamais été lancée. Le build n'a pas pu être vérifié** (pas d'accès au registre npm depuis l'environnement où ces fichiers ont été écrits). C'est le premier travail à faire.

1. **Enregistrer `apps/appli` dans les workspaces** de `package.json` à la racine. Recommandation : réduire la liste à `["packages/contenu", "packages/ui", "apps/appli"]` — retirer `apps/api` évite d'installer `better-sqlite3` et `sharp`, deux modules natifs inutiles désormais. `apps/admin` et `apps/borne` peuvent aussi sortir de la liste : leurs fichiers restent sur le disque comme réservoir.
2. Remplacer les scripts de la racine qui pointent vers `@borne/api` (`dev`, `init`, `build`, `demarrer`) — ils ne fonctionnent plus. Prévoir `"appli": "npm run demarrer -w @borne/appli"` et `"verifier": "tsc -p apps/appli/tsconfig.json"`.
3. `npm install` à la racine, puis `npm run demarrer -w @borne/appli` (= `vite build && electron .`).
4. **Corriger ce qui casse.** Points de vigilance identifiés mais non testés :
   - le protocole `media://` et la lecture **vidéo** — le lecteur réclame des morceaux de fichier (requêtes de plage), c'est le point le plus incertain ; si la vidéo ne démarre pas, les images doivent quand même s'afficher ;
   - `optimizeDeps.exclude` dans `vite.config.ts` doit suffire à faire compiler `@borne/contenu` (TypeScript source relié par workspace) ;
   - `base: './'` dans `vite.config.ts` est indispensable, sinon Electron affiche une page blanche.

**Test de réussite de l'étape 1 :** la fenêtre s'ouvre, les 3 pages d'exemple s'affichent correctement mises en page, on passe de l'une à l'autre. F11 bascule en plein écran, Échap en sort.

## Ce qui reste à faire — après

- **Étape 2** — ~~mode administration dans la même application~~ — **FAITE**
  (accès caché, éditeur en place, gestion des pages, import de médias).
- **Étape 3** — ~~dossier partagé~~ — **SANS OBJET depuis le 04/08/2026.** Il n'y
  a qu'un seul ordinateur : le contenu est créé et affiché au même endroit, il
  n'y a donc rien à synchroniser ni à publier vers un autre poste. *Ce qui
  reste utile de cette étape, mais pour une autre raison :* une **sauvegarde**
  du contenu (copie datée sur clé USB ou dossier réseau), pour se prémunir d'une
  panne de disque ou d'une fausse manœuvre — pas pour transporter le contenu.
- **Étape 4** — empaquetage `.exe` (electron-builder), démarrage automatique, mode plein écran par défaut sur le poste de la salle. **C'est désormais la seule grande étape restante.**
- Redimensionnement des images à l'import **via le canvas du navigateur**, pour ne pas réintroduire `sharp` (dernier module natif).

## Dette à traiter

- **Fins de ligne (à faire avant tout vrai commit).** Les 92 fichiers suivis par Git apparaissent tous « modifiés » avec autant d'insertions que de suppressions : c'est du CRLF/LF, pas du contenu. Aucun `.gitattributes`, aucun `core.autocrlf` configuré. Tant que ce n'est pas corrigé, l'historique Git est illisible.
- `arborescence.txt` à la racine (UTF-16, sortie brute de `tree`) — à supprimer.
- Aucun test automatisé, malgré le plan de tests de `CONCEPTION.md` §19.
- `DECISIONS.md` n'existe pas ; la décision ci-dessus devrait y être recopiée.

## Sections de CONCEPTION.md devenues obsolètes

À ne plus citer comme référence sans vérification : **7** (architecture), **8** (diagrammes), **9** (schéma de base de données), **10** (structure des dossiers), **11** (API HTTP), **13.7** (rôles et permissions), **14** (synchronisation borne), **17** (sécurité serveur), **20** (planning), **21.5/21.8/21.9/21.12** (TanStack Query, Fastify, sessions, SQLite).

Restent pleinement valables : **1** (vision produit), **2** (besoins), **3** (personas), **4** (parcours), **5** (wireframes), **6** (design system), **7.5** (modèle de contenu), **12** (composants UI), **15** (gestion des médias), **18** (performances), **19** (plan de tests), **22** (évolutions V2).

## Questions ouvertes

**Tranchées le 04/08/2026 :**

- ~~Résolution et orientation de l'écran~~ → **1920×1080 paysage, confirmé.**
- ~~Emplacement du dossier partagé~~ → **sans objet, un seul ordinateur.** Reste
  à définir avec le musée la **politique de sauvegarde** du contenu (copie datée
  sur clé USB ou dossier réseau), qui est un besoin différent.

**Encore ouvertes :**
- Faut-il conserver le format `Manifeste` actuel (hérité de l'API : `version`, `genereLe`, `empreinte`, plusieurs profils par média) ou le simplifier maintenant qu'il n'y a plus de serveur ? Il a été conservé tel quel à l'étape 1 pour réutiliser la validation Zod et le résolveur de médias existants.
- Faut-il supprimer `apps/api` du disque, ou le garder en référence ?
