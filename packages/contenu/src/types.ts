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
  /**
   * Largeur par défaut de l'emplacement, en colonnes sur 12. C'est elle qui
   * donne au modèle sa mise en page d'origine ; une page peut ensuite la
   * remplacer (voir « largeurs » dans ContenuPage). Absent = pleine largeur.
   */
  colonnes?: number
  requis: boolean
  /**
   * Conseil de rédaction. **N'est plus affiché** : le panneau d'un bloc ne porte
   * aucune règle d'utilisation. Conservé parce que le réservoir de code
   * (`apps/admin`) s'en sert encore, et qu'il documente l'intention du modèle.
   */
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
/**
 * Un morceau de texte d'un seul tenant, avec sa mise en forme. Les marques sont
 * facultatives : un morceau sans marque est du texte ordinaire.
 */
export interface MorceauTexte {
  texte: string
  gras?: boolean
  italique?: boolean
  souligne?: boolean
}

/** Une ligne de texte. `puce` = ligne d'une liste ; absent = paragraphe. */
export interface LigneTexte {
  puce?: boolean
  morceaux: MorceauTexte[]
}

/**
 * Un texte, avec sa mise en forme.
 *
 * Deux champs qui disent la même chose sous deux angles :
 * - `valeur` est le texte **sans** mise en forme. C'est lui qu'on compte, qu'on
 *   contrôle, et qui dit si le bloc est vide ;
 * - `lignes` porte la mise en forme (gras, italique, souligné, puces).
 *
 * `lignes` est facultatif, à deux titres. Les textes écrits avant son
 * introduction n'en ont pas : leur mise en forme est alors relue de l'ancienne
 * écriture (`**gras**`, `_italique_`, « - » en tête de ligne) rangée dans
 * `valeur`. Et un texte sans aucune mise en forme n'en écrit pas non plus : le
 * fichier de contenu reste aussi simple qu'avant.
 *
 * Jamais de HTML, ni ici ni à l'écriture : le texte collé depuis un traitement
 * de texte ne peut donc apporter ni style ni script.
 */
export interface ValeurTexte {
  type: 'texte'
  valeur: string
  lignes?: LigneTexte[]
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

/** Nombre de colonnes de la grille de mise en page d'une page. 12 se divise
 *  par 2, 3 et 4 : le quart, le tiers, la moitié et les deux tiers tombent donc
 *  juste, ce qui n'aurait pas été le cas avec 10. */
export const COLONNES_GRILLE = 12
/** En dessous d'un quart de largeur, un bloc n'est plus lisible sur la borne. */
export const COLONNES_MIN = 3

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
   * Ancienne largeur, en deux valeurs. Conservée pour que les contenus écrits
   * avant « colonnes » restent valides ; « colonnes » l'emporte si présent.
   */
  largeur?: 'pleine' | 'moitie'
  /**
   * Largeur du bloc en colonnes, sur une grille de 12 (voir COLONNES_GRILLE).
   * C'est ce que règle la poignée de redimensionnement : on tire, la largeur
   * s'aimante sur une colonne. Les blocs s'enchaînent et passent à la ligne
   * quand la rangée est pleine — une page ne peut donc ni se trouer ni voir
   * deux blocs se chevaucher.
   *
   * Absent : déduit de « largeur » (moitie = 6, sinon 12).
   */
  colonnes?: number
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

// ── Habillage d'un bloc ──────────────────────────────────────────────────────

export type AlignementBloc = 'gauche' | 'centre' | 'droite'

/**
 * Habillage d'un bloc : sa couleur de fond, et la mise en forme de son texte.
 *
 * Tous les champs sont facultatifs, et un habillage entièrement vide n'est pas
 * écrit du tout : un bloc sans habillage s'affiche exactement comme avant
 * l'introduction de ce réglage — les contenus déjà écrits restent valides.
 */
export interface StyleBloc {
  /** Couleur de fond du bloc, « #rrggbb ». Absente = pas de fond. */
  fond?: string
  /** Couleur du texte du bloc. Absente = la couleur de la page. */
  couleur?: string
  gras?: boolean
  italique?: boolean
  souligne?: boolean
  /** Absent = gauche, l'alignement ordinaire. */
  alignement?: AlignementBloc
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
  /**
   * Habillage des blocs, rangé par nom de bloc : le nom de l'emplacement pour
   * un bloc du modèle (« titre », « image »…), « suite:<identifiant> » pour un
   * bloc ajouté. C'est le même nom que celui qu'emploie l'éditeur, donc un seul
   * rangement suffit pour les deux sortes de blocs.
   *
   * Facultatif : absent tant qu'aucun bloc de la page n'est personnalisé.
   */
  styles?: Record<string, StyleBloc>
  /**
   * Largeurs choisies à la poignée pour les emplacements du modèle, en
   * colonnes sur 12, par nom d'emplacement.
   *
   * Facultatif, et seuls les emplacements réglés y figurent : une page qui n'a
   * jamais été retouchée garde exactement la mise en page de son modèle.
   */
  largeurs?: Record<string, number>
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
