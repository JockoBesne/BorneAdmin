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

/** Contenu complet d'une page : un modèle et une valeur par emplacement. */
export interface ContenuPage {
  modele: IdModele
  emplacements: Record<string, ValeurEmplacement>
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
