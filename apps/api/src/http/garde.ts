import type { FastifyReply, FastifyRequest } from 'fastify'
import { erreurs } from '../domaine/erreurs.js'
import { lireSession, NOM_COOKIE, type Connecte } from '../securite/sessions.js'

declare module 'fastify' {
  interface FastifyRequest {
    utilisateur?: Connecte
  }
}

/** Attache l'utilisateur à la requête, sans rien exiger. */
export function chargerSession(requete: FastifyRequest): void {
  const jeton = requete.cookies[NOM_COOKIE]
  requete.utilisateur = lireSession(jeton) ?? undefined
}

/**
 * Exige une session valide et, pour les écritures, un jeton anti-CSRF.
 * Le contrôle est fait ici, côté serveur : masquer un bouton dans l'interface
 * n'est pas un contrôle (§13.7).
 */
export function exigerConnecte(requete: FastifyRequest): Connecte {
  const utilisateur = requete.utilisateur
  if (!utilisateur) throw erreurs.sessionExpiree()

  const ecriture = requete.method !== 'GET' && requete.method !== 'HEAD'
  if (ecriture) {
    const jeton = requete.headers['x-jeton-csrf']
    if (typeof jeton !== 'string' || jeton !== utilisateur.jetonCsrf) {
      throw erreurs.entreeInvalide('Requête refusée : jeton de sécurité manquant ou invalide.')
    }
  }

  return utilisateur
}

export function exigerAdministrateur(requete: FastifyRequest): Connecte {
  const utilisateur = exigerConnecte(requete)
  if (utilisateur.role !== 'administrateur') throw erreurs.droitInsuffisant()
  return utilisateur
}

/** En-têtes de sécurité, appliqués à toutes les réponses (§17.6). */
export function entetesSecurite(_requete: FastifyRequest, reponse: FastifyReply): void {
  reponse.header('X-Content-Type-Options', 'nosniff')
  reponse.header('Referrer-Policy', 'same-origin')
  reponse.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
}
