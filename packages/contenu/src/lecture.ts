import type {
  ContenuPage,
  ElementGalerie,
  ValeurImage,
  ValeurVideo,
} from './types.js'

/* Lecture typée du contenu d'une page.
 * Un emplacement absent ou d'un autre type renvoie une valeur vide plutôt que
 * de lever : un contenu abîmé ne doit jamais faire tomber l'affichage (§14.6). */

export function lireTexte(contenu: ContenuPage, nom: string): string {
  const valeur = contenu.emplacements[nom]
  if (valeur && (valeur.type === 'titre' || valeur.type === 'texte')) {
    return valeur.valeur
  }
  return ''
}

export function lireImage(contenu: ContenuPage, nom: string): ValeurImage {
  const valeur = contenu.emplacements[nom]
  if (valeur && valeur.type === 'image') return valeur
  return { type: 'image', mediaId: null, legende: '' }
}

export function lireVideo(contenu: ContenuPage, nom: string): ValeurVideo {
  const valeur = contenu.emplacements[nom]
  if (valeur && valeur.type === 'video') return valeur
  return { type: 'video', mediaId: null, legende: '' }
}

export function lireGalerie(contenu: ContenuPage, nom: string): ElementGalerie[] {
  const valeur = contenu.emplacements[nom]
  if (valeur && valeur.type === 'galerie') return valeur.elements
  return []
}

/** Tous les identifiants de médias référencés par une page (index d'usage, §9.4). */
export function mediasReferences(contenu: ContenuPage): string[] {
  const ids = new Set<string>()
  for (const valeur of Object.values(contenu.emplacements)) {
    if (!valeur) continue
    if (valeur.type === 'image' || valeur.type === 'video') {
      if (valeur.mediaId) ids.add(valeur.mediaId)
    } else if (valeur.type === 'galerie') {
      for (const element of valeur.elements) ids.add(element.mediaId)
    }
  }
  return [...ids]
}
