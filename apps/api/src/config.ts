import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const RACINE_API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Configuration d'exécution. Aucune valeur secrète en dur : tout vient de
 *  l'environnement, avec des valeurs par défaut utilisables en développement. */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  hote: process.env.HOTE ?? '127.0.0.1',

  /** Tout ce qui appartient au musée vit ici — c'est le dossier à sauvegarder. */
  racineDonnees: process.env.BORNE_DONNEES ?? path.join(RACINE_API, '..', '..', 'donnees'),

  racineApi: RACINE_API,

  /** Durée d'une session : une journée de travail (§17.3). */
  heuresSession: 8,

  /** Limites d'envoi (§15.2). */
  tailleMaxImage: 50 * 1024 * 1024,
  tailleMaxVideo: 200 * 1024 * 1024,

  /** En développement, les deux applications tournent sur leur propre port. */
  originesAutorisees: (
    process.env.ORIGINES ?? 'http://localhost:5173,http://localhost:5174'
  ).split(','),

  /** Cookie « Secure » seulement derrière HTTPS (§7.8.3). */
  cookieSecurise: process.env.NODE_ENV === 'production',
} as const

export const cheminBase = path.join(config.racineDonnees, 'donnees.db')
export const racineMedias = path.join(config.racineDonnees, 'medias')
export const racineMigrations = path.join(RACINE_API, 'migrations')
