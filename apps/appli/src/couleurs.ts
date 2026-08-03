import type { CSSProperties } from 'react'

/**
 * Conversions de couleur, et fabrique des variables CSS de la borne.
 *
 * Le disque de couleur travaille en teinte / saturation / valeur (TSV) : c'est
 * le repère naturel d'une roue chromatique — l'angle donne la teinte, la
 * distance au centre la saturation. Le contenu, lui, ne connaît que des codes
 * hexadécimaux ordinaires (« #0e2237 »), lisibles et transportables.
 */

export function hexVersRvb(hex: string): [number, number, number] {
  const brut = hex.replace('#', '')
  const complet =
    brut.length === 3
      ? brut
          .split('')
          .map((c) => c + c)
          .join('')
      : brut
  const entier = Number.parseInt(complet, 16)
  return [(entier >> 16) & 255, (entier >> 8) & 255, entier & 255]
}

export function rvbVersHex(r: number, g: number, b: number): string {
  const deux = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${deux(r)}${deux(g)}${deux(b)}`
}

/** RVB (0–255) → teinte (0–360), saturation (0–1), valeur (0–1). */
export function rvbVersTsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let teinte = 0
  if (delta !== 0) {
    if (max === r) teinte = ((g - b) / delta) % 6
    else if (max === g) teinte = (b - r) / delta + 2
    else teinte = (r - g) / delta + 4
    teinte *= 60
    if (teinte < 0) teinte += 360
  }

  const saturation = max === 0 ? 0 : delta / max
  return [teinte, saturation, max]
}

/** Teinte (0–360), saturation (0–1), valeur (0–1) → RVB (0–255). */
export function tsvVersRvb(teinte: number, saturation: number, valeur: number): [number, number, number] {
  const c = valeur * saturation
  const x = c * (1 - Math.abs(((teinte / 60) % 2) - 1))
  const m = valeur - c
  let r = 0
  let g = 0
  let b = 0
  if (teinte < 60) [r, g, b] = [c, x, 0]
  else if (teinte < 120) [r, g, b] = [x, c, 0]
  else if (teinte < 180) [r, g, b] = [0, c, x]
  else if (teinte < 240) [r, g, b] = [0, x, c]
  else if (teinte < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

/** Un couple de couleurs (fond + texte), quelle qu'en soit la provenance. */
export interface Couleurs {
  couleurFond: string
  couleurTexte: string
}

/**
 * Couleurs effectives d'une page : les siennes si elle en a, sinon celles du
 * thème global. C'est la règle du « global + par page » — la page l'emporte.
 */
export function couleursEffectives(
  reglages: Couleurs,
  page: { couleurFond?: string; couleurTexte?: string },
): Couleurs {
  return {
    couleurFond: page.couleurFond ?? reglages.couleurFond,
    couleurTexte: page.couleurTexte ?? reglages.couleurTexte,
  }
}

/**
 * Variables CSS à poser sur le conteneur du rendu de la borne. On dérive le
 * texte « doux » (légendes, textes secondaires) de la couleur de texte choisie,
 * pour qu'il reste lisible quel que soit le réglage — sinon un texte sombre sur
 * fond clair laisserait les légendes, restées claires, invisibles.
 */
export function stylesCouleurs(couleurs: Couleurs): CSSProperties {
  const [r, g, b] = hexVersRvb(couleurs.couleurTexte)
  return {
    '--b-fond': couleurs.couleurFond,
    '--b-texte': couleurs.couleurTexte,
    '--b-texte-doux': `rgba(${r}, ${g}, ${b}, 0.72)`,
  } as CSSProperties
}
