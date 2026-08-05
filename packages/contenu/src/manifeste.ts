import { z } from 'zod'
import {
  BLOC_LIBRE_GALERIE_MAX,
  BLOC_LIBRE_TEXTE_MAX_SIGNES,
  COLONNES_GRILLE,
  COLONNES_MIN,
  FRISE_CONSIGNE_MAX_SIGNES,
  FRISE_DETAIL_MAX_SIGNES,
  FRISE_EVENEMENTS_MAX,
  FRISE_LIBELLE_MAX_SIGNES,
  QUIZ_EXPLICATION_MAX_SIGNES,
  QUIZ_QUESTION_MAX_SIGNES,
  QUIZ_REPONSE_MAX_SIGNES,
  QUIZ_REPONSES_MAX,
} from './types.js'

/**
 * Manifeste de publication : instantané complet et immuable du contenu destiné
 * à la borne (§7.6). C'est le seul contrat entre l'API et la borne.
 *
 * Il est validé par ce schéma au moment de sa production (API) *et* au moment
 * de sa lecture (borne) : une publication abîmée est refusée avant d'être
 * affichée, jamais après.
 */

/** Code couleur hexadécimal à 6 chiffres, ex. « #0e2237 ». */
const COULEUR = /^#[0-9a-fA-F]{6}$/

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

const LEGENDE_MAX = 200

/**
 * Bloc ajouté librement à la suite d'une page. Déclaré ici expressément :
 * le schéma supprime les champs qu'il ne connaît pas, et sans cette
 * déclaration la suite serait effacée à chaque enregistrement.
 */
export const schemaBlocLibre = z.object({
  id: z.string(),
  // Section du modèle après laquelle le bloc s'affiche ; absent = bas de page.
  apres: z.string().optional(),
  largeur: z.enum(['pleine', 'moitie']).optional(),
  // Largeur en colonnes réglée à la poignée. Bornée ici aussi : un contenu
  // modifié à la main ne doit pas pouvoir produire un bloc illisible.
  colonnes: z.number().int().min(COLONNES_MIN).max(COLONNES_GRILLE).optional(),
  valeur: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('texte'),
      valeur: z.string().max(BLOC_LIBRE_TEXTE_MAX_SIGNES),
    }),
    z.object({
      type: z.literal('image'),
      mediaId: z.string().nullable(),
      legende: z.string().max(LEGENDE_MAX),
    }),
    z.object({
      type: z.literal('galerie'),
      elements: z
        .array(z.object({ mediaId: z.string(), legende: z.string().max(LEGENDE_MAX) }))
        .max(BLOC_LIBRE_GALERIE_MAX),
    }),
    z.object({
      type: z.literal('video'),
      mediaId: z.string().nullable(),
      legende: z.string().max(LEGENDE_MAX),
    }),
    // ── Ateliers interactifs ──
    z.object({
      type: z.literal('quiz'),
      question: z.string().max(QUIZ_QUESTION_MAX_SIGNES),
      reponses: z
        .array(
          z.object({
            id: z.string(),
            texte: z.string().max(QUIZ_REPONSE_MAX_SIGNES),
            correcte: z.boolean(),
            explication: z.string().max(QUIZ_EXPLICATION_MAX_SIGNES),
          }),
        )
        .max(QUIZ_REPONSES_MAX),
    }),
    z.object({
      type: z.literal('frise'),
      consigne: z.string().max(FRISE_CONSIGNE_MAX_SIGNES),
      evenements: z
        .array(
          z.object({
            id: z.string(),
            libelle: z.string().max(FRISE_LIBELLE_MAX_SIGNES),
            // Bornée : une année hors de cette plage est une faute de frappe,
            // et elle casserait l'échelle de la frise affichée au visiteur.
            annee: z.number().int().min(-3000).max(3000),
            detail: z.string().max(FRISE_DETAIL_MAX_SIGNES),
          }),
        )
        .max(FRISE_EVENEMENTS_MAX),
    }),
  ]),
})

export const schemaPageManifeste = z.object({
  id: z.string(),
  titre: z.string(),
  modele: z.enum(['t1', 't2', 't3']),
  ordre: z.number(),
  vignette: z.string().nullable(),
  // Couleurs propres à la page (facultatives). Absentes = la page suit le thème
  // global (`reglages`). Présentes, elles l'emportent.
  couleurFond: z.string().regex(COULEUR).optional(),
  couleurTexte: z.string().regex(COULEUR).optional(),
  contenu: z.object({
    modele: z.enum(['t1', 't2', 't3']),
    // Largeurs des emplacements réglées à la poignée. Déclaré ici sans quoi le
    // schéma les supprimerait à chaque enregistrement.
    largeurs: z
      .record(z.string(), z.number().int().min(COLONNES_MIN).max(COLONNES_GRILLE))
      .optional(),
    emplacements: z.record(z.string(), z.unknown()),
    // Facultative : les contenus écrits avant l'introduction des blocs libres
    // restent valides sans conversion, et une page sans blocs ajoutés n'écrit
    // rien de plus dans le fichier.
    suite: z.array(schemaBlocLibre).optional(),
    // Ordre libre des cellules (emplacements du modèle et blocs ajoutés
    // mélangés). Facultatif : absent, l'ordre du modèle s'applique.
    ordre: z.array(z.string()).optional(),
  }),
})

export const schemaReglages = z.object({
  titreVeille: z.string(),
  sousTitreVeille: z.string(),
  minutesAvantVeille: z.number().int().min(1).max(60),
  // Couleurs de la borne, réglables depuis l'administration. Valeurs par
  // défaut = celles d'origine du thème : un contenu écrit avant reste valide.
  couleurFond: z.string().regex(COULEUR).default('#0e2237'),
  couleurTexte: z.string().regex(COULEUR).default('#f5f7fa'),
  /**
   * Code d'accès à l'administration, quatre chiffres.
   *
   * Une valeur par défaut plutôt qu'un champ requis : les contenus déjà écrits
   * restent valides sans être retouchés.
   *
   * Ce code empêche un visiteur d'entrer par curiosité. Ce n'est pas une
   * sécurité : il est lisible en clair dans contenu.json, et quiconque a accès
   * au clavier de la borne peut de toute façon en sortir.
   */
  pinAdmin: z
    .string()
    .regex(/^\d{4}$/, 'Le code d’accès doit comporter quatre chiffres.')
    .default('1975'),
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
  pinAdmin: '1975',
  couleurFond: '#0e2237',
  couleurTexte: '#f5f7fa',
}
