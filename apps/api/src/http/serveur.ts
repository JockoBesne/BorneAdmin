import { existsSync } from 'node:fs'
import path from 'node:path'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import statique from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { config } from '../config.js'
import { ErreurMetier } from '../domaine/erreurs.js'
import { nouvelId } from '../domaine/identifiants.js'
import { chargerSession, entetesSecurite } from './garde.js'
import { routesAuth } from './routes/auth.js'
import { routesBorne } from './routes/borne.js'
import { routesMedias } from './routes/medias.js'
import { routesPages } from './routes/pages.js'

export async function construireServeur(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NIVEAU_LOG ?? 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    },
    bodyLimit: 2 * 1024 * 1024, // le JSON reste petit ; les fichiers passent par multipart
    trustProxy: true,
  })

  await app.register(cookie)
  await app.register(cors, {
    origin: config.originesAutorisees,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Jeton-CSRF'],
  })
  await app.register(multipart, {
    limits: { fileSize: config.tailleMaxVideo, files: 1, fields: 8 },
  })

  app.addHook('onRequest', async (requete, reponse) => {
    entetesSecurite(requete, reponse)
    chargerSession(requete)
  })

  // ── Gestionnaire d'erreurs unique (§16.2) ──────────────────────────────────
  app.setErrorHandler((erreur, requete, reponse) => {
    if (erreur instanceof ErreurMetier) {
      return reponse.code(erreur.statut).send({
        erreur: { code: erreur.code, message: erreur.message, details: erreur.details },
      })
    }

    if (erreur instanceof ZodError) {
      const premier = erreur.issues[0]
      return reponse.code(400).send({
        erreur: {
          code: 'ENTREE_INVALIDE',
          message: premier?.message ?? "Les informations envoyées ne sont pas valides.",
          details: erreur.issues,
        },
      })
    }

    if ((erreur as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      return reponse.code(413).send({
        erreur: {
          code: 'FICHIER_REFUSE',
          message: `Ce fichier dépasse la taille maximale de ${Math.round(config.tailleMaxVideo / 1024 / 1024)} Mo.`,
        },
      })
    }

    // Cas imprévu : trace complète côté serveur, identifiant seul côté client.
    const incident = nouvelId()
    requete.log.error({ incident, err: erreur }, "erreur inattendue")
    return reponse.code(500).send({
      erreur: {
        code: 'ERREUR_INTERNE',
        message:
          "Une erreur inattendue s'est produite. Rien n'a été perdu : votre travail est enregistré.",
        incident,
      },
    })
  })

  await app.register(
    async (portee) => {
      await routesAuth(portee)
      await routesPages(portee)
      await routesMedias(portee)
      await routesBorne(portee)
    },
    { prefix: '/api/v1' },
  )

  await servirApplications(app)

  return app
}

/**
 * En production, l'API sert aussi les deux interfaces compilées :
 *   /        → la borne
 *   /admin   → l'administration
 * En développement, chaque application a son serveur Vite et rien n'est servi ici.
 */
async function servirApplications(app: FastifyInstance): Promise<void> {
  const racineApps = path.join(config.racineApi, '..')
  const distBorne = path.join(racineApps, 'borne', 'dist')
  const distAdmin = path.join(racineApps, 'admin', 'dist')

  if (existsSync(distAdmin)) {
    await app.register(statique, {
      root: distAdmin,
      prefix: '/admin/',
      decorateReply: false,
    })
    app.get('/admin', async (_r, reponse) => reponse.redirect('/admin/'))
    app.setNotFoundHandler(async (requete, reponse) => {
      if (requete.url.startsWith('/api/')) {
        return reponse.code(404).send({
          erreur: { code: 'ROUTE_INTROUVABLE', message: 'Adresse inconnue.' },
        })
      }
      // Application monopage : toute autre adresse renvoie l'application.
      const fichier = requete.url.startsWith('/admin') ? distAdmin : distBorne
      if (!existsSync(path.join(fichier, 'index.html'))) {
        return reponse.code(404).send('Interface non compilée. Lancez « npm run build ».')
      }
      return reponse.type('text/html').send(
        (await import('node:fs/promises')).readFile(path.join(fichier, 'index.html'), 'utf8'),
      )
    })
  }

  if (existsSync(distBorne)) {
    await app.register(statique, {
      root: distBorne,
      prefix: '/',
      decorateReply: false,
    })
  }
}
