import { createHash } from 'node:crypto'
import {
  mediasReferences,
  schemaManifeste,
  type ContenuPage,
  type Manifeste,
  type MediaManifeste,
} from '@borne/contenu'
import { base } from '../base/connexion.js'
import { lireReglages } from '../depots/divers.js'
import { lireMedia, type Media } from '../depots/medias.js'
import { pagesEnLigne } from '../depots/pages.js'

/**
 * Publication = instantané complet, immuable et numéroté du contenu destiné à
 * la borne (§7.6). Une seule notion résout l'atomicité, le retour arrière,
 * l'historique et la synchronisation.
 */

export function urlFichier(empreinte: string, nomFichier: string): string {
  return `/api/v1/fichiers/${empreinte}/${nomFichier}`
}

function mediaVersManifeste(media: Media): MediaManifeste {
  const fichiers =
    media.type === 'image'
      ? ([
          { profil: 'vignette' as const, chemin: urlFichier(media.empreinte, 'vignette.webp'), octets: 0 },
          { profil: 'moyen' as const, chemin: urlFichier(media.empreinte, 'moyen.webp'), octets: 0 },
          { profil: 'grand' as const, chemin: urlFichier(media.empreinte, 'grand.webp'), octets: media.poidsOptimise },
        ])
      : ([
          {
            profil: 'origine' as const,
            chemin: urlFichier(media.empreinte, `origine.${media.extension}`),
            octets: media.poidsOctets,
          },
        ])

  return {
    id: media.id,
    empreinte: media.empreinte,
    type: media.type,
    legende: media.legende,
    largeur: media.largeur,
    hauteur: media.hauteur,
    dureeSecondes: media.dureeSecondes,
    posterChemin: media.aPoster ? urlFichier(media.empreinte, 'poster.webp') : null,
    pointFocal: media.pointFocal,
    fichiers,
  }
}

/** Vignette d'une page pour le sommaire de la borne : la première image
 *  trouvée dans le contenu, ou l'image de couverture de la vidéo. */
function vignetteDe(contenu: ContenuPage, medias: Map<string, Media>): string | null {
  for (const id of mediasReferences(contenu)) {
    const media = medias.get(id)
    if (!media) continue
    if (media.type === 'image') return urlFichier(media.empreinte, 'moyen.webp')
    if (media.type === 'video' && media.aPoster) return urlFichier(media.empreinte, 'poster.webp')
  }
  return null
}

export function construireManifeste(version: number): Manifeste {
  const pages = pagesEnLigne()

  const medias = new Map<string, Media>()
  for (const page of pages) {
    if (!page.contenuPublie) continue
    for (const id of mediasReferences(page.contenuPublie)) {
      if (medias.has(id)) continue
      const media = lireMedia(id)
      if (media) medias.set(id, media)
    }
  }

  const manifeste: Manifeste = {
    version,
    genereLe: new Date().toISOString(),
    reglages: lireReglages(),
    pages: pages.map((page, index) => ({
      id: page.id,
      titre: page.titre,
      modele: page.modele,
      ordre: index + 1,
      vignette: page.contenuPublie ? vignetteDe(page.contenuPublie, medias) : null,
      contenu: (page.contenuPublie ?? { modele: page.modele, emplacements: {} }) as never,
    })),
    medias: [...medias.values()].map(mediaVersManifeste),
  }

  // Validé à la production comme à la lecture : une publication abîmée est
  // refusée avant d'être affichée, jamais après (§14.3).
  return schemaManifeste.parse(manifeste)
}

/** Crée une nouvelle publication. Appelée après toute action qui change ce que
 *  voient les visiteurs : mise en ligne, retrait, réordonnancement, réglages. */
export function regenererPublication(motif: string, utilisateurId: string): number {
  const derniere = base()
    .prepare('SELECT COALESCE(MAX(version), 0) AS maxi FROM publication')
    .get() as { maxi: number }
  const version = derniere.maxi + 1

  const manifeste = construireManifeste(version)
  const texte = JSON.stringify(manifeste)
  const empreinte = createHash('sha256').update(texte).digest('hex').slice(0, 16)

  base()
    .prepare(
      `INSERT INTO publication (version, manifeste, empreinte, cree_le, cree_par, motif)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(version, texte, empreinte, new Date().toISOString(), utilisateurId, motif)

  // Les 20 dernières publications sont conservées (§7.6).
  base()
    .prepare(
      'DELETE FROM publication WHERE version <= (SELECT MAX(version) - 20 FROM publication)',
    )
    .run()

  return version
}

export function publicationCourante(): { version: number; empreinte: string; manifeste: Manifeste } | null {
  const ligne = base()
    .prepare('SELECT version, empreinte, manifeste FROM publication ORDER BY version DESC LIMIT 1')
    .get() as { version: number; empreinte: string; manifeste: string } | undefined
  if (!ligne) return null
  return {
    version: ligne.version,
    empreinte: ligne.empreinte,
    manifeste: JSON.parse(ligne.manifeste) as Manifeste,
  }
}

export function listerPublications(): {
  version: number
  creeLe: string
  motif: string
}[] {
  return base()
    .prepare(
      'SELECT version, cree_le AS creeLe, motif FROM publication ORDER BY version DESC',
    )
    .all() as { version: number; creeLe: string; motif: string }[]
}
