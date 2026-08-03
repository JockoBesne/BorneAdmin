import { createHash, randomBytes } from 'node:crypto'
import { base } from '../base/connexion.js'
import { config } from '../config.js'
import { nouvelId } from '../domaine/identifiants.js'

export const NOM_COOKIE = 'bornesid'

export interface Connecte {
  id: string
  identifiant: string
  nomAffiche: string
  role: 'administrateur' | 'editeur'
  jetonCsrf: string
}

/** Le jeton clair n'est jamais stocké : une fuite de base ne donne aucune
 *  session utilisable (§17.3). */
function empreinte(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex')
}

export function ouvrirSession(
  utilisateurId: string,
  adresseIp: string | undefined,
): { jeton: string; jetonCsrf: string; expireLe: Date } {
  const jeton = randomBytes(32).toString('base64url')
  const jetonCsrf = randomBytes(24).toString('base64url')
  const maintenant = new Date()
  const expireLe = new Date(maintenant.getTime() + config.heuresSession * 3600_000)

  base()
    .prepare(
      `INSERT INTO session (id, utilisateur_id, jeton_hash, jeton_csrf, cree_le, expire_le, adresse_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      nouvelId(),
      utilisateurId,
      empreinte(jeton),
      jetonCsrf,
      maintenant.toISOString(),
      expireLe.toISOString(),
      adresseIp ?? null,
    )

  return { jeton, jetonCsrf, expireLe }
}

export function lireSession(jeton: string | undefined): Connecte | null {
  if (!jeton) return null

  const ligne = base()
    .prepare(
      `SELECT u.id, u.identifiant, u.nom_affiche, u.role, u.actif, s.jeton_csrf, s.expire_le
         FROM session s
         JOIN utilisateur u ON u.id = s.utilisateur_id
        WHERE s.jeton_hash = ?`,
    )
    .get(empreinte(jeton)) as
    | {
        id: string
        identifiant: string
        nom_affiche: string
        role: 'administrateur' | 'editeur'
        actif: number
        jeton_csrf: string
        expire_le: string
      }
    | undefined

  if (!ligne) return null
  if (ligne.actif !== 1) return null
  if (new Date(ligne.expire_le).getTime() < Date.now()) {
    fermerSession(jeton)
    return null
  }

  return {
    id: ligne.id,
    identifiant: ligne.identifiant,
    nomAffiche: ligne.nom_affiche,
    role: ligne.role,
    jetonCsrf: ligne.jeton_csrf,
  }
}

export function fermerSession(jeton: string | undefined): void {
  if (!jeton) return
  base().prepare('DELETE FROM session WHERE jeton_hash = ?').run(empreinte(jeton))
}

/** Ménage des sessions expirées — appelé au démarrage et une fois par heure. */
export function purgerSessions(): void {
  base().prepare('DELETE FROM session WHERE expire_le < ?').run(new Date().toISOString())
}
