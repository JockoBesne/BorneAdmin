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
  /** Fond du bandeau du haut. Absent = le bleu sombre d'origine. */
  couleurBandeau?: string
  /** Texte du bandeau. Absent = calculé d'après le fond, pour rester lisible. */
  couleurBandeauTexte?: string
  /** Hauteur du bandeau, en pixels d'écran. Absente = la hauteur d'origine. */
  hauteurBandeau?: number
}

/** Fond du bandeau tant que personne n'en a choisi un (voir « appli.css »). */
export const BANDEAU_DEFAUT = '#081726'

/**
 * Couleurs effectives d'une page : les siennes si elle en a, sinon celles du
 * thème global. C'est la règle du « global + par page » — la page l'emporte.
 */
export function couleursEffectives(
  reglages: Couleurs,
  page: {
    couleurFond?: string
    couleurTexte?: string
    couleurBandeau?: string
    couleurBandeauTexte?: string
    hauteurBandeau?: number
  },
): Couleurs {
  return {
    couleurFond: page.couleurFond ?? reglages.couleurFond,
    couleurTexte: page.couleurTexte ?? reglages.couleurTexte,
    // Le bandeau ne se règle que par page : rien à hériter du thème général.
    couleurBandeau: page.couleurBandeau,
    couleurBandeauTexte: page.couleurBandeauTexte,
    hauteurBandeau: page.hauteurBandeau,
  }
}

/**
 * Couleurs de l'accueil : les siennes si le musée en a choisi, sinon celles de
 * la borne. Même règle que « global + par page », un cran au-dessus.
 */
export function couleursHub(
  reglages: Couleurs & { hubCouleurFond?: string; hubCouleurTexte?: string },
): Couleurs {
  return {
    couleurFond: reglages.hubCouleurFond ?? reglages.couleurFond,
    couleurTexte: reglages.hubCouleurTexte ?? reglages.couleurTexte,
  }
}

/**
 * L'or du thème (`--b-accent` dans la feuille de style), seule couleur qui ne
 * se règle pas : c'est celle du sous-titre de l'accueil tant que personne ne
 * lui en a choisi une. Le disque de couleur doit partir de là — sinon il
 * partirait du noir et le premier geste changerait tout d'un coup.
 */
export const ACCENT_ORIGINE = '#e9b44c'

/** Ce que l'accueil laisse régler, en plus de ses deux couleurs. */
export type ApparenceHub = {
  hubTitreCouleur?: string
  hubTitreTaille?: number
  hubSousTitreCouleur?: string
  hubSousTitreTaille?: number
  hubNomFond?: string
  hubNomCouleur?: string
  hubNomTaille?: number
}

/**
 * Variables CSS de l'apparence de l'accueil : le grand titre, le sous-titre, la
 * barre de titre des cartes.
 *
 * Un réglage absent **n'écrit aucune variable** : la feuille de style garde
 * alors sa valeur de repli, et l'accueil reste au pixel près celui d'avant ce
 * réglage. C'est ce qui évite d'avoir à retoucher les contenus existants —
 * même principe que le bandeau d'une page.
 *
 * La taille est un facteur (`calc` dans la feuille de style), pas une taille en
 * points : les trois textes gardent leurs écarts.
 */
export function variablesHub(reglages: ApparenceHub): Record<string, string> {
  const variables: Record<string, string> = {}
  const poser = (nom: string, valeur: string | undefined) => {
    if (valeur !== undefined) variables[nom] = valeur
  }
  const facteur = (nom: string, pourcent: number | undefined) => {
    if (pourcent !== undefined) variables[nom] = String(pourcent / 100)
  }
  poser('--hub-titre', reglages.hubTitreCouleur)
  facteur('--hub-titre-facteur', reglages.hubTitreTaille)
  poser('--hub-sous-titre', reglages.hubSousTitreCouleur)
  facteur('--hub-sous-titre-facteur', reglages.hubSousTitreTaille)
  poser('--hub-nom-fond', reglages.hubNomFond)
  poser('--hub-nom-texte', reglages.hubNomCouleur)
  facteur('--hub-nom-facteur', reglages.hubNomTaille)
  return variables
}

/**
 * Variables CSS à poser sur le conteneur du rendu de la borne. On dérive le
 * texte « doux » (légendes, textes secondaires) de la couleur de texte choisie,
 * pour qu'il reste lisible quel que soit le réglage — sinon un texte sombre sur
 * fond clair laisserait les légendes, restées claires, invisibles.
 */
export function stylesCouleurs(couleurs: Couleurs): CSSProperties {
  const [r, g, b] = hexVersRvb(couleurs.couleurTexte)
  const style: Record<string, string> = {
    '--b-fond': couleurs.couleurFond,
    '--b-texte': couleurs.couleurTexte,
    '--b-texte-doux': `rgba(${r}, ${g}, ${b}, 0.72)`,
  }
  // Rien n'est posé tant que le bandeau n'a pas été réglé : la feuille de style
  // garde alors son apparence d'origine, par la valeur de repli des « var() ».
  if (couleurs.couleurBandeau) style['--b-bandeau'] = couleurs.couleurBandeau
  if (couleurs.hauteurBandeau) style['--b-bandeau-hauteur'] = `${couleurs.hauteurBandeau}px`

  // La couleur choisie à la main l'emporte ; à défaut, elle n'est calculée que
  // si un fond a été choisi — sinon le bandeau d'origine garde ses couleurs.
  const texteBandeau =
    couleurs.couleurBandeauTexte ??
    (couleurs.couleurBandeau ? surFondLisible(couleurs.couleurBandeau) : undefined)
  if (texteBandeau) style['--b-bandeau-texte'] = texteBandeau

  return style as CSSProperties
}

/**
 * Presque noir ou presque blanc, selon ce qui se lit sur ce fond. Sans cela, un
 * bandeau clair garderait le texte clair de la page : illisible, et personne au
 * musée n'aurait de moyen de le rattraper.
 */
export function surFondLisible(fond: string): string {
  const [r, g, b] = hexVersRvb(fond)
  // Luminance perçue : l'œil compte surtout le vert, très peu le bleu.
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#101820' : '#f5f7fa'
}
