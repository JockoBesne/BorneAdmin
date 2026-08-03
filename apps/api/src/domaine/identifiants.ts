import { randomBytes } from 'node:crypto'

/**
 * Identifiants triables par date de création, non devinables — un ULID
 * simplifié : 10 caractères d'horodatage + 16 caractères aléatoires, en
 * base 32 sans lettres ambiguës. Aucune dépendance nécessaire.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encoder(valeur: number, longueur: number): string {
  let sortie = ''
  let reste = valeur
  for (let i = 0; i < longueur; i++) {
    sortie = ALPHABET[reste % 32] + sortie
    reste = Math.floor(reste / 32)
  }
  return sortie
}

export function nouvelId(): string {
  const horodatage = encoder(Date.now(), 10)
  const octets = randomBytes(16)
  let aleatoire = ''
  for (const octet of octets) aleatoire += ALPHABET[octet % 32]
  return horodatage + aleatoire
}
