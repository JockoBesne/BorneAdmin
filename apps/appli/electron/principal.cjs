'use strict'

/**
 * Processus principal de l'application.
 *
 * C'est la seule partie qui a le droit de toucher au disque. L'interface, elle,
 * tourne dans une page web isolée et ne peut rien lire directement : elle passe
 * par la passerelle (electron/passerelle.cjs). Cette séparation est ce qui
 * permet d'afficher du contenu venant d'un dossier partagé sans exposer le
 * reste de l'ordinateur.
 */

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, dialog, ipcMain, net, protocol } = require('electron')

// ── Où vit le contenu ────────────────────────────────────────────────────────
// Étape 1 : le dossier d'exemple livré avec le dépôt.
// Étape 3 : ce chemin deviendra un réglage (dossier partagé du réseau, ou clé
// USB). Il est déjà lisible depuis une variable d'environnement pour pouvoir
// tester un autre dossier sans toucher au code.
const DOSSIER_CONTENU =
  process.env.BORNE_CONTENU ??
  path.join(__dirname, '..', '..', '..', 'contenu-exemple')

const FICHIER_CONTENU = path.join(DOSSIER_CONTENU, 'contenu.json')
const DOSSIER_MEDIAS = path.resolve(DOSSIER_CONTENU, 'medias')

// ── Protocole « media:// » ───────────────────────────────────────────────────
// Une page web ne peut pas lire un fichier du disque, et c'est tant mieux. On
// ouvre donc une porte étroite : « media://local/onde.jpg » sert le fichier
// « onde.jpg » du dossier des médias, et rien d'autre.
//
// Cette déclaration doit avoir lieu avant que l'application soit prête.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      // Indispensable pour la vidéo : le lecteur réclame des morceaux de
      // fichier, pas le fichier entier.
      stream: true,
      // Autorise l'interface à *lire* un média avec « fetch » (et pas seulement
      // à l'afficher) : c'est ainsi qu'on capture l'image de couverture d'une
      // vidéo à l'import. Sans cela, la lecture est refusée.
      corsEnabled: true,
    },
  },
])

async function servirMedia(requete) {
  let relatif
  try {
    relatif = decodeURIComponent(new URL(requete.url).pathname).replace(/^\/+/, '')
  } catch {
    return new Response('adresse illisible', { status: 400 })
  }

  const cible = path.resolve(DOSSIER_MEDIAS, relatif)

  // Garde-fou : un nom de fichier tordu ne doit pas permettre de remonter hors
  // du dossier des médias.
  if (cible !== DOSSIER_MEDIAS && !cible.startsWith(DOSSIER_MEDIAS + path.sep)) {
    return new Response('chemin refusé', { status: 403 })
  }

  const reponse = await net.fetch(pathToFileURL(cible).toString())

  // Le corps est transmis tel quel — la vidéo continue d'arriver par morceaux —
  // avec un en-tête de plus qui autorise la page à lire le fichier, et pas
  // seulement à l'afficher. Le protocole ne sert que notre dossier de médias.
  const entetes = new Headers(reponse.headers)
  entetes.set('Access-Control-Allow-Origin', '*')
  return new Response(reponse.body, {
    status: reponse.status,
    statusText: reponse.statusText,
    headers: entetes,
  })
}

// ── Sauvegardes ──────────────────────────────────────────────────────────────
//
// contenu.json est le seul fichier du produit : s'il est perdu, tout l'est.
// Une copie est donc mise de côté avant chaque écriture, et c'est là qu'on
// vient rechercher de quoi repartir si le fichier courant devient illisible.

const DOSSIER_SAUVEGARDES = path.join(DOSSIER_CONTENU, 'sauvegardes')

/** Au-delà, les plus anciennes sont effacées. Un contenu.json pèse quelques
 *  dizaines de kilooctets — garder plusieurs jours ne coûte rien. */
const SAUVEGARDES_MAX = 48

/** Les sauvegardes, de la plus récente à la plus ancienne. */
function sauvegardes() {
  try {
    return fs
      .readdirSync(DOSSIER_SAUVEGARDES)
      .filter((nom) => /^contenu-\d+\.json$/.test(nom))
      .sort()
      .reverse()
      .map((nom) => path.join(DOSSIER_SAUVEGARDES, nom))
  } catch {
    return []
  }
}

/**
 * Copie le contenu courant à côté, avant de l'écraser.
 *
 * **Une par heure**, et c'est le nom du fichier qui l'impose : la deuxième
 * écriture d'une même heure retombe sur un nom déjà pris et ne fait rien.
 * L'enregistrement est automatique toutes les 600 ms — sans cette retenue,
 * taper une phrase produirait cinquante copies.
 *
 * Rien ici ne doit empêcher l'enregistrement : un disque plein ou un dossier en
 * lecture seule fait perdre la sauvegarde, pas le travail en cours.
 */
function sauvegarder() {
  try {
    if (!fs.existsSync(FICHIER_CONTENU)) return
    fs.mkdirSync(DOSSIER_SAUVEGARDES, { recursive: true })

    const heure = new Date().toISOString().slice(0, 13).replace(/[-T]/g, '')
    const cible = path.join(DOSSIER_SAUVEGARDES, `contenu-${heure}.json`)
    if (fs.existsSync(cible)) return
    fs.copyFileSync(FICHIER_CONTENU, cible)

    // Le nom est de longueur fixe : l'ordre alphabétique est l'ordre du temps.
    for (const ancienne of sauvegardes().slice(SAUVEGARDES_MAX)) {
      fs.rmSync(ancienne, { force: true })
    }
  } catch (cause) {
    console.warn('Sauvegarde impossible (sans conséquence sur l’enregistrement) :', cause)
  }
}

/** Met de côté un contenu illisible. Jamais d'effacement : il est peut-être
 *  réparable à la main, et c'est le travail du musée qu'il contient. */
function ecarterContenuAbime() {
  try {
    const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
    fs.renameSync(FICHIER_CONTENU, `${FICHIER_CONTENU}.abime-${horodatage}`)
  } catch (cause) {
    console.warn('Le contenu abîmé n’a pas pu être mis de côté :', cause)
  }
}

/**
 * Contenu de départ, pour un tout premier démarrage.
 *
 * Les trois premiers réglages n'ont pas de valeur par défaut dans le schéma Zod
 * et doivent donc figurer ici. Ils reprennent `REGLAGES_DEFAUT`
 * (`packages/contenu/src/manifeste.ts`) — le processus principal ne peut pas
 * importer le paquet TypeScript, il n'est pas construit pour lui.
 */
function contenuVide() {
  return {
    version: 1,
    genereLe: new Date().toISOString(),
    reglages: {
      titreVeille: 'Musée des Transmissions',
      sousTitreVeille: "Touchez l'écran pour découvrir l'exposition",
      minutesAvantVeille: 3,
      pinAdmin: '1975',
      couleurFond: '#0e2237',
      couleurTexte: '#f5f7fa',
    },
    pages: [],
    medias: [],
  }
}

// ── Lecture du contenu ───────────────────────────────────────────────────────

/**
 * Lit le contenu, et se rattrape si le fichier ne s'ouvre pas.
 *
 * Un écran d'erreur au milieu d'une salle d'exposition n'est pas une option :
 * personne ne sera là pour le comprendre. On tente donc, dans l'ordre, le
 * fichier courant, puis les sauvegardes de la plus récente à la plus ancienne,
 * puis un contenu vide. Le fichier illisible n'est jamais effacé, seulement
 * renommé — il porte le travail du musée.
 */
function lireContenu() {
  try {
    if (fs.existsSync(FICHIER_CONTENU)) {
      return JSON.parse(fs.readFileSync(FICHIER_CONTENU, 'utf8'))
    }
  } catch (cause) {
    console.error('contenu.json illisible, reprise sur une sauvegarde :', cause)
    ecarterContenuAbime()
  }

  for (const sauvegarde of sauvegardes()) {
    try {
      const repris = JSON.parse(fs.readFileSync(sauvegarde, 'utf8'))
      console.warn('Contenu repris de', sauvegarde)
      ecrireContenu(repris)
      return repris
    } catch {
      // Sauvegarde elle-même abîmée : on essaie la précédente.
    }
  }

  const vide = contenuVide()
  ecrireContenu(vide)
  return vide
}

/**
 * Écriture du contenu, en deux temps : fichier temporaire puis renommage.
 * Une coupure de courant en pleine écriture laisse l'ancien contenu.json
 * intact — jamais un fichier à moitié écrit.
 *
 * La validation complète (schéma Zod) est faite par l'interface avant l'envoi ;
 * ici, seul un garde-fou de forme évite d'écraser le fichier avec n'importe
 * quoi si un appel arrivait par un autre chemin.
 */
function ecrireContenu(manifeste) {
  if (
    !manifeste ||
    typeof manifeste !== 'object' ||
    !Array.isArray(manifeste.pages) ||
    !Array.isArray(manifeste.medias)
  ) {
    throw new Error('Contenu refusé : forme inattendue.')
  }

  sauvegarder()

  const temporaire = FICHIER_CONTENU + '.tmp'
  const descripteur = fs.openSync(temporaire, 'w')
  try {
    fs.writeFileSync(descripteur, JSON.stringify(manifeste, null, 2) + '\n', 'utf8')
    // Le renommage seul ne suffit pas. Sans « fsync », le système peut avoir
    // enregistré le nouveau nom avant le contenu qu'il désigne : une coupure de
    // courant laisserait alors un contenu.json **vide** — exactement ce que
    // l'écriture en deux temps est censée empêcher.
    fs.fsyncSync(descripteur)
  } finally {
    fs.closeSync(descripteur)
  }
  fs.renameSync(temporaire, FICHIER_CONTENU)
}

/**
 * Un nom de fichier encore libre dans medias/. Un nom déjà pris reçoit un
 * suffixe numérique : on n'écrase jamais un média existant, qui peut être
 * utilisé par d'autres pages que celle qu'on est en train de modifier.
 *
 * Employé par les trois chemins qui écrivent dans medias/ : l'import de
 * fichiers, l'image de couverture d'une vidéo, et l'import d'une page.
 */
function nomLibre(radical, extension) {
  let nom = radical + extension
  for (let n = 2; fs.existsSync(path.join(DOSSIER_MEDIAS, nom)); n += 1) {
    nom = `${radical}-${n}${extension}`
  }
  return nom
}

/**
 * Import de médias : fenêtre de choix de fichiers, puis copie dans le dossier
 * des médias. **Plusieurs fichiers à la fois** (`multiSelections`) : préparer
 * une galerie ne doit pas demander autant d'allers-retours que de photos.
 *
 * Renvoie **la liste** des fichiers copiés, vide si l'utilisateur a annulé.
 *
 * Les dimensions et la durée sont mesurées par l'interface (moteur de la
 * fenêtre), pas ici : pas de module natif d'images (décision de CONTEXTE.md).
 */
async function importerMedia(evenement, type) {
  const filtres =
    type === 'video'
      ? [{ name: 'Vidéos', extensions: ['mp4', 'webm'] }]
      : [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]

  const fenetre = BrowserWindow.fromWebContents(evenement.sender)
  const choix = await dialog.showOpenDialog(fenetre, {
    title: type === 'video' ? 'Choisir une ou plusieurs vidéos' : 'Choisir une ou plusieurs photos',
    properties: ['openFile', 'multiSelections'],
    filters: filtres,
  })

  if (choix.canceled) return []

  return choix.filePaths.map((source) => {
    const extension = path.extname(source)
    const nom = nomLibre(path.basename(source, extension), extension)

    const cible = path.join(DOSSIER_MEDIAS, nom)
    fs.copyFileSync(source, cible)

    const octets = fs.readFileSync(cible)
    return {
      chemin: nom,
      octets: octets.length,
      empreinte: crypto.createHash('sha1').update(octets).digest('hex').slice(0, 12),
    }
  })
}

/**
 * Enregistre dans medias/ une image fabriquée par l'interface — aujourd'hui
 * l'image de couverture d'une vidéo, capturée au canvas.
 *
 * L'interface n'écrit jamais elle-même sur le disque : elle envoie des octets
 * et un nom souhaité. Le nom est **refait ici** à partir de sa seule dernière
 * partie, sans point ni séparateur : un nom venu de l'interface ne doit pas
 * pouvoir désigner un fichier hors du dossier des médias.
 */
function enregistrerImage(nomSouhaite, donneesBase64) {
  const radical =
    path
      .basename(String(nomSouhaite ?? ''))
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 60) || 'couverture'

  const nom = nomLibre(radical, '.jpg')

  const octets = Buffer.from(String(donneesBase64 ?? ''), 'base64')
  if (octets.length === 0) return null
  fs.writeFileSync(path.join(DOSSIER_MEDIAS, nom), octets)
  return { chemin: nom, octets: octets.length }
}

// ── Transport d'une page d'un ordinateur à l'autre ───────────────────────────
//
// Un export est un **dossier** « Ma page.bornepage » : un page.json et les
// médias de la page, copiés tels quels. Pas d'archive : Node n'en sait pas
// fabriquer sans dépendance, et surtout une vidéo de 300 Mo passerait alors
// entièrement en mémoire. Ici chaque fichier est copié par le système, à coût
// constant — et arrive octet pour octet, ce qui est la condition d'une page
// identique sur les deux machines.

/** Un titre de page devient un nom de dossier acceptable par Windows. */
function nomDossierExport(titre) {
  const propre = String(titre ?? '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return (propre || 'page') + '.bornepage'
}

/**
 * Écrit un dossier d'export à l'endroit choisi (typiquement une clé USB).
 * L'interface a déjà préparé le contenu du page.json et la liste des fichiers :
 * ici on ne fait qu'écrire et copier.
 */
async function exporterPage(evenement, donnees, fichiers) {
  const fenetre = BrowserWindow.fromWebContents(evenement.sender)
  const choix = await dialog.showOpenDialog(fenetre, {
    title: 'Où déposer la page ? (clé USB, dossier…)',
    buttonLabel: 'Exporter ici',
    properties: ['openDirectory', 'createDirectory'],
  })

  const parent = choix.filePaths[0]
  if (choix.canceled || !parent) return null

  // Un export déjà présent n'est pas écrasé : on ne sait pas ce qu'il contient.
  const radical = nomDossierExport(donnees?.page?.titre)
  let dossier = path.join(parent, radical)
  for (let n = 2; fs.existsSync(dossier); n += 1) dossier = path.join(parent, `${radical} (${n})`)

  fs.mkdirSync(path.join(dossier, 'medias'), { recursive: true })
  fs.writeFileSync(path.join(dossier, 'page.json'), JSON.stringify(donnees, null, 2) + '\n', 'utf8')

  for (const nom of Array.isArray(fichiers) ? fichiers : []) {
    const source = path.join(DOSSIER_MEDIAS, path.basename(String(nom)))
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(dossier, 'medias', path.basename(String(nom))))
    }
  }

  return dossier
}

/**
 * Ouvre un dossier d'export et rend son page.json tel quel. La validation est
 * faite par l'interface, avec le même schéma Zod qu'à l'écriture.
 */
async function lireExportPage(evenement) {
  const fenetre = BrowserWindow.fromWebContents(evenement.sender)
  const choix = await dialog.showOpenDialog(fenetre, {
    title: 'Choisir la page à importer (dossier « .bornepage »)',
    buttonLabel: 'Importer',
    properties: ['openDirectory'],
  })

  const dossier = choix.filePaths[0]
  if (choix.canceled || !dossier) return null

  const fichier = path.join(dossier, 'page.json')
  if (!fs.existsSync(fichier)) {
    throw new Error("Ce dossier n'est pas une page exportée : il n'y a pas de page.json.")
  }
  return { dossier, donnees: JSON.parse(fs.readFileSync(fichier, 'utf8')) }
}

/**
 * Copie dans medias/ les fichiers réclamés par un import, et dit sous quel nom
 * chacun a été rangé — un nom déjà pris est décalé, jamais écrasé.
 *
 * Les noms venus du page.json sont réduits à leur dernière partie
 * (`path.basename`) : un fichier d'export bricolé à la main ne doit pas pouvoir
 * désigner quoi que ce soit hors de ces deux dossiers.
 */
function importerMediasPage(dossier, fichiers) {
  fs.mkdirSync(DOSSIER_MEDIAS, { recursive: true })
  const correspondance = {}

  for (const brut of Array.isArray(fichiers) ? fichiers : []) {
    const nom = path.basename(String(brut))
    const source = path.join(String(dossier), 'medias', nom)
    if (!nom || !fs.existsSync(source)) continue

    const extension = path.extname(nom)
    const cible = nomLibre(path.basename(nom, extension), extension)
    fs.copyFileSync(source, path.join(DOSSIER_MEDIAS, cible))
    correspondance[nom] = cible
  }

  return correspondance
}

// ── Fenêtre ──────────────────────────────────────────────────────────────────

// Une fermeture n'est légitime que si on l'a demandée : Alt+F4 et la croix de
// la fenêtre ne doivent pas rendre le bureau au visiteur.
let sortieAutorisee = false

// Sortie de maintenance. Volontairement à quatre doigts : impossible à trouver
// par hasard, impossible à faire sur un écran tactile sans clavier.
// ponytail: une combinaison en dur suffit ; à passer derrière le code admin
// le jour où quelqu'un d'autre que vous doit pouvoir fermer la borne.
function estSortieMaintenance(entree) {
  return entree.control && entree.alt && entree.shift && entree.key.toLowerCase() === 'q'
}

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1280,
    height: 780,
    // Mode borne : plein écran sans échappatoire. « kiosk » couvre la barre des
    // tâches et neutralise F11 ; « alwaysOnTop » fait revenir la fenêtre devant
    // si Windows fait passer autre chose au premier plan.
    kiosk: true,
    alwaysOnTop: true,
    backgroundColor: '#0e2237',
    // Évite le flash blanc au démarrage : on montre la fenêtre une fois prête.
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'passerelle.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // « alwaysOnTop » seul passe sous la barre des tâches, qui remonte dès qu'on
  // effleure le bas de l'écran. Le niveau « screen-saver » est le seul à passer
  // devant elle ; il n'est pas réglable depuis le constructeur.
  fenetre.setAlwaysOnTop(true, 'screen-saver')

  fenetre.once('ready-to-show', () => fenetre.show())

  // Aucune touche ne doit ramener au bureau. On laisse passer la frappe
  // ordinaire — les champs de l'écran d'administration en ont besoin — et on
  // bloque les seules touches qui sortent de l'application ou la rechargent.
  fenetre.webContents.on('before-input-event', (evenement, entree) => {
    if (entree.type !== 'keyDown') return

    if (estSortieMaintenance(entree)) {
      sortieAutorisee = true
      app.quit()
      return
    }

    const touche = entree.key
    const interdite =
      touche === 'F11' ||
      touche === 'F5' ||
      touche === 'Escape' ||
      (entree.alt && touche === 'F4') ||
      (entree.control && ['r', 'w', 'n'].includes(touche.toLowerCase())) ||
      (entree.control && entree.shift && ['i', 'j', 'c'].includes(touche.toLowerCase()))

    if (interdite) evenement.preventDefault()
  })

  // Windows a ses propres gestes : trois ou quatre doigts vers le bas replient
  // la fenêtre (ou tout le bureau), et le visiteur se retrouve devant le bureau
  // de Windows. Le geste ne se désactive pas depuis l'application — on remonte
  // donc la fenêtre aussitôt qu'elle est repliée. C'est la même règle que pour
  // les touches : rien ne doit ramener au bureau.
  //
  // « minimize » ne se refuse pas (contrairement à « close ») : la fenêtre
  // descend puis remonte, le clignotement est le prix à payer.
  fenetre.on('minimize', () => {
    if (sortieAutorisee) return
    fenetre.restore()
    fenetre.focus()
    // Le repli a fait perdre le niveau « écran de veille » : sans cela, la
    // fenêtre remonte **derrière** la barre des tâches.
    fenetre.setAlwaysOnTop(true, 'screen-saver')
  })

  // Alt+F4 est parfois traité par Windows avant d'arriver à la page : le refus
  // de fermeture est la garde qui tient dans tous les cas.
  fenetre.on('close', (evenement) => {
    if (!sortieAutorisee) evenement.preventDefault()
  })

  void fenetre.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  // Un dossier de contenu tout neuf n'a pas encore de medias/ : le créer ici
  // évite que le premier import échoue sur une installation fraîche.
  fs.mkdirSync(DOSSIER_MEDIAS, { recursive: true })

  protocol.handle('media', servirMedia)
  ipcMain.handle('contenu:lire', () => lireContenu())
  ipcMain.handle('contenu:ecrire', (_evenement, manifeste) => ecrireContenu(manifeste))
  ipcMain.handle('medias:importer', (evenement, type) =>
    importerMedia(evenement, type === 'video' ? 'video' : 'image'),
  )
  ipcMain.handle('medias:enregistrer-image', (_evenement, nom, donneesBase64) =>
    enregistrerImage(nom, donneesBase64),
  )
  ipcMain.handle('page:exporter', (evenement, donnees, fichiers) =>
    exporterPage(evenement, donnees, fichiers),
  )
  ipcMain.handle('page:lire-export', (evenement) => lireExportPage(evenement))
  ipcMain.handle('page:importer-medias', (_evenement, dossier, fichiers) =>
    importerMediasPage(dossier, fichiers),
  )
  // Fermeture demandée par l'écran d'administration (Ctrl + Maj + A). C'est
  // l'interface qui décide : le raccourci n'existe que dans l'administration,
  // jamais devant un visiteur.
  ipcMain.handle('app:quitter', () => {
    sortieAutorisee = true
    app.quit()
  })
  creerFenetre()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
  })
})

app.on('window-all-closed', () => app.quit())
