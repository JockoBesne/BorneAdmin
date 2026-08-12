/*
 * Transport d'une page d'un ordinateur à l'autre.
 *
 * Le besoin : préparer une page au calme, sur un ordinateur de bureau, loin des
 * visiteurs ; la porter sur une clé USB ; l'installer sur la borne. Ce n'est pas
 * la synchronisation abandonnée en 2026-08-04 (voir DECISIONS.md) — il n'y a ni
 * dossier partagé, ni copie périodique, ni poste maître. Une page part, une page
 * arrive, à la demande.
 *
 * Ce fichier ne touche jamais au disque : il ne fait que préparer et fusionner
 * des données. La copie des fichiers est le travail du processus principal
 * (`electron/principal.cjs`). C'est ce qui rend cette logique — la seule qui
 * puisse abîmer un contenu existant — vérifiable par un test ordinaire.
 */

import { mediasReferences } from './lecture.js'
import type { ExportPage, Manifeste, MediaManifeste, PageManifeste } from './manifeste.js'
import { VERSION_EXPORT } from './manifeste.js'
import type { ContenuPage, ValeurEmplacement } from './types.js'

/**
 * Deux médias sont le même fichier s'ils ont la même empreinte et le même type.
 * C'est ce qui évite de recopier une vidéo de 200 Mo déjà présente sur la borne
 * — et, accessoirement, ce qui garde une bibliothèque propre au fil des imports.
 */
const cleMedia = (media: MediaManifeste): string => `${media.type}:${media.empreinte}`

/** Tous les médias dont une page a besoin, son image de présentation comprise. */
export function mediasDePage(page: PageManifeste, medias: MediaManifeste[]): MediaManifeste[] {
  const voulus = new Set(mediasReferences(page.contenu as unknown as ContenuPage))
  if (page.vignette) voulus.add(page.vignette)
  return medias.filter((media) => voulus.has(media.id))
}

/**
 * Noms de fichiers à emporter pour ces médias : les déclinaisons, et l'image de
 * couverture des vidéos. Ce sont des noms simples, relatifs à `medias/`.
 */
export function fichiersDe(medias: MediaManifeste[]): string[] {
  const noms = new Set<string>()
  for (const media of medias) {
    for (const fichier of media.fichiers) noms.add(fichier.chemin)
    if (media.posterChemin) noms.add(media.posterChemin)
  }
  return [...noms]
}

/** Ce qu'on écrit dans `page.json`. Null si la page n'existe pas. */
export function preparerExport(manifeste: Manifeste, idPage: string): ExportPage | null {
  const page = manifeste.pages.find((candidate) => candidate.id === idPage)
  if (!page) return null

  return {
    format: 'borne-page',
    version: VERSION_EXPORT,
    exporteLe: new Date().toISOString(),
    couleurFond: manifeste.reglages.couleurFond,
    couleurTexte: manifeste.reglages.couleurTexte,
    page,
    medias: mediasDePage(page, manifeste.medias),
  }
}

/**
 * Médias de l'export qui manquent vraiment à cette bibliothèque. Seuls ceux-là
 * sont copiés depuis la clé : c'est là que se joue le temps d'un import, une
 * page pouvant peser plusieurs centaines de mégaoctets.
 */
export function mediasManquants(manifeste: Manifeste, exporte: ExportPage): MediaManifeste[] {
  const connus = new Set(manifeste.medias.map(cleMedia))
  return exporte.medias.filter((media) => !connus.has(cleMedia(media)))
}

/** Réécrit les identifiants de médias d'une valeur d'emplacement ou de bloc. */
function valeurRedirigee(
  valeur: ValeurEmplacement,
  correspondance: Record<string, string>,
): ValeurEmplacement {
  if (valeur.type === 'image' || valeur.type === 'video') {
    if (!valeur.mediaId) return valeur
    return { ...valeur, mediaId: correspondance[valeur.mediaId] ?? valeur.mediaId }
  }
  if (valeur.type === 'galerie') {
    return {
      ...valeur,
      elements: valeur.elements.map((element) => ({
        ...element,
        mediaId: correspondance[element.mediaId] ?? element.mediaId,
      })),
    }
  }
  return valeur
}

/** La même page, mais pointant vers les médias tels qu'ils s'appellent ici. */
function pageRedirigee(
  page: PageManifeste,
  correspondance: Record<string, string>,
): PageManifeste {
  const contenu = page.contenu as unknown as ContenuPage
  return {
    ...page,
    vignette: page.vignette ? (correspondance[page.vignette] ?? page.vignette) : null,
    contenu: {
      ...page.contenu,
      emplacements: Object.fromEntries(
        Object.entries(contenu.emplacements).map(([nom, valeur]) => [
          nom,
          valeur ? valeurRedirigee(valeur, correspondance) : valeur,
        ]),
      ),
      suite: contenu.suite?.map((bloc) => ({
        ...bloc,
        valeur: valeurRedirigee(bloc.valeur, correspondance) as typeof bloc.valeur,
      })),
    },
  }
}

/**
 * Fait entrer une page importée dans le contenu de cette machine.
 *
 * `chemins` dit sous quel nom les fichiers de la clé ont été rangés dans
 * `medias/` (le processus principal renomme ceux dont le nom était déjà pris) ;
 * un fichier absent de cette table n'a pas été copié, parce qu'il était déjà là.
 *
 * Quatre règles, chacune pour une raison :
 *
 * - **un média déjà présent n'est pas dupliqué** — on redirige la page vers
 *   l'exemplaire local, reconnu à son empreinte ;
 * - **un identifiant déjà pris est renuméroté** — deux médias différents portant
 *   le même identifiant, et la page importée volerait l'image d'une autre ;
 * - **une page de même identifiant est remplacée**, à sa place dans l'accueil :
 *   c'est le cas normal, on rapporte une version retouchée d'une page existante.
 *   Sa position dans l'accueil appartient à la borne, pas au fichier ;
 * - **les couleurs sont figées si les deux machines n'ont pas le même thème** :
 *   une page sans couleurs propres suit celles de sa borne, elle changerait donc
 *   d'aspect en arrivant. C'est exactement ce qu'un import ne doit pas faire.
 *
 * Les médias devenus inutiles après un remplacement ne sont pas effacés : rien
 * dans ce projet ne supprime un fichier de `medias/`, et un import ne va pas
 * commencer.
 */
export function integrerImport(
  manifeste: Manifeste,
  exporte: ExportPage,
  chemins: Record<string, string>,
): Manifeste {
  const locauxParEmpreinte = new Map(manifeste.medias.map((media) => [cleMedia(media), media]))
  const identifiantsPris = new Set(manifeste.medias.map((media) => media.id))

  const correspondance: Record<string, string> = {}
  const nouveaux: MediaManifeste[] = []

  for (const media of exporte.medias) {
    const local = locauxParEmpreinte.get(cleMedia(media))
    if (local) {
      correspondance[media.id] = local.id
      continue
    }

    const identifiant = identifiantsPris.has(media.id) ? `media-${crypto.randomUUID()}` : media.id
    identifiantsPris.add(identifiant)
    correspondance[media.id] = identifiant

    const renomme = (nom: string): string => chemins[nom] ?? nom
    nouveaux.push({
      ...media,
      id: identifiant,
      fichiers: media.fichiers.map((fichier) => ({ ...fichier, chemin: renomme(fichier.chemin) })),
      posterChemin: media.posterChemin ? renomme(media.posterChemin) : null,
    })
  }

  const redirigee = pageRedirigee(exporte.page, correspondance)
  const page: PageManifeste = {
    ...redirigee,
    couleurFond:
      redirigee.couleurFond ??
      (exporte.couleurFond === manifeste.reglages.couleurFond ? undefined : exporte.couleurFond),
    couleurTexte:
      redirigee.couleurTexte ??
      (exporte.couleurTexte === manifeste.reglages.couleurTexte ? undefined : exporte.couleurTexte),
  }

  const remplace = manifeste.pages.some((candidate) => candidate.id === page.id)
  const pages = remplace
    ? manifeste.pages.map((candidate) =>
        candidate.id === page.id ? { ...page, ordre: candidate.ordre } : candidate,
      )
    : [...manifeste.pages, { ...page, ordre: manifeste.pages.length + 1 }]

  return { ...manifeste, pages, medias: [...manifeste.medias, ...nouveaux] }
}
