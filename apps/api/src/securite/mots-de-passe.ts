import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Empreintes de mots de passe avec scrypt (module `node:crypto`).
 *
 * Écart assumé par rapport à §17.2 de la conception, qui prévoyait argon2id :
 * scrypt est intégré à Node, donc aucune dépendance native supplémentaire à
 * installer sur la machine du musée. C'est une fonction de dérivation reconnue
 * (RFC 7914), acceptée par l'OWASP avec les paramètres ci-dessous. Le format
 * stocké porte son nom d'algorithme : passer à argon2id plus tard ne demandera
 * qu'une branche supplémentaire dans « verifier ».
 */
const N = 2 ** 15 // coût processeur/mémoire (~32 Mio)
const r = 8
const p = 1
const LONGUEUR = 64
// La limite par défaut de Node est de 32 Mio, soit exactement ce que demande
// N = 2^15 : sans ce plafond relevé, scryptSync refuse ces paramètres.
const MAXMEM = 96 * 1024 * 1024

export function hacherMotDePasse(motDePasse: string): string {
  const sel = randomBytes(16)
  const empreinte = scryptSync(motDePasse.normalize('NFKC'), sel, LONGUEUR, {
    N,
    r,
    p,
    maxmem: MAXMEM,
  })
  return ['scrypt', N, r, p, sel.toString('base64'), empreinte.toString('base64')].join('$')
}

export function verifierMotDePasse(motDePasse: string, stocke: string): boolean {
  const parts = stocke.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, nTexte, rTexte, pTexte, selB64, empreinteB64] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ]

  try {
    const attendu = Buffer.from(empreinteB64, 'base64')
    const calcule = scryptSync(motDePasse.normalize('NFKC'), Buffer.from(selB64, 'base64'), attendu.length, {
      N: Number(nTexte),
      r: Number(rTexte),
      p: Number(pTexte),
      maxmem: MAXMEM,
    })
    return calcule.length === attendu.length && timingSafeEqual(calcule, attendu)
  } catch {
    return false
  }
}

/** Politique : longueur avant complexité (recommandation ANSSI/NIST, §17.2). */
export function motDePasseAcceptable(motDePasse: string): string | null {
  if (motDePasse.length < 12) {
    return 'Le mot de passe doit contenir au moins 12 caractères.'
  }
  const courants = ['motdepasse12', 'azertyuiop12', '123456789012', 'motdepassedemo']
  if (courants.includes(motDePasse.toLowerCase()) && process.env.NODE_ENV === 'production') {
    return 'Ce mot de passe est trop courant. Choisissez-en un autre.'
  }
  return null
}
