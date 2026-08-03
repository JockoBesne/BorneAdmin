import { modelePar } from './modeles/index.js'
import type {
  ContenuPage,
  DefEmplacement,
  InfoMedia,
  Probleme,
  ValeurEmplacement,
} from './types.js'

/**
 * Contrôles avant publication (§13.5).
 *
 * Deux niveaux, jamais confondus :
 *  - « bloquant »  : empêche la publication, car l'affichage serait cassé ou vide ;
 *  - « conseille » : signalé, jamais bloquant — le musée reste maître de son contenu.
 */
export function controlerContenu(
  contenu: ContenuPage,
  medias: (id: string) => InfoMedia | null,
): Probleme[] {
  const modele = modelePar(contenu.modele)
  if (!modele) {
    return [
      {
        emplacement: '',
        gravite: 'bloquant',
        message: "Le modèle de cette page est inconnu.",
      },
    ]
  }

  const problemes: Probleme[] = []

  for (const [nom, def] of Object.entries(modele.emplacements)) {
    const valeur = contenu.emplacements[nom]
    if (!valeur) {
      if (def.requis) {
        problemes.push({
          emplacement: nom,
          gravite: 'bloquant',
          message: `Il manque ${aMinuscule(def.libelle)}.`,
        })
      }
      continue
    }
    controlerEmplacement(nom, def, valeur, medias, problemes)
  }

  return problemes
}

export function estPubliable(problemes: Probleme[]): boolean {
  return !problemes.some((p) => p.gravite === 'bloquant')
}

function controlerEmplacement(
  nom: string,
  def: DefEmplacement,
  valeur: ValeurEmplacement,
  medias: (id: string) => InfoMedia | null,
  problemes: Probleme[],
): void {
  const ajouter = (gravite: Probleme['gravite'], message: string) =>
    problemes.push({ emplacement: nom, gravite, message })

  switch (def.type) {
    case 'titre':
    case 'texte': {
      if (valeur.type !== def.type) return
      const texte = valeur.valeur.trim()
      if (texte.length === 0) {
        if (def.requis) ajouter('bloquant', `Il manque ${aMinuscule(def.libelle)}.`)
        return
      }
      if (def.type === 'texte' && texte.length < 30) {
        ajouter(
          'conseille',
          `Le texte « ${def.libelle} » est très court (${texte.length} signes).`,
        )
      }
      if (texte.length > def.maxSignes) {
        ajouter(
          'bloquant',
          `« ${def.libelle} » dépasse la limite de ${def.maxSignes} signes.`,
        )
      }
      break
    }

    case 'image': {
      if (valeur.type !== 'image') return
      if (!valeur.mediaId) {
        if (def.requis) ajouter('bloquant', `Il manque ${aMinuscule(def.libelle)}.`)
        return
      }
      const media = medias(valeur.mediaId)
      if (!media) {
        ajouter(
          'bloquant',
          `Une photo a été supprimée de la bibliothèque (${def.libelle}). Remplacez-la.`,
        )
        return
      }
      if (media.type !== 'image') {
        ajouter('bloquant', `« ${def.libelle} » doit contenir une photo, pas une vidéo.`)
        return
      }
      if (media.largeur !== null && media.largeur < def.largeurMin) {
        ajouter(
          'conseille',
          `La photo « ${def.libelle} » mesure ${media.largeur} pixels de large : elle apparaîtra un peu floue sur le grand écran.`,
        )
      }
      if (valeur.legende.trim().length === 0) {
        ajouter(
          'conseille',
          `Sans légende, la photo « ${def.libelle} » ne sera pas décrite aux visiteurs malvoyants.`,
        )
      }
      break
    }

    case 'video': {
      if (valeur.type !== 'video') return
      if (!valeur.mediaId) {
        if (def.requis) ajouter('bloquant', `Il manque ${aMinuscule(def.libelle)}.`)
        return
      }
      const media = medias(valeur.mediaId)
      if (!media) {
        ajouter('bloquant', `La vidéo a été supprimée de la bibliothèque. Remplacez-la.`)
        return
      }
      if (media.type !== 'video') {
        ajouter('bloquant', `« ${def.libelle} » doit contenir une vidéo.`)
        return
      }
      if (
        media.dureeSecondes !== null &&
        media.dureeSecondes > def.dureeMaxSecondes
      ) {
        ajouter(
          'conseille',
          `Cette vidéo dure ${Math.round(media.dureeSecondes / 60)} minutes : c'est long pour une borne.`,
        )
      }
      break
    }

    case 'galerie': {
      if (valeur.type !== 'galerie') return
      if (valeur.elements.length === 0) {
        if (def.requis) ajouter('bloquant', `Il manque ${aMinuscule(def.libelle)}.`)
        return
      }
      for (const element of valeur.elements) {
        const media = medias(element.mediaId)
        if (!media) {
          ajouter(
            'bloquant',
            `Une photo de la galerie a été supprimée de la bibliothèque. Retirez-la ou remplacez-la.`,
          )
          return
        }
      }
      if (valeur.elements.length < def.min) {
        ajouter(
          'conseille',
          `Une galerie est plus lisible à partir de ${def.min} photos (il y en a ${valeur.elements.length}).`,
        )
      }
      break
    }
  }
}

function aMinuscule(libelle: string): string {
  const premier = libelle.charAt(0)
  return premier.toLocaleLowerCase('fr') + libelle.slice(1)
}
