import { z, type ZodTypeAny } from 'zod'
import type {
  ContenuPage,
  DefEmplacement,
  IdModele,
  ValeurEmplacement,
} from '../types.js'

/**
 * Un modèle est déclaré une seule fois ; le schéma de validation, le formulaire
 * de l'éditeur, les contrôles avant publication et le composant de rendu en
 * découlent tous. Ajouter un emplacement = modifier une ligne (§7.5.1).
 */
export interface Modele {
  id: IdModele
  nom: string
  /** Phrase montrée au choix du modèle : à quoi il sert, pas comment il est fait. */
  description: string
  emplacements: Record<string, DefEmplacement>
  /** Schéma dérivé, utilisé par l'API, l'admin et la borne. */
  schema: z.ZodType<ContenuPage>
  /** Contenu initial d'une page nouvellement créée. */
  contenuVide: () => ContenuPage
}

const LEGENDE_MAX = 200

function schemaEmplacement(def: DefEmplacement): ZodTypeAny {
  switch (def.type) {
    case 'titre':
      return z.object({
        type: z.literal('titre'),
        valeur: z.string().max(def.maxSignes),
      })
    case 'texte':
      return z.object({
        type: z.literal('texte'),
        valeur: z.string().max(def.maxSignes),
      })
    case 'image':
      return z.object({
        type: z.literal('image'),
        mediaId: z.string().nullable(),
        legende: z.string().max(LEGENDE_MAX),
      })
    case 'video':
      return z.object({
        type: z.literal('video'),
        mediaId: z.string().nullable(),
        legende: z.string().max(LEGENDE_MAX),
      })
    case 'galerie':
      return z.object({
        type: z.literal('galerie'),
        elements: z
          .array(
            z.object({
              mediaId: z.string(),
              legende: z.string().max(LEGENDE_MAX),
            }),
          )
          .max(def.max),
      })
  }
}

function valeurVide(def: DefEmplacement): ValeurEmplacement {
  switch (def.type) {
    case 'titre':
      return { type: 'titre', valeur: '' }
    case 'texte':
      return { type: 'texte', valeur: '' }
    case 'image':
      return { type: 'image', mediaId: null, legende: '' }
    case 'video':
      return { type: 'video', mediaId: null, legende: '' }
    case 'galerie':
      return { type: 'galerie', elements: [] }
  }
}

export function definirModele(declaration: {
  id: IdModele
  nom: string
  description: string
  emplacements: Record<string, DefEmplacement>
}): Modele {
  const { id, emplacements } = declaration

  const formeEmplacements: Record<string, ZodTypeAny> = {}
  for (const [nom, def] of Object.entries(emplacements)) {
    formeEmplacements[nom] = schemaEmplacement(def)
  }

  const schema = z.object({
    modele: z.literal(id),
    // « strict » : un emplacement inconnu est refusé — c'est ce qui empêche
    // d'introduire du contenu hors modèle par appel direct à l'API.
    emplacements: z.object(formeEmplacements).strict(),
  }) as unknown as z.ZodType<ContenuPage>

  return {
    ...declaration,
    schema,
    contenuVide: () => {
      const valeurs: Record<string, ValeurEmplacement> = {}
      for (const [nom, def] of Object.entries(emplacements)) {
        valeurs[nom] = valeurVide(def)
      }
      return { modele: id, emplacements: valeurs }
    },
  }
}
