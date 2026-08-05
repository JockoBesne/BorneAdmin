import type { LigneTexte, MorceauTexte, ValeurTexte } from './types.js'

/*
 * Le texte mis en forme, côté données.
 *
 * Un texte se lit toujours comme une liste de lignes, chaque ligne étant faite
 * de morceaux portant leurs marques (gras, italique, souligné). C'est cette
 * forme que l'éditeur produit et que le rendu affiche.
 *
 * L'ancienne écriture — `**gras**`, `_italique_`, « - » en tête de ligne, tapée
 * à la main — reste lisible : un texte qui n'a pas de lignes est relu ainsi. Les
 * contenus déjà écrits s'affichent donc sans être retouchés, et le premier
 * passage dans l'éditeur les convertit.
 */

const MARQUAGE = /(\*\*[^*]+\*\*|_[^_]+_)/g

function morceauxDepuisMarquage(ligne: string): MorceauTexte[] {
  const morceaux: MorceauTexte[] = []
  for (const part of ligne.split(MARQUAGE)) {
    if (part === '') continue
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      morceaux.push({ texte: part.slice(2, -2), gras: true })
    } else if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) {
      morceaux.push({ texte: part.slice(1, -1), italique: true })
    } else {
      morceaux.push({ texte: part })
    }
  }
  return morceaux
}

/** Relit l'ancienne écriture d'un texte tapée à la main. */
export function lignesDepuisMarquage(texte: string): LigneTexte[] {
  return texte.split('\n').map((brute) => {
    const ligne = brute.trim()
    const puce = ligne.startsWith('- ')
    const morceaux = morceauxDepuisMarquage(puce ? ligne.slice(2) : ligne)
    return puce ? { puce: true, morceaux } : { morceaux }
  })
}

/** Les lignes d'un texte, quelle que soit la façon dont il a été écrit. */
export function lignesDeTexte(valeur: ValeurTexte): LigneTexte[] {
  return valeur.lignes ?? lignesDepuisMarquage(valeur.valeur)
}

/**
 * Le texte sans sa mise en forme, tel qu'on le lit dans le champ de saisie.
 * C'est ce qu'on range dans `valeur` : ce qu'on compte et ce qu'on contrôle.
 */
export function texteBrut(lignes: LigneTexte[]): string {
  return lignes
    .map((ligne) => (ligne.puce ? '- ' : '') + ligne.morceaux.map((m) => m.texte).join(''))
    .join('\n')
}

/**
 * Vrai si aucun morceau ne porte de marque. Un tel texte n'a pas besoin de ses
 * lignes : `valeur` seule suffit à le retrouver à l'identique (les puces sont
 * relues du « - » en tête de ligne). On n'écrit alors rien de plus dans le
 * fichier de contenu.
 */
export function sansMiseEnForme(lignes: LigneTexte[]): boolean {
  return lignes.every((ligne) =>
    ligne.morceaux.every((morceau) => !morceau.gras && !morceau.italique && !morceau.souligne),
  )
}
