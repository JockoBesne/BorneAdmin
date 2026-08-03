import { transaction } from '../base/connexion.js'
import { journaliser } from '../depots/divers.js'
import * as depot from '../depots/medias.js'
import { erreurs } from '../domaine/erreurs.js'
import { nouvelId } from '../domaine/identifiants.js'
import { ecrirePoster, traiterImage, traiterVideo } from '../medias/stockage.js'
import { urlFichier } from './publication.js'
import type { Connecte } from '../securite/sessions.js'

export interface MediaPublic {
  id: string
  type: 'image' | 'video'
  nomAffiche: string
  legende: string
  largeur: number | null
  hauteur: number | null
  dureeSecondes: number | null
  poidsOctets: number
  poidsOptimise: number
  pointFocal: { x: number; y: number }
  creeLe: string
  utilisations: number
  urls: {
    vignette: string
    moyen: string
    grand: string
    origine: string
    poster: string | null
  }
}

export function versPublic(media: depot.Media): MediaPublic {
  const origine = urlFichier(media.empreinte, `origine.${media.extension}`)
  return {
    id: media.id,
    type: media.type,
    nomAffiche: media.nomAffiche,
    legende: media.legende,
    largeur: media.largeur,
    hauteur: media.hauteur,
    dureeSecondes: media.dureeSecondes,
    poidsOctets: media.poidsOctets,
    poidsOptimise: media.poidsOptimise,
    pointFocal: media.pointFocal,
    creeLe: media.creeLe,
    utilisations: media.utilisations,
    urls: {
      vignette: media.type === 'image' ? urlFichier(media.empreinte, 'vignette.webp') : origine,
      moyen: media.type === 'image' ? urlFichier(media.empreinte, 'moyen.webp') : origine,
      grand: media.type === 'image' ? urlFichier(media.empreinte, 'grand.webp') : origine,
      origine,
      poster: media.aPoster ? urlFichier(media.empreinte, 'poster.webp') : null,
    },
  }
}

function nomSansExtension(nomFichier: string): string {
  const point = nomFichier.lastIndexOf('.')
  return (point > 0 ? nomFichier.slice(0, point) : nomFichier).slice(0, 80)
}

export async function televerser(
  entree: {
    donnees: Buffer
    nomOrigine: string
    typeDeclare: string
    poster?: Buffer
    dureeSecondes?: number
  },
  utilisateur: Connecte,
): Promise<MediaPublic> {
  const estVideo = entree.typeDeclare.startsWith('video/')

  if (estVideo) {
    const { empreinte, mime, extension } = traiterVideo(entree.donnees)

    // Déduplication : le même fichier n'est stocké qu'une fois (§15.7).
    const existant = depot.lireMediaParEmpreinte(empreinte)
    if (existant) return versPublic(existant)

    if (entree.poster) await ecrirePoster(empreinte, entree.poster)

    const id = nouvelId()
    transaction(() => {
      depot.creerMedia({
        id,
        empreinte,
        type: 'video',
        mime,
        extension,
        nomOrigine: entree.nomOrigine,
        nomAffiche: nomSansExtension(entree.nomOrigine),
        poidsOctets: entree.donnees.length,
        poidsOptimise: entree.donnees.length,
        largeur: null,
        hauteur: null,
        dureeSecondes: entree.dureeSecondes ?? null,
        aPoster: Boolean(entree.poster),
        utilisateurId: utilisateur.id,
      })
      journaliser({
        utilisateurId: utilisateur.id,
        action: 'media.ajoute',
        resume: `${utilisateur.nomAffiche} a ajouté la vidéo « ${nomSansExtension(entree.nomOrigine)} »`,
        cibleId: id,
      })
    })

    const media = depot.lireMedia(id)
    if (!media) throw erreurs.mediaIntrouvable()
    return versPublic(media)
  }

  const resultat = await traiterImage(entree.donnees)

  const existant = depot.lireMediaParEmpreinte(resultat.empreinte)
  if (existant) return versPublic(existant)

  const id = nouvelId()
  transaction(() => {
    depot.creerMedia({
      id,
      empreinte: resultat.empreinte,
      type: 'image',
      mime: resultat.mime,
      extension: resultat.extension,
      nomOrigine: entree.nomOrigine,
      nomAffiche: nomSansExtension(entree.nomOrigine),
      poidsOctets: entree.donnees.length,
      poidsOptimise: resultat.poidsOptimise,
      largeur: resultat.largeur,
      hauteur: resultat.hauteur,
      dureeSecondes: null,
      aPoster: false,
      utilisateurId: utilisateur.id,
    })
    journaliser({
      utilisateurId: utilisateur.id,
      action: 'media.ajoute',
      resume: `${utilisateur.nomAffiche} a ajouté la photo « ${nomSansExtension(entree.nomOrigine)} »`,
      cibleId: id,
    })
  })

  const media = depot.lireMedia(id)
  if (!media) throw erreurs.mediaIntrouvable()
  return versPublic(media)
}

export function supprimer(id: string, utilisateur: Connecte): void {
  const media = depot.lireMedia(id)
  if (!media) throw erreurs.mediaIntrouvable()

  // Un média utilisé n'est jamais supprimé : la liste des pages concernées est
  // renvoyée pour que l'utilisateur sache quoi faire (F23/F24).
  const pages = depot.pagesUtilisant(id)
  if (pages.length > 0) throw erreurs.mediaUtilise(pages)

  transaction(() => {
    depot.supprimerMedia(id)
    journaliser({
      utilisateurId: utilisateur.id,
      action: 'media.supprime',
      resume: `${utilisateur.nomAffiche} a supprimé « ${media.nomAffiche} »`,
      cibleId: id,
    })
  })
  // Les fichiers sur disque sont retirés par la purge hebdomadaire des
  // orphelins (§15.7) : on ne supprime jamais un fichier encore référencé par
  // une publication conservée.
}
