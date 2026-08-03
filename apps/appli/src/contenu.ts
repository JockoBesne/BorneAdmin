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

function mesurerVideo(
  url: string,
): Promise<{ largeur: number | null; hauteur: number | null; dureeSecondes: number | null }> {
  return new Promise((resoudre) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () =>
      resoudre({
        largeur: video.videoWidth || null,
        hauteur: video.videoHeight || null,
        dureeSecondes: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
      })
    video.onerror = () => resoudre({ largeur: null, hauteur: null, dureeSecondes: null })
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
  const mesure =
    type === 'image'
      ? { ...(await mesurerImage(url)), dureeSecondes: null }
      : await mesurerVideo(url)

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
    posterChemin: null,
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
