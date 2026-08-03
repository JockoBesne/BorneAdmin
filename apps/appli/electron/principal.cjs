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
    },
  },
])

function servirMedia(requete) {
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

  return net.fetch(pathToFileURL(cible).toString())
}

// ── Lecture du contenu ───────────────────────────────────────────────────────

function lireContenu() {
  const brut = fs.readFileSync(FICHIER_CONTENU, 'utf8')
  return JSON.parse(brut)
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
  const temporaire = FICHIER_CONTENU + '.tmp'
  fs.writeFileSync(temporaire, JSON.stringify(manifeste, null, 2) + '\n', 'utf8')
  fs.renameSync(temporaire, FICHIER_CONTENU)
}

/**
 * Import d'un média : fenêtre de choix de fichier, puis copie dans le dossier
 * des médias. Un nom déjà pris reçoit un suffixe numérique — on n'écrase
 * jamais un média existant, qui peut être utilisé par d'autres pages.
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
    title: type === 'video' ? 'Choisir une vidéo' : 'Choisir une photo',
    properties: ['openFile'],
    filters: filtres,
  })

  const source = choix.filePaths[0]
  if (choix.canceled || !source) return null

  const extension = path.extname(source)
  const radical = path.basename(source, extension)
  let nom = radical + extension
  for (let n = 2; fs.existsSync(path.join(DOSSIER_MEDIAS, nom)); n += 1) {
    nom = `${radical}-${n}${extension}`
  }

  const cible = path.join(DOSSIER_MEDIAS, nom)
  fs.copyFileSync(source, cible)

  const octets = fs.readFileSync(cible)
  return {
    chemin: nom,
    octets: octets.length,
    empreinte: crypto.createHash('sha1').update(octets).digest('hex').slice(0, 12),
  }
}

// ── Fenêtre ──────────────────────────────────────────────────────────────────

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1280,
    height: 780,
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

  fenetre.once('ready-to-show', () => fenetre.show())

  // Plein écran à la demande. Sur le poste de la salle, ce sera l'état de
  // départ ; pendant le développement, une fenêtre est plus commode.
  fenetre.webContents.on('before-input-event', (evenement, entree) => {
    if (entree.type !== 'keyDown') return
    if (entree.key === 'F11') {
      fenetre.setFullScreen(!fenetre.isFullScreen())
      evenement.preventDefault()
    } else if (entree.key === 'Escape' && fenetre.isFullScreen()) {
      fenetre.setFullScreen(false)
      evenement.preventDefault()
    }
  })

  void fenetre.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  protocol.handle('media', servirMedia)
  ipcMain.handle('contenu:lire', () => lireContenu())
  ipcMain.handle('contenu:ecrire', (_evenement, manifeste) => ecrireContenu(manifeste))
  ipcMain.handle('medias:importer', (evenement, type) =>
    importerMedia(evenement, type === 'video' ? 'video' : 'image'),
  )
  creerFenetre()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
  })
})

app.on('window-all-closed', () => app.quit())
