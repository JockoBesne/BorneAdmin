import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { LISTE_MODELES } from '@borne/contenu'
import * as depot from '../../depots/pages.js'
import { erreurs } from '../../domaine/erreurs.js'
import * as service from '../../services/pages.js'
import { exigerConnecte } from '../garde.js'

const schemaCreation = z.object({
  titre: z.string().trim().min(1, 'Il manque le titre de la page.').max(120),
  modele: z.enum(['t1', 't2', 't3']),
})

const schemaBrouillon = z.object({
  titre: z.string().max(120),
  contenu: z.object({
    modele: z.enum(['t1', 't2', 't3']),
    emplacements: z.record(z.string(), z.unknown()),
  }),
  modifieeLe: z.string().nullable().optional(),
})

const schemaOrdre = z.object({ ids: z.array(z.string()).max(500) })

/** Vue transmise à l'administration : la liste ne porte pas les contenus
 *  complets, seulement ce qu'il faut pour l'afficher (§11.7). */
function versResume(page: depot.Page) {
  const aDesModifications =
    page.etat === 'en_ligne' &&
    JSON.stringify(page.contenuPublie) !== JSON.stringify(page.contenuBrouillon)

  return {
    id: page.id,
    titre: page.titre,
    modele: page.modele,
    etat: page.etat,
    ordre: page.ordre,
    modifieeLe: page.modifieeLe,
    modifieeParNom: page.modifieeParNom,
    publieeLe: page.publieeLe,
    supprimeeLe: page.supprimeeLe,
    aDesModifications,
  }
}

export async function routesPages(app: FastifyInstance): Promise<void> {
  app.get('/modeles', async () =>
    LISTE_MODELES.map((modele) => ({
      id: modele.id,
      nom: modele.nom,
      description: modele.description,
      emplacements: modele.emplacements,
      contenuVide: modele.contenuVide(),
    })),
  )

  app.get('/pages', async (requete) => {
    exigerConnecte(requete)
    const corbeille = (requete.query as { corbeille?: string }).corbeille === '1'
    return depot.listerPages({ corbeille }).map(versResume)
  })

  app.get<{ Params: { id: string } }>('/pages/:id', async (requete) => {
    exigerConnecte(requete)
    const page = depot.lirePage(requete.params.id)
    if (!page) throw erreurs.pageIntrouvable()
    return {
      ...versResume(page),
      contenuBrouillon: page.contenuBrouillon,
      contenuPublie: page.contenuPublie,
      problemes: service.controlerPage(page.contenuBrouillon),
    }
  })

  app.post('/pages', async (requete, reponse) => {
    const utilisateur = exigerConnecte(requete)
    const { titre, modele } = schemaCreation.parse(requete.body)
    const page = service.creerPage(titre, modele, utilisateur)
    reponse.code(201)
    return { ...versResume(page), contenuBrouillon: page.contenuBrouillon }
  })

  app.patch<{ Params: { id: string } }>('/pages/:id/brouillon', async (requete) => {
    const utilisateur = exigerConnecte(requete)
    const entree = schemaBrouillon.parse(requete.body)
    const resultat = service.enregistrerBrouillon(
      requete.params.id,
      {
        titre: entree.titre,
        contenu: entree.contenu as never,
        modifieeLe: entree.modifieeLe ?? null,
      },
      utilisateur,
    )
    const page = depot.lirePage(requete.params.id)
    return {
      ...resultat,
      problemes: page ? service.controlerPage(page.contenuBrouillon) : [],
    }
  })

  app.post<{ Params: { id: string } }>('/pages/:id/publication', async (requete) => {
    const utilisateur = exigerConnecte(requete)
    return service.mettreEnLigne(requete.params.id, utilisateur)
  })

  app.delete<{ Params: { id: string } }>('/pages/:id/publication', async (requete) => {
    const utilisateur = exigerConnecte(requete)
    return service.retirerDeLaBorne(requete.params.id, utilisateur)
  })

  app.post('/pages/ordre', async (requete) => {
    const utilisateur = exigerConnecte(requete)
    const { ids } = schemaOrdre.parse(requete.body)
    return service.reordonner(ids, utilisateur)
  })

  app.post<{ Params: { id: string } }>('/pages/:id/duplication', async (requete, reponse) => {
    const utilisateur = exigerConnecte(requete)
    const page = service.dupliquer(requete.params.id, utilisateur)
    reponse.code(201)
    return versResume(page)
  })

  app.delete<{ Params: { id: string } }>('/pages/:id', async (requete) => {
    const utilisateur = exigerConnecte(requete)
    service.mettreALaCorbeille(requete.params.id, utilisateur)
    return { ok: true }
  })

  app.post<{ Params: { id: string } }>('/pages/:id/restauration', async (requete) => {
    const utilisateur = exigerConnecte(requete)
    service.restaurer(requete.params.id, utilisateur)
    return { ok: true }
  })
}
