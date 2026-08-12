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
 * Import de médias : fenêtre de choix de fichiers, puis copie dans le dossier
 * des médias. **Plusieurs fichiers à la fois** (`multiSelections`) : préparer
 * une galerie ne doit pas demander autant d'allers-retours que de photos. Un
 * nom déjà pris reçoit un suffixe numérique — on n'écrase jamais un média
 * existant, qui peut être utilisé par d'autres pages.
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

  let nom = `${radical}.jpg`
  for (let n = 2; fs.existsSync(path.join(DOSSIER_MEDIAS, nom)); n += 1) {
    nom = `${radical}-${n}.jpg`
  }

  const octets = Buffer.from(String(donneesBase64 ?? ''), 'base64')
  if (octets.length === 0) return null
  fs.writeFileSync(path.join(DOSSIER_MEDIAS, nom), octets)
  return { chemin: nom, octets: octets.length }
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

  // Alt+F4 est parfois traité par Windows avant d'arriver à la page : le refus
  // de fermeture est la garde qui tient dans tous les cas.
  fenetre.on('close', (evenement) => {
    if (!sortieAutorisee) evenement.preventDefault()
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
  ipcMain.handle('medias:enregistrer-image', (_evenement, nom, donneesBase64) =>
    enregistrerImage(nom, donneesBase64),
  )
  creerFenetre()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
  })
})

app.on('window-all-closed', () => app.quit())
