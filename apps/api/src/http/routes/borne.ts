import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { schemaReglages } from '@borne/contenu'
import {
  ecrireParametre,
  journaliser,
  lireJournal,
  lirePinBorne,
  lireReglages,
  listerUtilisateurs,
} from '../../depots/divers.js'
import { erreurs } from '../../domaine/erreurs.js'
import {
  listerPublications,
  publicationCourante,
  regenererPublication,
} from '../../services/publication.js'
import { exigerAdministrateur, exigerConnecte } from '../garde.js'

const schemaParametres = schemaReglages.extend({
  pinBorne: z.string().regex(/^\d{4,8}$/, 'Le code doit contenir de 4 à 8 chiffres.').optional(),
})

export async function routesBorne(app: FastifyInstance): Promise<void> {
  /** Sondage économique de l'agent de la borne : une réponse de 60 octets. */
  app.get('/publication/courante/entete', async () => {
    const courante = publicationCourante()
    return courante
      ? { version: courante.version, empreinte: courante.empreinte }
      : { version: 0, empreinte: '' }
  })

  /** Manifeste complet lu par la borne (§7.6). Aucune session requise :
   *  c'est exactement ce que voient les visiteurs. */
  app.get('/publication/courante', async (_requete, reponse) => {
    const courante = publicationCourante()
    if (!courante) throw erreurs.mediaIntrouvable()
    reponse.header('Cache-Control', 'no-store')
    return courante.manifeste
  })

  app.get('/publications', async (requete) => {
    exigerConnecte(requete)
    return listerPublications()
  })

  app.get('/parametres', async (requete) => {
    exigerConnecte(requete)
    const utilisateur = requete.utilisateur
    return {
      ...lireReglages(),
      // Le code PIN n'est visible que par un administrateur.
      pinBorne: utilisateur?.role === 'administrateur' ? lirePinBorne() : null,
    }
  })

  app.put('/parametres', async (requete) => {
    const utilisateur = exigerConnecte(requete)
    const entree = schemaParametres.parse(requete.body)

    const { pinBorne, ...reglages } = entree
    ecrireParametre('reglages', reglages)

    if (pinBorne !== undefined) {
      if (utilisateur.role !== 'administrateur') throw erreurs.droitInsuffisant()
      ecrireParametre('pinBorne', pinBorne)
    }

    journaliser({
      utilisateurId: utilisateur.id,
      action: 'parametres.modifies',
      resume: `${utilisateur.nomAffiche} a modifié les réglages de la borne`,
    })

    // Les réglages font partie du manifeste : ils demandent une publication.
    const version = regenererPublication('Modification des réglages', utilisateur.id)
    return { ok: true, version }
  })

  app.get('/utilisateurs', async (requete) => {
    exigerAdministrateur(requete)
    return listerUtilisateurs()
  })

  app.get('/journal', async (requete) => {
    exigerAdministrateur(requete)
    return lireJournal(100)
  })

  app.get('/sante', async () => {
    const courante = publicationCourante()
    return {
      etat: 'ok',
      publication: courante?.version ?? 0,
      pagesEnLigne: courante?.manifeste.pages.length ?? 0,
      genereLe: courante?.manifeste.genereLe ?? null,
    }
  })
}
