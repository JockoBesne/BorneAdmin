import type {
  BlocLibre,
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

/** Blocs ajoutés à la suite de la page. Toujours un tableau, jamais undefined. */
export function lireSuite(contenu: ContenuPage): BlocLibre[] {
  return contenu.suite ?? []
}

/**
 * Section après laquelle un bloc s'affiche réellement. Ancre absente ou
 * inconnue du modèle : bas de page (la dernière section). Le rendu et
 * l'éditeur appliquent cette même règle — un bloc est toujours affiché là où
 * l'éditeur le montre.
 */
export function positionBloc(bloc: BlocLibre, sections: readonly string[]): string | undefined {
  if (bloc.apres !== undefined && sections.includes(bloc.apres)) return bloc.apres
  return sections[sections.length - 1]
}

/**
 * Un bloc ajouté mais laissé vide n'apparaît pas sur la borne : cette règle
 * est partagée entre le rendu (qui le saute) et les contrôles (qui le
 * signalent). Une seule définition de « vide », pour que les deux soient
 * toujours d'accord.
 */
export function estBlocLibreVide(bloc: BlocLibre): boolean {
  switch (bloc.valeur.type) {
    case 'texte':
      return bloc.valeur.valeur.trim() === ''
    case 'image':
    case 'video':
      return bloc.valeur.mediaId === null
    case 'galerie':
      return bloc.valeur.elements.length === 0
    // Un atelier est « vide » tant qu'il n'est pas jouable : sans question ou
    // sans réponses, sans consigne ou sans assez d'événements, il ne doit pas
    // apparaître devant le public.
    case 'quiz':
      return (
        bloc.valeur.question.trim() === '' ||
        bloc.valeur.reponses.filter((reponse) => reponse.texte.trim() !== '').length < 2
      )
    case 'frise':
      return bloc.valeur.evenements.filter((evenement) => evenement.libelle.trim() !== '').length < 3
  }
}

/** Tous les identifiants de médias référencés par une page (index d'usage, §9.4). */
export function mediasReferences(contenu: ContenuPage): string[] {
  const ids = new Set<string>()
  const valeurs = [
    ...Object.values(contenu.emplacements),
    ...lireSuite(contenu).map((bloc) => bloc.valeur),
  ]
  for (const valeur of valeurs) {
    if (!valeur) continue
    if (valeur.type === 'image' || valeur.type === 'video') {
      if (valeur.mediaId) ids.add(valeur.mediaId)
    } else if (valeur.type === 'galerie') {
      for (const element of valeur.elements) ids.add(element.mediaId)
    }
  }
  return [...ids]
}
