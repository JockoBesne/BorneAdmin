import { z } from 'zod'

/**
 * Manifeste de publication : instantané complet et immuable du contenu destiné
 * à la borne (§7.6). C'est le seul contrat entre l'API et la borne.
 *
 * Il est validé par ce schéma au moment de sa production (API) *et* au moment
 * de sa lecture (borne) : une publication abîmée est refusée avant d'être
 * affichée, jamais après.
 */

export const schemaFichierMedia = z.object({
  profil: z.enum(['vignette', 'moyen', 'grand', 'origine']),
  chemin: z.string(),
  octets: z.number().int().nonnegative(),
})

export const schemaMediaManifeste = z.object({
  id: z.string(),
  empreinte: z.string(),
  type: z.enum(['image', 'video']),
  legende: z.string(),
  largeur: z.number().int().nullable(),
  hauteur: z.number().int().nullable(),
  dureeSecondes: z.number().nullable(),
  posterChemin: z.string().nullable(),
  pointFocal: z.object({ x: z.number(), y: z.number() }),
  fichiers: z.array(schemaFichierMedia),
})

export const schemaPageManifeste = z.object({
  id: z.string(),
  titre: z.string(),
  modele: z.enum(['t1', 't2', 't3']),
  ordre: z.number(),
  vignette: z.string().nullable(),
  contenu: z.object({
    modele: z.enum(['t1', 't2', 't3']),
    emplacements: z.record(z.string(), z.unknown()),
  }),
})

export const schemaReglages = z.object({
  titreVeille: z.string(),
  sousTitreVeille: z.string(),
  minutesAvantVeille: z.number().int().min(1).max(60),
})

export const schemaManifeste = z.object({
  version: z.number().int().nonnegative(),
  genereLe: z.string(),
  reglages: schemaReglages,
  pages: z.array(schemaPageManifeste),
  medias: z.array(schemaMediaManifeste),
})

export type FichierMediaManifeste = z.infer<typeof schemaFichierMedia>
export type MediaManifeste = z.infer<typeof schemaMediaManifeste>
export type PageManifeste = z.infer<typeof schemaPageManifeste>
export type Reglages = z.infer<typeof schemaReglages>
export type Manifeste = z.infer<typeof schemaManifeste>

export const REGLAGES_DEFAUT: Reglages = {
  titreVeille: 'Musée des Transmissions',
  sousTitreVeille: "Touchez l'écran pour découvrir l'exposition",
  minutesAvantVeille: 3,
}
