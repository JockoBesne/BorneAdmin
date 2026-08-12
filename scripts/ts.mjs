/*
 * Permet à « node --test » de lire les fichiers TypeScript du dépôt.
 *
 * Node sait retirer les types tout seul, mais pas résoudre « ./types.js » vers
 * « types.ts » — la convention d'écriture du projet. Ce crochet ajoute cette
 * seule règle : si le « .js » n'existe pas, essayer le « .ts ».
 *
 * Rien à installer. Utilisé par « npm run tester ».
 */

import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, contexte, suivant) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
      try {
        return suivant(specifier.slice(0, -3) + '.ts', contexte)
      } catch {
        // Pas de fichier .ts à côté : c'est un vrai .js, on continue.
      }
    }
    return suivant(specifier, contexte)
  },
})
