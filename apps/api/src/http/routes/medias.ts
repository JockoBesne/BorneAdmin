import { createReadStream, existsSync, statSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { config } from '../../config.js'
import * as depot from '../../depots/medias.js'
import { erreurs } from '../../domaine/erreurs.js'
import { cheminFichier } from '../../medias/stockage.js'
import * as service from '../../services/medias.js'
import { exigerConnecte } from '../garde.js'

const TYPES_FICHIER: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

const schemaMaj = z.object({
  nomAffiche: z.string().trim().min(1).max(120).optional(),
  legende: z.string().max(200).optional(),
  pointFocal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
})

export async function routesMedias(app: FastifyInstance): Promise<void> {
  app.get('/medias', async (requete) => {
    exigerConnecte(requete)
    const type = (requete.query as { type?: string }).type
    const filtre: { type?: 'image' | 'video' } =
      type === 'image' || type === 'video' ? { type } : {}
    return depot.listerMedias(filtre).map(service.versPublic)
  })

  app.get<{ Params: { id: string } }>('/medias/:id', async (requete) => {
    exigerConnecte(requete)
    const media = depot.lireMedia(requete.params.id)
    if (!media) throw erreurs.mediaIntrouvable()
    return {
      ...service.versPublic(media),
      pages: depot.pagesUtilisant(media.id),
    }
  })

  app.post('/medias', async (requete, reponse) => {
    const utilisateur = exigerConnecte(requete)

    let donnees: Buffer | null = null
    let nomOrigine = 'fichier'
    let typeDeclare = ''
    let poster: Buffer | undefined
    let dureeSecondes: number | undefined

    for await (const part of requete.parts()) {
      if (part.type === 'file') {
        if (part.fieldname === 'fichier') {
          nomOrigine = part.filename || 'fichier'
          typeDeclare = part.mimetype
          donnees = await part.toBuffer()
        } else {
          await part.toBuffer() // champ inattendu : consommé puis ignoré
        }
      } else if (part.fieldname === 'poster' && typeof part.value === 'string') {
        const base64 = part.value.replace(/^data:image\/\w+;base64,/, '')
        poster = Buffer.from(base64, 'base64')
      } else if (part.fieldname === 'dureeSecondes' && typeof part.value === 'string') {
        const valeur = Number.parseFloat(part.value)
        if (Number.isFinite(valeur)) dureeSecondes = valeur
      }
    }

    if (!donnees || donnees.length === 0) {
      throw erreurs.entreeInvalide('Aucun fichier reçu.')
    }

    const estVideo = typeDeclare.startsWith('video/')
    const limite = estVideo ? config.tailleMaxVideo : config.tailleMaxImage
    if (donnees.length > limite) {
      const mo = Math.round(donnees.length / 1024 / 1024)
      const limiteMo = Math.round(limite / 1024 / 1024)
      throw erreurs.fichierRefuse(
        estVideo
          ? `Cette vidéo pèse ${mo} Mo, la limite est de ${limiteMo} Mo. Elle est probablement en très haute définition : demandez une version « 1080p », ou réduisez-la avec VLC (Média → Convertir).`
          : `Cette photo pèse ${mo} Mo, la limite est de ${limiteMo} Mo.`,
      )
    }

    const media = await service.televerser(
      { donnees, nomOrigine, typeDeclare, poster, dureeSecondes },
      utilisateur,
    )
    reponse.code(201)
    return media
  })

  app.patch<{ Params: { id: string } }>('/medias/:id', async (requete) => {
    exigerConnecte(requete)
    const champs = schemaMaj.parse(requete.body)
    const media = depot.lireMedia(requete.params.id)
    if (!media) throw erreurs.mediaIntrouvable()
    depot.majMedia(media.id, champs)
    const misAJour = depot.lireMedia(media.id)
    if (!misAJour) throw erreurs.mediaIntrouvable()
    return service.versPublic(misAJour)
  })

  app.delete<{ Params: { id: string } }>('/medias/:id', async (requete) => {
    const utilisateur = exigerConnecte(requete)
    service.supprimer(requete.params.id, utilisateur)
    return { ok: true }
  })

  /**
   * Service des fichiers. Sans session : la borne doit pouvoir les télécharger,
   * le contenu est destiné à l'affichage public et le nom porte une empreinte
   * non devinable (décision explicite, §17.6).
   */
  app.get<{ Params: { empreinte: string; nom: string } }>(
    '/fichiers/:empreinte/:nom',
    async (requete, reponse) => {
      const { empreinte, nom } = requete.params
      if (!/^[a-f0-9]{6,64}$/.test(empreinte) || !/^[a-z0-9._-]+$/i.test(nom)) {
        throw erreurs.entreeInvalide('Fichier demandé invalide.')
      }

      const chemin = cheminFichier(empreinte, nom)
      if (!existsSync(chemin)) throw erreurs.mediaIntrouvable()

      const point = nom.lastIndexOf('.')
      const extension = point >= 0 ? nom.slice(point).toLowerCase() : ''
      const taille = statSync(chemin).size

      reponse
        .header('Content-Type', TYPES_FICHIER[extension] ?? 'application/octet-stream')
        .header('Content-Length', String(taille))
        // Possible parce que le nom contient l'empreinte du contenu (§11.7).
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('X-Content-Type-Options', 'nosniff')

      return reponse.send(createReadStream(chemin))
    },
  )
}
