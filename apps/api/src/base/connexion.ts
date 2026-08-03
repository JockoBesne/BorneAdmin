import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { cheminBase, config, racineMedias, racineMigrations } from '../config.js'

/** Connexion unique à la base. SQLite est un fichier : la sauvegarde du musée
 *  consiste à le copier (§9.1). */
export type Base = Database.Database

let instance: Base | null = null

export function base(): Base {
  if (instance) return instance

  mkdirSync(config.racineDonnees, { recursive: true })
  mkdirSync(racineMedias, { recursive: true })

  const db = new Database(cheminBase)
  db.pragma('journal_mode = WAL') // lectures concurrentes pendant l'écriture
  db.pragma('foreign_keys = ON') // intégrité référentielle réellement appliquée
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 5000')

  appliquerMigrations(db)
  instance = db
  return db
}

/**
 * Exécuteur de migrations : les fichiers `.sql` numérotés sont appliqués dans
 * l'ordre, une fois, dans une transaction. Une quarantaine de lignes plutôt
 * qu'un outil à apprendre et à maintenir (§9.7).
 */
function appliquerMigrations(db: Base): void {
  db.exec(`CREATE TABLE IF NOT EXISTS migration (
    version     INTEGER PRIMARY KEY,
    nom         TEXT NOT NULL,
    applique_le TEXT NOT NULL
  )`)

  const deja = new Set<number>(
    db
      .prepare('SELECT version FROM migration')
      .all()
      .map((ligne) => (ligne as { version: number }).version),
  )

  const fichiers = readdirSync(racineMigrations)
    .filter((nom) => nom.endsWith('.sql'))
    .sort()

  for (const fichier of fichiers) {
    const version = Number.parseInt(fichier.slice(0, 3), 10)
    if (Number.isNaN(version)) {
      throw new Error(`Migration mal nommée : ${fichier} (attendu « 001_nom.sql »)`)
    }
    if (deja.has(version)) continue

    const sql = readFileSync(path.join(racineMigrations, fichier), 'utf8')
    const appliquer = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO migration (version, nom, applique_le) VALUES (?, ?, ?)').run(
        version,
        fichier,
        new Date().toISOString(),
      )
    })
    appliquer()
    console.log(`[base] migration appliquée : ${fichier}`)
  }
}

/** Enveloppe transactionnelle : une écriture métier est atomique ou n'est pas. */
export function transaction<T>(travail: () => T): T {
  return base().transaction(travail)()
}
