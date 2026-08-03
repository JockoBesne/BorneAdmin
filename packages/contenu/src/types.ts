/* Types du modèle de contenu — partagés par l'API, l'administration et la borne. */

export type IdModele = 't1' | 't2' | 't3'

/** Déclinaisons produites à l'envoi d'une image (§15.3 de la conception). */
export type ProfilImage = 'vignette' | 'moyen' | 'grand' | 'origine'

export type TypeEmplacement = 'titre' | 'texte' | 'image' | 'galerie' | 'video'

// ── Déclaration d'un emplacement (structure autorisée par le modèle) ──────────

interface DefBase {
  /** Libellé montré à l'utilisateur, en français. */
  libelle: string
  requis: boolean
  /** Conseil affiché dans le panneau de droite de l'éditeur. */
  conseil?: string
}

export interface DefTitre extends DefBase {
  type: 'titre'
  maxSignes: number
}
export interface DefTexte extends DefBase {
  type: 'texte'
  maxSignes: number
}
export interface DefImage extends DefBase {
  type: 'image'
  /** En dessous, un avertissement conseillé est émis (flou sur grand écran). */
  largeurMin: number
}
export interface DefGalerie extends DefBase {
  type: 'galerie'
  min: number
  max: number
}
export interface DefVideo extends DefBase {
  type: 'video'
  dureeMaxSecondes: number
}

export type DefEmplacement = DefTitre | DefTexte | DefImage | DefGalerie | DefVideo

// ── Valeurs saisies par l'utilisateur ────────────────────────────────────────

export interface ValeurTitre {
  type: 'titre'
  valeur: string
}
export interface ValeurTexte {
  type: 'texte'
  valeur: string
}
export interface ValeurImage {
  type: 'image'
  mediaId: string | null
  legende: string
}
export interface ElementGalerie {
  mediaId: string
  legende: string
}
export interface ValeurGalerie {
  type: 'galerie'
  elements: ElementGalerie[]
}
export interface ValeurVideo {
  type: 'video'
  mediaId: string | null
  legende: string
}

export type ValeurEmplacement =
  | ValeurTitre
  | ValeurTexte
  | ValeurImage
  | ValeurGalerie
  | ValeurVideo

// ── Blocs libres ─────────────────────────────────────────────────────────────

/** Types de blocs que le personnel peut ajouter librement à une page. */
export type TypeBlocLibre = 'texte' | 'image' | 'galerie' | 'video'

export const BLOC_LIBRE_TEXTE_MAX_SIGNES = 2000
export const BLOC_LIBRE_GALERIE_MAX = 12

/**
 * Bloc ajouté librement à une page.
 * L'identifiant est stable : c'est lui qui permet de déplacer ou retirer un
 * bloc sans ambiguïté, même si deux blocs ont le même contenu.
 */
export interface BlocLibre {
  id: string
  /**
   * Nom de la section du modèle après laquelle le bloc s'affiche.
   * Absent ou inconnu du modèle : le bloc va en bas de page — c'est ce qui
   * garde valides les contenus écrits avant l'introduction de ce champ.
   */
  apres?: string
  /**
   * Largeur du bloc dans la page. « moitie » = deux blocs côte à côte : deux
   * blocs « moitie » consécutifs partagent une rangée. Absent = « pleine »
   * (toute la largeur), ce qui garde valides les contenus écrits avant ce champ.
   */
  largeur?: 'pleine' | 'moitie'
  valeur: ValeurTexte | ValeurImage | ValeurGalerie | ValeurVideo
}

/**
 * Section de mise en page d'un modèle : un point d'ancrage pour les blocs
 * libres, et la liste des emplacements qu'elle regroupe (pour que l'éditeur
 * affiche la page dans son ordre réel).
 */
export interface SectionModele {
  nom: string
  emplacements: string[]
}

/**
 * Contenu complet d'une page : un modèle, une valeur par emplacement, et la
 * suite — les blocs ajoutés librement sous la mise en page du modèle.
 * « suite » est facultative : les contenus écrits avant son introduction
 * restent valides tels quels.
 */
export interface ContenuPage {
  modele: IdModele
  emplacements: Record<string, ValeurEmplacement>
  suite?: BlocLibre[]
}

// ── Contrôles avant publication ──────────────────────────────────────────────

export type Gravite = 'bloquant' | 'conseille'

export interface Probleme {
  emplacement: string
  gravite: Gravite
  message: string
}

/** Ce que les contrôles ont besoin de savoir d'un média, sans dépendre de la base. */
export interface InfoMedia {
  id: string
  type: 'image' | 'video'
  largeur: number | null
  hauteur: number | null
  dureeSecondes: number | null
  legende: string
}
