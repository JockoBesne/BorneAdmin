import process from 'node:process'
import { base } from './base/connexion.js'
import { config } from './config.js'
import { purgerCorbeille } from './services/pages.js'
import { purgerSessions } from './securite/sessions.js'
import { construireServeur } from './http/serveur.js'

async function demarrer(): Promise<void> {
  base() // ouvre la base et applique les migrations
  purgerSessions()

  const app = await construireServeur()

  // Ménage horaire : sessions expirées et corbeille au-delà de 30 jours.
  const menage = setInterval(
    () => {
      purgerSessions()
      const purgees = purgerCorbeille()
      if (purgees > 0) app.log.info(`corbeille : ${purgees} page(s) purgée(s)`)
    },
    60 * 60 * 1000,
  )

  const arreter = async (signal: string) => {
    app.log.info(`arrêt demandé (${signal})`)
    clearInterval(menage)
    await app.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void arreter('SIGINT'))
  process.on('SIGTERM', () => void arreter('SIGTERM'))

  await app.listen({ port: config.port, host: config.hote })
  app.log.info(`données : ${config.racineDonnees}`)
}

demarrer().catch((erreur) => {
  console.error('[api] démarrage impossible :', erreur)
  process.exit(1)
})
