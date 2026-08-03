import {
  schemaManifeste,
  type Manifeste,
  type MediaManifeste,
  type ProfilImage,
} from '@borne/contenu'
import type { MediaResolu, ResoudreMedia } from '@borne/contenu/rendu'

const CLE_CACHE = 'borne.manifeste'

/**
 * Chargement du contenu.
 *
 * La borne garde en permanence une copie complète de la dernière publication
 * valide. Si l'API est injoignable, elle affiche cette copie : le réseau ne
 * sert qu'à *rafraîchir* le contenu, jamais à l'afficher (§7.1).
 *
 * En production, ce rôle revient à « borne-agent », qui écrit la publication
 * sur le disque du PC de la borne ; ici, le stockage local du navigateur rend
 * le même service pour une démonstration sur une seule machine.
 */

function lireCache(): Manifeste | null {
  try {
    const brut = localStorage.getItem(CLE_CACHE)
    if (!brut) return null
    const analyse = schemaManifeste.safeParse(JSON.parse(brut))
    return analyse.success ? analyse.data : null
  } catch {
    return null
  }
}

function ecrireCache(manifeste: Manifeste): void {
  try {
    localStorage.setItem(CLE_CACHE, JSON.stringify(manifeste))
  } catch {
    /* quota atteint : le contenu reste affiché, seule la copie locale manque */
  }
}

export interface Chargement {
  manifeste: Manifeste
  horsLigne: boolean
}

export async function chargerManifeste(): Promise<Chargement> {
  try {
    const reponse = await fetch('/api/v1/publication/courante', { cache: 'no-store' })
    if (!reponse.ok) throw new Error(`réponse ${reponse.status}`)

    // Validé à la lecture : une publication abîmée est refusée avant d'être
    // affichée, jamais après (§14.3).
    const manifeste = schemaManifeste.parse(await reponse.json())
    ecrireCache(manifeste)
    return { manifeste, horsLigne: false }
  } catch {
    const cache = lireCache()
    if (cache) return { manifeste: cache, horsLigne: true }
    throw new Error("Aucun contenu disponible : la borne n'a jamais reçu de publication.")
  }
}

/** Sondage économique : 60 octets par minute tant que rien ne change. */
export async function versionDistante(): Promise<number | null> {
  try {
    const reponse = await fetch('/api/v1/publication/courante/entete', { cache: 'no-store' })
    if (!reponse.ok) return null
    const donnees = (await reponse.json()) as { version?: number }
    return typeof donnees.version === 'number' ? donnees.version : null
  } catch {
    return null
  }
}

/** Transforme les médias du manifeste en résolveur pour les composants de rendu. */
export function resolveurMedias(manifeste: Manifeste): ResoudreMedia {
  const parId = new Map<string, MediaManifeste>()
  for (const media of manifeste.medias) parId.set(media.id, media)

  return (mediaId): MediaResolu | null => {
    if (!mediaId) return null
    const media = parId.get(mediaId)
    if (!media) return null

    const cheminPour = (profil: ProfilImage): string => {
      const exact = media.fichiers.find((fichier) => fichier.profil === profil)
      if (exact) return exact.chemin
      const secours = media.fichiers[media.fichiers.length - 1]
      return secours ? secours.chemin : ''
    }

    return {
      id: media.id,
      type: media.type,
      legende: media.legende,
      url: cheminPour,
      poster: media.posterChemin,
      pointFocal: media.pointFocal,
      largeur: media.largeur,
      hauteur: media.hauteur,
    }
  }
}
