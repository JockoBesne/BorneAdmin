import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { racineMedias } from '../config.js'
import { erreurs } from '../domaine/erreurs.js'

/**
 * Traitement et stockage des médias (§15).
 *
 * L'utilisateur ne s'occupe de rien : il dépose le fichier tel qu'il sort de
 * son appareil, tout le reste est fait ici.
 */

export type ProfilImage = 'vignette' | 'moyen' | 'grand' | 'origine'

const LARGEURS: Record<Exclude<ProfilImage, 'origine'>, number> = {
  vignette: 400,
  moyen: 1024,
  grand: 1920,
}

export function empreinteDe(donnees: Buffer): string {
  return createHash('sha256').update(donnees).digest('hex').slice(0, 12)
}

export function dossierMedia(empreinte: string): string {
  return path.join(racineMedias, empreinte)
}

export function cheminFichier(empreinte: string, nomFichier: string): string {
  const cible = path.normalize(path.join(dossierMedia(empreinte), nomFichier))
  // Le nom vient d'une empreinte et d'une liste fermée de profils : la
  // traversée de chemin est impossible, mais la vérification reste (§17.4).
  if (!cible.startsWith(racineMedias)) throw erreurs.entreeInvalide('Chemin de fichier refusé.')
  return cible
}

/** Écriture atomique : un envoi interrompu ne laisse jamais de fichier partiel. */
function ecrireAtomique(chemin: string, donnees: Buffer): void {
  mkdirSync(path.dirname(chemin), { recursive: true })
  const temporaire = `${chemin}.partiel`
  writeFileSync(temporaire, donnees)
  renameSync(temporaire, chemin)
}

export interface ResultatImage {
  empreinte: string
  largeur: number
  hauteur: number
  poidsOptimise: number
  extension: string
  mime: string
}

/**
 * Une image est systématiquement réencodée : rotation EXIF appliquée,
 * métadonnées (dont GPS) supprimées, trois déclinaisons WebP produites.
 * Un fichier « polyglotte » ne survit pas à ce réencodage (§17.4).
 */
export async function traiterImage(donnees: Buffer): Promise<ResultatImage> {
  let metadonnees: sharp.Metadata
  try {
    metadonnees = await sharp(donnees).metadata()
  } catch {
    throw erreurs.fichierRefuse(
      "Ce fichier n'est pas une photo. Formats acceptés : JPEG, PNG, WebP, HEIC.",
    )
  }

  const largeur = metadonnees.width ?? 0
  const hauteur = metadonnees.height ?? 0
  if (largeur === 0 || hauteur === 0) {
    throw erreurs.fichierRefuse("Cette photo est illisible. Essayez de la réenregistrer.")
  }

  const empreinte = empreinteDe(donnees)
  let poidsOptimise = 0

  // L'original est conservé : si le musée change d'écran, tout peut être
  // régénéré sans redemander les fichiers (§15.3).
  const extension = (metadonnees.format ?? 'jpeg') === 'jpeg' ? 'jpg' : (metadonnees.format ?? 'bin')
  ecrireAtomique(cheminFichier(empreinte, `origine.${extension}`), donnees)

  for (const [profil, largeurCible] of Object.entries(LARGEURS)) {
    const sortie = await sharp(donnees)
      .rotate() // applique l'orientation EXIF : sinon les photos de téléphone sont couchées
      .resize({
        width: Math.min(largeurCible, largeur),
        withoutEnlargement: true,
      })
      .webp({ quality: profil === 'vignette' ? 74 : 82 })
      .toBuffer()

    ecrireAtomique(cheminFichier(empreinte, `${profil}.webp`), sortie)
    if (profil === 'grand') poidsOptimise = sortie.length
  }

  // Les dimensions rapportées sont celles après rotation.
  const apresRotation = await sharp(donnees).rotate().metadata()

  return {
    empreinte,
    largeur: apresRotation.width ?? largeur,
    hauteur: apresRotation.height ?? hauteur,
    poidsOptimise,
    extension,
    mime: `image/${metadonnees.format ?? 'jpeg'}`,
  }
}

const SIGNATURES_VIDEO: { mime: string; extension: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: 'video/mp4',
    extension: 'mp4',
    test: (b) => b.length > 12 && b.subarray(4, 8).toString('latin1') === 'ftyp',
  },
  {
    mime: 'video/webm',
    extension: 'webm',
    test: (b) => b.length > 4 && b.readUInt32BE(0) === 0x1a45dfa3,
  },
]

/** Le type réel est lu dans la signature binaire, jamais dans l'extension. */
export function traiterVideo(donnees: Buffer): {
  empreinte: string
  mime: string
  extension: string
} {
  const signature = SIGNATURES_VIDEO.find((s) => s.test(donnees))
  if (!signature) {
    throw erreurs.fichierRefuse(
      "Cette vidéo est dans un format que la borne ne sait pas lire. Convertissez-la en MP4 (H.264) : dans VLC, menu Média → Convertir.",
    )
  }

  const empreinte = empreinteDe(donnees)
  ecrireAtomique(cheminFichier(empreinte, `origine.${signature.extension}`), donnees)
  return { empreinte, mime: signature.mime, extension: signature.extension }
}

/** Image de couverture d'une vidéo, extraite par le navigateur (§15.4). */
export async function ecrirePoster(empreinte: string, donnees: Buffer): Promise<void> {
  const sortie = await sharp(donnees)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
  ecrireAtomique(cheminFichier(empreinte, 'poster.webp'), sortie)
}

export function fichierExiste(empreinte: string, nomFichier: string): boolean {
  return existsSync(cheminFichier(empreinte, nomFichier))
}
