import { COLONNES_GRILLE, COLONNES_MIN, HAUTEUR_MAX, HAUTEUR_MIN } from './types.js'
import type {
  BlocLibre,
  ContenuPage,
  ElementGalerie,
  StyleBloc,
  ValeurImage,
  ValeurTexte,
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

/**
 * Le texte d'un emplacement, mise en forme comprise. `lireTexte` ne rend que
 * les caractères ; c'est celle-ci qu'il faut pour afficher un texte.
 */
export function lireValeurTexte(contenu: ContenuPage, nom: string): ValeurTexte {
  const valeur = contenu.emplacements[nom]
  if (valeur && valeur.type === 'texte') return valeur
  return { type: 'texte', valeur: '' }
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
 * Habillage d'un bloc (fond, mise en forme du texte), par son nom : celui de
 * l'emplacement pour un bloc du modèle, « suite:<identifiant> » pour un bloc
 * ajouté. Absent = le bloc s'affiche sans habillage.
 */
export function lireStyle(contenu: ContenuPage, nom: string): StyleBloc | undefined {
  return contenu.styles?.[nom]
}

/**
 * Un habillage dont plus rien n'est réglé. On ne le garde pas dans le contenu :
 * remettre un bloc à zéro doit laisser le fichier tel qu'il était avant qu'on y
 * touche, sans habillage vide qui traîne.
 */
export function estStyleVide(style: StyleBloc): boolean {
  return (
    style.fond === undefined &&
    style.couleur === undefined &&
    !style.gras &&
    !style.italique &&
    !style.souligne &&
    (style.alignement === undefined || style.alignement === 'gauche')
  )
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

/**
 * Largeur d'un bloc en colonnes, sur la grille de 12.
 *
 * Un contenu écrit avant la poignée n'a pas de « colonnes » : on retombe alors
 * sur l'ancien champ « largeur ». Les bornes sont appliquées ici plutôt qu'à
 * l'écriture — un contenu.json retouché à la main ne doit pas pouvoir produire
 * un bloc de deux pixels de large sur la borne.
 */
export function colonnesDe(bloc: BlocLibre): number {
  if (typeof bloc.colonnes === 'number' && Number.isFinite(bloc.colonnes)) {
    return Math.min(COLONNES_GRILLE, Math.max(COLONNES_MIN, Math.round(bloc.colonnes)))
  }
  return bloc.largeur === 'moitie' ? COLONNES_GRILLE / 2 : COLONNES_GRILLE
}

/**
 * Largeur d'un emplacement du modèle, en colonnes.
 * Priorité : le réglage de la page, puis la valeur par défaut du modèle, puis
 * la pleine largeur.
 */
export function colonnesEmplacement(
  contenu: ContenuPage,
  nom: string,
  parDefaut: number | undefined,
): number {
  const choisie = contenu.largeurs?.[nom]
  const brute = typeof choisie === 'number' ? choisie : (parDefaut ?? COLONNES_GRILLE)
  return Math.min(COLONNES_GRILLE, Math.max(COLONNES_MIN, Math.round(brute)))
}

/** Un bloc dont la hauteur est réglable : image ou galerie seulement. */
export function hauteurReglable(type: string): boolean {
  return type === 'image' || type === 'galerie'
}

function borneHauteur(valeur: number | undefined): number | undefined {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return undefined
  return Math.min(HAUTEUR_MAX, Math.max(HAUTEUR_MIN, Math.round(valeur)))
}

/** Hauteur imposée à un bloc ajouté, ou « undefined » pour la hauteur d'origine. */
export function hauteurDe(bloc: BlocLibre): number | undefined {
  return hauteurReglable(bloc.valeur.type) ? borneHauteur(bloc.hauteur) : undefined
}

/** Hauteur imposée à un emplacement du modèle, ou « undefined ». */
export function hauteurEmplacement(contenu: ContenuPage, nom: string): number | undefined {
  return borneHauteur(contenu.hauteurs?.[nom])
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
