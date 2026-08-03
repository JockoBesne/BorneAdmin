import { mediasReferences, type ContenuPage, type IdModele } from '@borne/contenu'
import { base } from '../base/connexion.js'

export type EtatPage = 'brouillon' | 'en_ligne' | 'retiree' | 'corbeille'

export interface Page {
  id: string
  modele: IdModele
  titre: string
  etat: EtatPage
  ordre: number
  contenuBrouillon: ContenuPage
  contenuPublie: ContenuPage | null
  creeLe: string
  modifieeLe: string
  modifieePar: string
  modifieeParNom: string
  publieeLe: string | null
  supprimeeLe: string | null
}

interface LignePage {
  id: string
  modele: IdModele
  titre: string
  etat: EtatPage
  ordre: number
  contenu_brouillon: string
  contenu_publie: string | null
  cree_le: string
  modifiee_le: string
  modifiee_par: string
  modifiee_par_nom: string
  publiee_le: string | null
  supprimee_le: string | null
}

const CHAMPS = `p.id, p.modele, p.titre, p.etat, p.ordre, p.contenu_brouillon,
                p.contenu_publie, p.cree_le, p.modifiee_le, p.modifiee_par,
                COALESCE(u.nom_affiche, '') AS modifiee_par_nom,
                p.publiee_le, p.supprimee_le`

function versPage(ligne: LignePage): Page {
  return {
    id: ligne.id,
    modele: ligne.modele,
    titre: ligne.titre,
    etat: ligne.etat,
    ordre: ligne.ordre,
    contenuBrouillon: JSON.parse(ligne.contenu_brouillon) as ContenuPage,
    contenuPublie: ligne.contenu_publie
      ? (JSON.parse(ligne.contenu_publie) as ContenuPage)
      : null,
    creeLe: ligne.cree_le,
    modifieeLe: ligne.modifiee_le,
    modifieePar: ligne.modifiee_par,
    modifieeParNom: ligne.modifiee_par_nom,
    publieeLe: ligne.publiee_le,
    supprimeeLe: ligne.supprimee_le,
  }
}

export function listerPages(options: { corbeille?: boolean } = {}): Page[] {
  const clause = options.corbeille ? "p.etat = 'corbeille'" : "p.etat != 'corbeille'"
  const lignes = base()
    .prepare(
      `SELECT ${CHAMPS} FROM page p
         LEFT JOIN utilisateur u ON u.id = p.modifiee_par
        WHERE ${clause}
        ORDER BY p.ordre ASC`,
    )
    .all() as LignePage[]
  return lignes.map(versPage)
}

export function pagesEnLigne(): Page[] {
  const lignes = base()
    .prepare(
      `SELECT ${CHAMPS} FROM page p
         LEFT JOIN utilisateur u ON u.id = p.modifiee_par
        WHERE p.etat = 'en_ligne' AND p.contenu_publie IS NOT NULL
        ORDER BY p.ordre ASC`,
    )
    .all() as LignePage[]
  return lignes.map(versPage)
}

export function lirePage(id: string): Page | null {
  const ligne = base()
    .prepare(
      `SELECT ${CHAMPS} FROM page p
         LEFT JOIN utilisateur u ON u.id = p.modifiee_par
        WHERE p.id = ?`,
    )
    .get(id) as LignePage | undefined
  return ligne ? versPage(ligne) : null
}

export function prochainOrdre(): number {
  const ligne = base()
    .prepare("SELECT COALESCE(MAX(ordre), 0) AS maxi FROM page WHERE etat != 'corbeille'")
    .get() as { maxi: number }
  return ligne.maxi + 1
}

export function creerPage(page: {
  id: string
  modele: IdModele
  titre: string
  ordre: number
  contenu: ContenuPage
  utilisateurId: string
}): void {
  const maintenant = new Date().toISOString()
  base()
    .prepare(
      `INSERT INTO page (id, modele, titre, etat, ordre, contenu_brouillon, contenu_publie,
                         cree_le, cree_par, modifiee_le, modifiee_par)
       VALUES (?, ?, ?, 'brouillon', ?, ?, NULL, ?, ?, ?, ?)`,
    )
    .run(
      page.id,
      page.modele,
      page.titre,
      page.ordre,
      JSON.stringify(page.contenu),
      maintenant,
      page.utilisateurId,
      maintenant,
      page.utilisateurId,
    )
  reconstruireIndexMedias(page.id)
}

export function enregistrerBrouillon(
  id: string,
  titre: string,
  contenu: ContenuPage,
  utilisateurId: string,
): string {
  const maintenant = new Date().toISOString()
  base()
    .prepare(
      `UPDATE page SET titre = ?, contenu_brouillon = ?, modifiee_le = ?, modifiee_par = ?
        WHERE id = ?`,
    )
    .run(titre, JSON.stringify(contenu), maintenant, utilisateurId, id)
  reconstruireIndexMedias(id)
  return maintenant
}

export function marquerEnLigne(id: string, contenu: ContenuPage): void {
  const maintenant = new Date().toISOString()
  base()
    .prepare(
      `UPDATE page SET etat = 'en_ligne', contenu_publie = ?, publiee_le = ? WHERE id = ?`,
    )
    .run(JSON.stringify(contenu), maintenant, id)
}

export function changerEtat(id: string, etat: EtatPage): void {
  const supprimeeLe = etat === 'corbeille' ? new Date().toISOString() : null
  base()
    .prepare('UPDATE page SET etat = ?, supprimee_le = ? WHERE id = ?')
    .run(etat, supprimeeLe, id)
}

export function changerOrdre(ordres: { id: string; ordre: number }[]): void {
  const requete = base().prepare('UPDATE page SET ordre = ? WHERE id = ?')
  for (const { id, ordre } of ordres) requete.run(ordre, id)
}

export function renommer(id: string, titre: string): void {
  base().prepare('UPDATE page SET titre = ? WHERE id = ?').run(titre, id)
}

/**
 * Reconstruit l'index d'usage des médias pour une page (§9.4).
 * Appelé dans la même transaction que toute écriture de contenu, il ne peut
 * donc jamais être décalé par rapport au contenu réel.
 */
export function reconstruireIndexMedias(pageId: string): void {
  const page = lirePage(pageId)
  if (!page) return

  const ids = new Set<string>([
    ...mediasReferences(page.contenuBrouillon),
    ...(page.contenuPublie ? mediasReferences(page.contenuPublie) : []),
  ])

  base().prepare('DELETE FROM page_media WHERE page_id = ?').run(pageId)
  const inserer = base().prepare(
    'INSERT OR IGNORE INTO page_media (page_id, media_id) VALUES (?, ?)',
  )
  for (const mediaId of ids) {
    // « OR IGNORE » : un média supprimé entre-temps ne doit pas faire échouer
    // l'enregistrement du brouillon ; le contrôle avant publication le signalera.
    try {
      inserer.run(pageId, mediaId)
    } catch {
      /* média inconnu : ignoré ici, bloqué à la publication (§13.5) */
    }
  }
}

export function purgerCorbeille(joursConservation: number): number {
  const limite = new Date(Date.now() - joursConservation * 86400_000).toISOString()
  const resultat = base()
    .prepare("DELETE FROM page WHERE etat = 'corbeille' AND supprimee_le < ?")
    .run(limite)
  return resultat.changes
}
