import type { ReactNode } from 'react'
import type { ContenuPage, ProfilImage, TypeEmplacement } from '../types.js'

/** Média tel que le rendu en a besoin, quelle que soit sa provenance
 *  (base de données côté admin, manifeste côté borne). */
export interface MediaResolu {
  id: string
  type: 'image' | 'video'
  legende: string
  url: (profil: ProfilImage) => string
  poster: string | null
  pointFocal: { x: number; y: number }
  largeur: number | null
  hauteur: number | null
}

export type ResoudreMedia = (mediaId: string | null | undefined) => MediaResolu | null

export interface InfoEmplacement {
  nom: string
  type: TypeEmplacement
  /** Classe typographique du rendu, pour que l'éditeur en place soit identique. */
  classe: string
}

/**
 * Enveloppe d'emplacement. La borne n'en fournit pas (rendu brut) ;
 * l'administration en fournit une qui ajoute la sélection, l'état vide et,
 * pour les textes, l'édition en place. C'est le seul point de divergence
 * entre les deux applications — le reste du rendu est strictement identique.
 */
export type EnveloppeEmplacement = (info: InfoEmplacement, defaut: ReactNode) => ReactNode

export interface PropsModele {
  contenu: ContenuPage
  media: ResoudreMedia
  emp?: EnveloppeEmplacement
  /** Borne : ouvre la visionneuse plein écran. Absent en administration. */
  surImage?: (mediaId: string) => void
  /** Borne : lecteur vidéo réel. Administration : image de couverture seule. */
  lecteurVideo?: boolean
  /**
   * Administration : règle la largeur d'un bloc ajouté (en colonnes sur 12).
   * Absent côté borne — c'est ce qui fait que la poignée n'existe que dans
   * l'éditeur, sans dupliquer le rendu.
   */
  surRedimensionner?: (idBloc: string, colonnes: number) => void
  /**
   * Administration : règle la hauteur d'une image ou d'une galerie, en pixels
   * de toile. Seuls ces deux types en ont une réglable — la hauteur d'un texte
   * découle de son contenu, celle d'une vidéo de ses proportions.
   */
  surHauteur?: (cle: string, hauteur: number) => void
}
