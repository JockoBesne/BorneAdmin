import { REGLAGES_DEFAUT, schemaReglages, type Reglages } from '@borne/contenu'
import { base } from '../base/connexion.js'

// ── Utilisateurs ─────────────────────────────────────────────────────────────

export interface Utilisateur {
  id: string
  identifiant: string
  nomAffiche: string
  role: 'administrateur' | 'editeur'
  actif: boolean
  creeLe: string
  derniereConnexionLe: string | null
}

interface LigneUtilisateur {
  id: string
  identifiant: string
  nom_affiche: string
  mot_de_passe_hash: string
  role: 'administrateur' | 'editeur'
  actif: number
  cree_le: string
  derniere_connexion_le: string | null
  echecs_connexion: number
  bloque_jusqu_a: string | null
}

export function lireUtilisateurParIdentifiant(identifiant: string): LigneUtilisateur | null {
  return (
    (base()
      .prepare('SELECT * FROM utilisateur WHERE identifiant = ?')
      .get(identifiant) as LigneUtilisateur | undefined) ?? null
  )
}

export function listerUtilisateurs(): Utilisateur[] {
  const lignes = base()
    .prepare('SELECT * FROM utilisateur ORDER BY nom_affiche')
    .all() as LigneUtilisateur[]
  return lignes.map((l) => ({
    id: l.id,
    identifiant: l.identifiant,
    nomAffiche: l.nom_affiche,
    role: l.role,
    actif: l.actif === 1,
    creeLe: l.cree_le,
    derniereConnexionLe: l.derniere_connexion_le,
  }))
}

export function creerUtilisateur(utilisateur: {
  id: string
  identifiant: string
  nomAffiche: string
  motDePasseHash: string
  role: 'administrateur' | 'editeur'
}): void {
  base()
    .prepare(
      `INSERT INTO utilisateur (id, identifiant, nom_affiche, mot_de_passe_hash, role, cree_le)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      utilisateur.id,
      utilisateur.identifiant,
      utilisateur.nomAffiche,
      utilisateur.motDePasseHash,
      utilisateur.role,
      new Date().toISOString(),
    )
}

export function noterConnexionReussie(id: string): void {
  base()
    .prepare(
      'UPDATE utilisateur SET derniere_connexion_le = ?, echecs_connexion = 0, bloque_jusqu_a = NULL WHERE id = ?',
    )
    .run(new Date().toISOString(), id)
}

/** Blocage progressif après échecs : 1 min, 5 min, puis 15 min (§17.3). */
export function noterEchecConnexion(id: string, echecs: number): void {
  const paliers: Record<number, number> = { 5: 1, 6: 5, 7: 15 }
  const minutes = echecs >= 7 ? 15 : (paliers[echecs] ?? 0)
  const bloqueJusquA =
    minutes > 0 ? new Date(Date.now() + minutes * 60_000).toISOString() : null
  base()
    .prepare('UPDATE utilisateur SET echecs_connexion = ?, bloque_jusqu_a = ? WHERE id = ?')
    .run(echecs, bloqueJusquA, id)
}

// ── Paramètres ───────────────────────────────────────────────────────────────

export function lireParametre<T>(cle: string, defaut: T): T {
  const ligne = base().prepare('SELECT valeur FROM parametre WHERE cle = ?').get(cle) as
    | { valeur: string }
    | undefined
  if (!ligne) return defaut
  try {
    return JSON.parse(ligne.valeur) as T
  } catch {
    return defaut
  }
}

export function ecrireParametre(cle: string, valeur: unknown): void {
  base()
    .prepare(
      `INSERT INTO parametre (cle, valeur, modifie_le) VALUES (?, ?, ?)
       ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, modifie_le = excluded.modifie_le`,
    )
    .run(cle, JSON.stringify(valeur), new Date().toISOString())
}

export function lireReglages(): Reglages {
  const brut = lireParametre<unknown>('reglages', REGLAGES_DEFAUT)
  const analyse = schemaReglages.safeParse(brut)
  return analyse.success ? analyse.data : REGLAGES_DEFAUT
}

export const PIN_DEFAUT = '1975'

export function lirePinBorne(): string {
  return lireParametre<string>('pinBorne', PIN_DEFAUT)
}

// ── Journal des actions ──────────────────────────────────────────────────────

export function journaliser(entree: {
  utilisateurId: string | null
  action: string
  resume: string
  cibleId?: string | null
  adresseIp?: string | null
}): void {
  base()
    .prepare(
      `INSERT INTO journal (horodatage, utilisateur_id, action, resume, cible_id, adresse_ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      new Date().toISOString(),
      entree.utilisateurId,
      entree.action,
      entree.resume,
      entree.cibleId ?? null,
      entree.adresseIp ?? null,
    )
}

export function lireJournal(limite = 100): {
  horodatage: string
  resume: string
  action: string
}[] {
  return base()
    .prepare(
      'SELECT horodatage, resume, action FROM journal ORDER BY horodatage DESC LIMIT ?',
    )
    .all(limite) as { horodatage: string; resume: string; action: string }[]
}
