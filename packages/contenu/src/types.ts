/* Types du modèle de contenu — partagés par l'API, l'administration et la borne. */

export type IdModele = 't1' | 't2' | 't3'

/** Déclinaisons produites à l'envoi d'une image (§15.3 de la conception). */
export type ProfilImage = 'vignette' | 'moyen' | 'grand' | 'origine'

export type TypeEmplacement =
  | 'titre'
  | 'texte'
  | 'image'
  | 'galerie'
  | 'video'
  | 'quiz'
  | 'frise'

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
export interface DefQuiz extends DefBase {
  type: 'quiz'
  minReponses: number
  maxReponses: number
}
export interface DefFrise extends DefBase {
  type: 'frise'
  minEvenements: number
  maxEvenements: number
}

export type DefEmplacement =
  | DefTitre
  | DefTexte
  | DefImage
  | DefGalerie
  | DefVideo
  | DefQuiz
  | DefFrise

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

// ── Ateliers interactifs ─────────────────────────────────────────────────────

/**
 * Une réponse d'un quiz. « explication » est ce que le visiteur lit une fois
 * qu'il a répondu : c'est là que se trouve la valeur pédagogique de l'atelier,
 * pas dans le score. Elle est donc proposée pour chaque réponse, juste ou non.
 */
export interface ReponseQuiz {
  id: string
  texte: string
  correcte: boolean
  explication: string
}

export interface ValeurQuiz {
  type: 'quiz'
  question: string
  reponses: ReponseQuiz[]
}

/**
 * Un événement à replacer sur la frise. L'ordre attendu n'est pas saisi à la
 * main : il est **déduit de l'année**. Le personnel n'a donc qu'à écrire
 * l'événement et sa date, sans se soucier de numéroter quoi que ce soit.
 */
export interface EvenementFrise {
  id: string
  libelle: string
  annee: number
  /** Phrase révélée à la correction. Facultative. */
  detail: string
}

export interface ValeurFrise {
  type: 'frise'
  consigne: string
  evenements: EvenementFrise[]
}

export type ValeurEmplacement =
  | ValeurTitre
  | ValeurTexte
  | ValeurImage
  | ValeurGalerie
  | ValeurVideo
  | ValeurQuiz
  | ValeurFrise

// ── Blocs libres ─────────────────────────────────────────────────────────────

/** Types de blocs que le personnel peut ajouter librement à une page. */
export type TypeBlocLibre = 'texte' | 'image' | 'galerie' | 'video' | 'quiz' | 'frise'

export const BLOC_LIBRE_TEXTE_MAX_SIGNES = 2000
export const BLOC_LIBRE_GALERIE_MAX = 12

// Limites des ateliers. Elles ne sont pas décoratives : au-delà, l'atelier ne
// tient plus dans la largeur de l'écran, ou devient trop long pour un visiteur
// debout devant une borne.
export const QUIZ_QUESTION_MAX_SIGNES = 200
export const QUIZ_REPONSE_MAX_SIGNES = 120
export const QUIZ_EXPLICATION_MAX_SIGNES = 300
export const QUIZ_REPONSES_MIN = 2
export const QUIZ_REPONSES_MAX = 6

export const FRISE_CONSIGNE_MAX_SIGNES = 200
export const FRISE_LIBELLE_MAX_SIGNES = 90
export const FRISE_DETAIL_MAX_SIGNES = 200
export const FRISE_EVENEMENTS_MIN = 3
export const FRISE_EVENEMENTS_MAX = 6

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
  valeur: ValeurTexte | ValeurImage | ValeurGalerie | ValeurVideo | ValeurQuiz | ValeurFrise
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
