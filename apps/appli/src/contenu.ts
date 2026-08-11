import {
  schemaManifeste,
  type Manifeste,
  type MediaManifeste,
  type ProfilImage,
} from '@borne/contenu'
import type { MediaResolu, ResoudreMedia } from '@borne/contenu/rendu'

/**
 * Chargement du contenu depuis le disque, par la passerelle.
 *
 * Le fichier contenu.json ne connaît que des noms de fichiers ordinaires
 * (« onde.jpg »). C'est ici, et seulement ici, qu'ils deviennent des adresses
 * « media:// » servies par le processus principal. Le contenu reste donc
 * lisible et transportable : on peut l'ouvrir dans un éditeur de texte, le
 * copier sur une clé USB, le poser dans un dossier partagé.
 */

const PROTOCOLE_MEDIA = 'media://local/'

export async function chargerContenu(): Promise<Manifeste> {
  const brut = await window.borne.lireContenu()

  // Validé à la lecture : un contenu abîmé est refusé avant d'être affiché,
  // jamais après. Mieux vaut un message clair qu'une page à moitié dessinée.
  return schemaManifeste.parse(brut)
}

/**
 * Enregistre le contenu sur le disque. Validé par le même schéma qu'à la
 * lecture, *avant* d'écrire : ce qui part sur le disque est toujours un
 * contenu que l'application saura relire.
 */
export async function enregistrerContenu(manifeste: Manifeste): Promise<void> {
  const estampille = { ...manifeste, genereLe: new Date().toISOString() }
  await window.borne.ecrireContenu(schemaManifeste.parse(estampille))
}

function mesurerImage(url: string): Promise<{ largeur: number | null; hauteur: number | null }> {
  return new Promise((resoudre) => {
    const image = new Image()
    image.onload = () => resoudre({ largeur: image.naturalWidth, hauteur: image.naturalHeight })
    image.onerror = () => resoudre({ largeur: null, hauteur: null })
    image.src = url
  })
}

/** Largeur maximale d'une image de couverture : de quoi remplir la borne. */
const COUVERTURE_LARGEUR_MAX = 1280

/** Au-delà, on n'essaie pas de fabriquer une couverture (voir importerMedia). */
const COUVERTURE_TAILLE_MAX = 400 * 1024 * 1024

/**
 * Capture l'image affichée par une vidéo, en JPEG.
 *
 * C'est le moteur de la fenêtre qui décode et un canvas qui dessine : aucun
 * module natif, conformément à la règle du projet.
 */
function capturerCouverture(video: HTMLVideoElement): string | null {
  if (!video.videoWidth || !video.videoHeight) return null
  const largeur = Math.min(video.videoWidth, COUVERTURE_LARGEUR_MAX)
  const hauteur = Math.round((video.videoHeight / video.videoWidth) * largeur)

  const toile = document.createElement('canvas')
  toile.width = largeur
  toile.height = hauteur
  const pinceau = toile.getContext('2d')
  if (!pinceau) return null

  try {
    pinceau.drawImage(video, 0, 0, largeur, hauteur)
    return toile.toDataURL('image/jpeg', 0.8)
  } catch {
    return null
  }
}

/**
 * Mesure une vidéo et en rapporte une image de couverture.
 *
 * La couverture est prise **une seconde après le début** : une vidéo commence
 * très souvent par une image noire, qui ne montrerait rien. Si la lecture ne
 * répond pas (format exotique, décodeur absent), on abandonne au bout de
 * quelques secondes : l'import doit aboutir même sans couverture.
 */
function mesurerVideo(url: string): Promise<{
  largeur: number | null
  hauteur: number | null
  dureeSecondes: number | null
  couverture: string | null
}> {
  return new Promise((resoudre) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true

    let repondu = false
    const finir = (couverture: string | null) => {
      if (repondu) return
      repondu = true
      clearTimeout(garde)
      resoudre({
        largeur: video.videoWidth || null,
        hauteur: video.videoHeight || null,
        dureeSecondes: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
        couverture,
      })
    }

    const garde = setTimeout(() => finir(null), 5000)

    video.onloadedmetadata = () => {
      video.onseeked = () => finir(capturerCouverture(video))
      video.currentTime = Math.min(1, (video.duration || 2) / 2)
    }
    video.onerror = () => finir(null)
    video.src = url
  })
}

/**
 * Importe un fichier de l'ordinateur dans la bibliothèque : le processus
 * principal ouvre la fenêtre de choix et copie le fichier dans « medias/ »,
 * puis les dimensions (et la durée) sont mesurées ici même, par le moteur de
 * la fenêtre — pas de module natif (décision de CONTEXTE.md).
 *
 * Renvoie la fiche du média, ou null si l'utilisateur a annulé.
 */
export async function importerMedia(type: 'image' | 'video'): Promise<MediaManifeste | null> {
  const fichier = await window.borne.importerMedia(type)
  if (!fichier) return null

  const url = PROTOCOLE_MEDIA + fichier.chemin

  // Pour une vidéo, on relit les octets déjà copiés et on les rejoue **depuis
  // la mémoire**. Détour nécessaire : servie par « media:// », la vidéo est vue
  // comme venant d'un autre site, et le lecteur refuse alors de se déplacer
  // dedans — on ne capturerait que l'image noire du tout début. Au-delà d'une
  // certaine taille on renonce à la couverture plutôt que de charger un fichier
  // énorme en mémoire.
  let urlMesure = url
  let liberer: (() => void) | null = null
  if (type === 'video' && fichier.octets <= COUVERTURE_TAILLE_MAX) {
    const blob = await fetch(url)
      .then((reponse) => reponse.blob())
      .catch(() => null)
    if (blob) {
      const adresse = URL.createObjectURL(blob)
      urlMesure = adresse
      liberer = () => URL.revokeObjectURL(adresse)
    }
  }

  const mesure =
    type === 'image'
      ? { ...(await mesurerImage(url)), dureeSecondes: null, couverture: null }
      : await mesurerVideo(urlMesure)
  liberer?.()

  // L'image de couverture évite l'écran sombre avant la lecture, et sert de
  // vignette dans l'administration. Elle est facultative : si l'écriture
  // échoue, l'import se termine quand même, sans couverture.
  let posterChemin: string | null = null
  if (mesure.couverture) {
    const donnees = mesure.couverture.split(',')[1] ?? ''
    const ecrit = await window.borne
      .enregistrerImage(`couverture-${fichier.chemin}`, donnees)
      .catch(() => null)
    posterChemin = ecrit?.chemin ?? null
  }

  return {
    id: `media-${crypto.randomUUID()}`,
    empreinte: fichier.empreinte,
    type,
    // Légende par défaut : le nom du fichier sans extension — modifiable
    // ensuite, bloc par bloc.
    legende: fichier.chemin.replace(/\.[^.]+$/, ''),
    largeur: mesure.largeur,
    hauteur: mesure.hauteur,
    dureeSecondes: mesure.dureeSecondes,
    posterChemin,
    pointFocal: { x: 0.5, y: 0.5 },
    fichiers: [{ profil: 'origine', chemin: fichier.chemin, octets: fichier.octets }],
  }
}

export function resolveurMedias(manifeste: Manifeste): ResoudreMedia {
  const parId = new Map<string, MediaManifeste>()
  for (const media of manifeste.medias) parId.set(media.id, media)

  return (mediaId): MediaResolu | null => {
    if (!mediaId) return null
    const media = parId.get(mediaId)
    if (!media) return null

    const adressePour = (profil: ProfilImage): string => {
      // Tant qu'une seule déclinaison existe par média, on retombe sur la
      // dernière disponible plutôt que de n'afficher rien.
      const exact = media.fichiers.find((fichier) => fichier.profil === profil)
      const choisi = exact ?? media.fichiers[media.fichiers.length - 1]
      return choisi ? PROTOCOLE_MEDIA + choisi.chemin : ''
    }

    return {
      id: media.id,
      type: media.type,
      legende: media.legende,
      url: adressePour,
      poster: media.posterChemin ? PROTOCOLE_MEDIA + media.posterChemin : null,
      pointFocal: media.pointFocal,
      largeur: media.largeur,
      hauteur: media.hauteur,
    }
  }
}
