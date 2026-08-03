import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { config } from '../../config.js'
import {
  journaliser,
  lirePinBorne,
  lireUtilisateurParIdentifiant,
  noterConnexionReussie,
  noterEchecConnexion,
} from '../../depots/divers.js'
import { ErreurMetier, erreurs } from '../../domaine/erreurs.js'
import { verifierMotDePasse } from '../../securite/mots-de-passe.js'
import { fermerSession, NOM_COOKIE, ouvrirSession } from '../../securite/sessions.js'
import { exigerConnecte } from '../garde.js'

const schemaConnexion = z.object({
  identifiant: z.string().min(1).max(60),
  motDePasse: z.string().min(1).max(200),
})

const schemaPin = z.object({ pin: z.string().min(4).max(12) })

/** Tentatives par adresse, en mémoire : suffisant pour une installation
 *  mono-serveur, et remis à zéro au redémarrage (§17.3). */
const tentatives = new Map<string, { compte: number; jusqua: number }>()

function verifierDebit(adresse: string): void {
  const entree = tentatives.get(adresse)
  if (entree && entree.jusqua > Date.now() && entree.compte >= 10) {
    throw erreurs.tropDeTentatives(Math.ceil((entree.jusqua - Date.now()) / 60_000))
  }
}

function noterTentative(adresse: string): void {
  const maintenant = Date.now()
  const entree = tentatives.get(adresse)
  if (!entree || entree.jusqua < maintenant) {
    tentatives.set(adresse, { compte: 1, jusqua: maintenant + 5 * 60_000 })
  } else {
    entree.compte += 1
  }
}

export async function routesAuth(app: FastifyInstance): Promise<void> {
  app.post('/auth/connexion', async (requete, reponse) => {
    const { identifiant, motDePasse } = schemaConnexion.parse(requete.body)
    const adresse = requete.ip

    verifierDebit(adresse)

    const utilisateur = lireUtilisateurParIdentifiant(identifiant)
    const valide =
      utilisateur !== null &&
      utilisateur.actif === 1 &&
      verifierMotDePasse(motDePasse, utilisateur.mot_de_passe_hash)

    if (!valide) {
      noterTentative(adresse)
      if (utilisateur) {
        noterEchecConnexion(utilisateur.id, utilisateur.echecs_connexion + 1)
        journaliser({
          utilisateurId: utilisateur.id,
          action: 'connexion.echec',
          resume: `${utilisateur.nom_affiche} — échec de connexion`,
          adresseIp: adresse,
        })
      }
      // Réponse identique que le compte existe ou non : aucune énumération.
      throw erreurs.identifiantsInvalides()
    }

    if (utilisateur.bloque_jusqu_a && new Date(utilisateur.bloque_jusqu_a).getTime() > Date.now()) {
      const minutes = Math.ceil(
        (new Date(utilisateur.bloque_jusqu_a).getTime() - Date.now()) / 60_000,
      )
      throw erreurs.tropDeTentatives(minutes)
    }

    const { jeton, jetonCsrf, expireLe } = ouvrirSession(utilisateur.id, adresse)
    noterConnexionReussie(utilisateur.id)
    tentatives.delete(adresse)

    reponse.setCookie(NOM_COOKIE, jeton, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecurise,
      path: '/',
      expires: expireLe,
    })

    return {
      utilisateur: {
        id: utilisateur.id,
        identifiant: utilisateur.identifiant,
        nomAffiche: utilisateur.nom_affiche,
        role: utilisateur.role,
      },
      jetonCsrf,
    }
  })

  app.post('/auth/deconnexion', async (requete, reponse) => {
    fermerSession(requete.cookies[NOM_COOKIE])
    reponse.clearCookie(NOM_COOKIE, { path: '/' })
    return { ok: true }
  })

  app.get('/auth/moi', async (requete) => {
    const utilisateur = exigerConnecte(requete)
    return {
      utilisateur: {
        id: utilisateur.id,
        identifiant: utilisateur.identifiant,
        nomAffiche: utilisateur.nomAffiche,
        role: utilisateur.role,
      },
      jetonCsrf: utilisateur.jetonCsrf,
    }
  })

  /**
   * Bouton secret de la borne : le code PIN ouvre l'accès à l'administration.
   * Il ne crée pas de session — il déverrouille seulement la redirection vers
   * l'écran de connexion, qui reste la seule porte d'entrée nominative.
   */
  app.post('/auth/pin-borne', async (requete) => {
    const { pin } = schemaPin.parse(requete.body)
    const adresse = requete.ip

    verifierDebit(adresse)

    if (pin !== lirePinBorne()) {
      noterTentative(adresse)
      journaliser({
        utilisateurId: null,
        action: 'borne.pin_refuse',
        resume: 'Code PIN incorrect saisi sur la borne',
        adresseIp: adresse,
      })
      throw new ErreurMetier('PIN_INVALIDE', 'Code incorrect.', 401)
    }

    tentatives.delete(adresse)
    journaliser({
      utilisateurId: null,
      action: 'borne.pin_accepte',
      resume: "Accès à l'administration ouvert depuis la borne",
      adresseIp: adresse,
    })
    return { ok: true }
  })
}
