import type { InfoMedia } from '@borne/contenu'
import { base } from '../base/connexion.js'

export interface Media {
  id: string
  empreinte: string
  type: 'image' | 'video'
  mime: string
  extension: string
  nomOrigine: string
  nomAffiche: string
  legende: string
  poidsOctets: number
  poidsOptimise: number
  largeur: number | null
  hauteur: number | null
  dureeSecondes: number | null
  aPoster: boolean
  pointFocal: { x: number; y: number }
  creeLe: string
  /** Nombre de pages qui l'utilisent — affiché sous chaque vignette (§5.6). */
  utilisations: number
}

interface LigneMedia {
  id: string
  empreinte: string
  type: 'image' | 'video'
  mime: string
  extension: string
  nom_origine: string
  nom_affiche: string
  legende: string
  poids_octets: number
  poids_optimise: number
  largeur: number | null
  hauteur: number | null
  duree_secondes: number | null
  a_poster: number
  point_focal_x: number
  point_focal_y: number
  cree_le: string
  utilisations: number
}

const CHAMPS = `m.*, (SELECT COUNT(*) FROM page_media pm
                       JOIN page p ON p.id = pm.page_id
                      WHERE pm.media_id = m.id AND p.etat != 'corbeille') AS utilisations`

function versMedia(ligne: LigneMedia): Media {
  return {
    id: ligne.id,
    empreinte: ligne.empreinte,
    type: ligne.type,
    mime: ligne.mime,
    extension: ligne.extension,
    nomOrigine: ligne.nom_origine,
    nomAffiche: ligne.nom_affiche,
    legende: ligne.legende,
    poidsOctets: ligne.poids_octets,
    poidsOptimise: ligne.poids_optimise,
    largeur: ligne.largeur,
    hauteur: ligne.hauteur,
    dureeSecondes: ligne.duree_secondes,
    aPoster: ligne.a_poster === 1,
    pointFocal: { x: ligne.point_focal_x, y: ligne.point_focal_y },
    creeLe: ligne.cree_le,
    utilisations: ligne.utilisations,
  }
}

export function listerMedias(filtre: { type?: 'image' | 'video' } = {}): Media[] {
  const clause = filtre.type ? 'WHERE m.type = ?' : ''
  const parametres = filtre.type ? [filtre.type] : []
  const lignes = base()
    .prepare(`SELECT ${CHAMPS} FROM media m ${clause} ORDER BY m.cree_le DESC`)
    .all(...parametres) as LigneMedia[]
  return lignes.map(versMedia)
}

export function lireMedia(id: string): Media | null {
  const ligne = base()
    .prepare(`SELECT ${CHAMPS} FROM media m WHERE m.id = ?`)
    .get(id) as LigneMedia | undefined
  return ligne ? versMedia(ligne) : null
}

export function lireMediaParEmpreinte(empreinte: string): Media | null {
  const ligne = base()
    .prepare(`SELECT ${CHAMPS} FROM media m WHERE m.empreinte = ?`)
    .get(empreinte) as LigneMedia | undefined
  return ligne ? versMedia(ligne) : null
}

export function creerMedia(media: {
  id: string
  empreinte: string
  type: 'image' | 'video'
  mime: string
  extension: string
  nomOrigine: string
  nomAffiche: string
  poidsOctets: number
  poidsOptimise: number
  largeur: number | null
  hauteur: number | null
  dureeSecondes: number | null
  aPoster: boolean
  utilisateurId: string
}): void {
  base()
    .prepare(
      `INSERT INTO media (id, empreinte, type, mime, extension, nom_origine, nom_affiche,
                          poids_octets, poids_optimise, largeur, hauteur, duree_secondes,
                          a_poster, cree_le, cree_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      media.id,
      media.empreinte,
      media.type,
      media.mime,
      media.extension,
      media.nomOrigine,
      media.nomAffiche,
      media.poidsOctets,
      media.poidsOptimise,
      media.largeur,
      media.hauteur,
      media.dureeSecondes,
      media.aPoster ? 1 : 0,
      new Date().toISOString(),
      media.utilisateurId,
    )
}

export function majMedia(
  id: string,
  champs: { nomAffiche?: string; legende?: string; pointFocal?: { x: number; y: number } },
): void {
  const media = lireMedia(id)
  if (!media) return
  base()
    .prepare(
      `UPDATE media SET nom_affiche = ?, legende = ?, point_focal_x = ?, point_focal_y = ?
        WHERE id = ?`,
    )
    .run(
      champs.nomAffiche ?? media.nomAffiche,
      champs.legende ?? media.legende,
      champs.pointFocal?.x ?? media.pointFocal.x,
      champs.pointFocal?.y ?? media.pointFocal.y,
      id,
    )
}

export function supprimerMedia(id: string): void {
  base().prepare('DELETE FROM media WHERE id = ?').run(id)
}

/** Pages (hors corbeille) qui référencent ce média — F24, et sécurité de F23. */
export function pagesUtilisant(mediaId: string): { id: string; titre: string }[] {
  return base()
    .prepare(
      `SELECT p.id, p.titre FROM page_media pm
         JOIN page p ON p.id = pm.page_id
        WHERE pm.media_id = ? AND p.etat != 'corbeille'
        ORDER BY p.ordre`,
    )
    .all(mediaId) as { id: string; titre: string }[]
}

/** Vue minimale utilisée par les contrôles avant publication (§13.5). */
export function infosMedias(): Map<string, InfoMedia> {
  const lignes = base()
    .prepare('SELECT id, type, largeur, hauteur, duree_secondes, legende FROM media')
    .all() as {
    id: string
    type: 'image' | 'video'
    largeur: number | null
    hauteur: number | null
    duree_secondes: number | null
    legende: string
  }[]

  const carte = new Map<string, InfoMedia>()
  for (const ligne of lignes) {
    carte.set(ligne.id, {
      id: ligne.id,
      type: ligne.type,
      largeur: ligne.largeur,
      hauteur: ligne.hauteur,
      dureeSecondes: ligne.duree_secondes,
      legende: ligne.legende,
    })
  }
  return carte
}
