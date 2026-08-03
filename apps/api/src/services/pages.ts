import {
  controlerContenu,
  estPubliable,
  modelePar,
  type ContenuPage,
  type IdModele,
  type Probleme,
} from '@borne/contenu'
import { transaction } from '../base/connexion.js'
import { infosMedias } from '../depots/medias.js'
import * as depot from '../depots/pages.js'
import { journaliser } from '../depots/divers.js'
import { erreurs } from '../domaine/erreurs.js'
import { nouvelId } from '../domaine/identifiants.js'
import { regenererPublication } from './publication.js'
import type { Connecte } from '../securite/sessions.js'

const JOURS_CORBEILLE = 30

export function controlerPage(contenu: ContenuPage): Probleme[] {
  const infos = infosMedias()
  return controlerContenu(contenu, (id) => infos.get(id) ?? null)
}

export function creerPage(
  titre: string,
  modeleId: IdModele,
  utilisateur: Connecte,
): depot.Page {
  const modele = modelePar(modeleId)
  if (!modele) throw erreurs.entreeInvalide('Ce modèle de page est inconnu.')

  const id = nouvelId()
  const contenu = modele.contenuVide()
  // Le titre saisi à la création alimente aussi l'emplacement « titre » :
  // l'utilisateur ne saisit pas deux fois la même chose.
  const emplacementTitre = contenu.emplacements['titre']
  if (emplacementTitre && emplacementTitre.type === 'titre') {
    emplacementTitre.valeur = titre
  }

  transaction(() => {
    depot.creerPage({
      id,
      modele: modeleId,
      titre,
      ordre: depot.prochainOrdre(),
      contenu,
      utilisateurId: utilisateur.id,
    })
    journaliser({
      utilisateurId: utilisateur.id,
      action: 'page.creee',
      resume: `${utilisateur.nomAffiche} a créé « ${titre} »`,
      cibleId: id,
    })
  })

  const page = depot.lirePage(id)
  if (!page) throw erreurs.pageIntrouvable()
  return page
}

export function enregistrerBrouillon(
  id: string,
  entree: { titre: string; contenu: ContenuPage; modifieeLe: string | null },
  utilisateur: Connecte,
): { modifieeLe: string } {
  const page = depot.lirePage(id)
  if (!page || page.etat === 'corbeille') throw erreurs.pageIntrouvable()

  // Détection d'écriture concurrente : le client renvoie la date qu'il connaît.
  if (entree.modifieeLe && entree.modifieeLe !== page.modifieeLe) {
    throw erreurs.conflitEdition(page.modifieeParNom || 'une autre personne')
  }

  const modele = modelePar(page.modele)
  if (!modele) throw erreurs.entreeInvalide('Le modèle de cette page est inconnu.')

  const analyse = modele.schema.safeParse(entree.contenu)
  if (!analyse.success) {
    throw erreurs.entreeInvalide(
      "Le contenu envoyé ne correspond pas au modèle de la page.",
      analyse.error.issues,
    )
  }

  const modifieeLe = transaction(() =>
    depot.enregistrerBrouillon(id, entree.titre.trim() || 'Sans titre', analyse.data, utilisateur.id),
  )
  return { modifieeLe }
}

export function mettreEnLigne(id: string, utilisateur: Connecte): { version: number } {
  const page = depot.lirePage(id)
  if (!page || page.etat === 'corbeille') throw erreurs.pageIntrouvable()

  const problemes = controlerPage(page.contenuBrouillon)
  if (!estPubliable(problemes)) {
    throw erreurs.contenuIncomplet(problemes)
  }

  return transaction(() => {
    depot.marquerEnLigne(id, page.contenuBrouillon)
    const version = regenererPublication(`Mise en ligne de : ${page.titre}`, utilisateur.id)
    journaliser({
      utilisateurId: utilisateur.id,
      action: 'page.publiee',
      resume: `${utilisateur.nomAffiche} a mis en ligne « ${page.titre} »`,
      cibleId: id,
    })
    return { version }
  })
}

export function retirerDeLaBorne(id: string, utilisateur: Connecte): { version: number } {
  const page = depot.lirePage(id)
  if (!page) throw erreurs.pageIntrouvable()
  if (page.etat !== 'en_ligne') {
    throw erreurs.etatImpossible("Cette page n'est pas en ligne.")
  }

  return transaction(() => {
    depot.changerEtat(id, 'retiree')
    const version = regenererPublication(`Retrait de : ${page.titre}`, utilisateur.id)
    journaliser({
      utilisateurId: utilisateur.id,
      action: 'page.retiree',
      resume: `${utilisateur.nomAffiche} a retiré « ${page.titre} » de la borne`,
      cibleId: id,
    })
    return { version }
  })
}

export function reordonner(ids: string[], utilisateur: Connecte): { version: number } {
  return transaction(() => {
    depot.changerOrdre(ids.map((id, index) => ({ id, ordre: index + 1 })))
    const version = regenererPublication("Nouvel ordre d'affichage", utilisateur.id)
    journaliser({
      utilisateurId: utilisateur.id,
      action: 'pages.reordonnees',
      resume: `${utilisateur.nomAffiche} a modifié l'ordre des pages`,
    })
    return { version }
  })
}

export function mettreALaCorbeille(id: string, utilisateur: Connecte): void {
  const page = depot.lirePage(id)
  if (!page) throw erreurs.pageIntrouvable()
  // Une page en ligne ne peut pas aller directement à la corbeille : ce détour
  // d'un clic évite la suppression accidentelle d'un contenu public (§8.4).
  if (page.etat === 'en_ligne') {
    throw erreurs.etatImpossible(
      "Retirez d'abord cette page de la borne, puis vous pourrez la supprimer.",
    )
  }

  transaction(() => {
    depot.changerEtat(id, 'corbeille')
    journaliser({
      utilisateurId: utilisateur.id,
      action: 'page.supprimee',
      resume: `${utilisateur.nomAffiche} a supprimé « ${page.titre} »`,
      cibleId: id,
    })
  })
}

export function restaurer(id: string, utilisateur: Connecte): void {
  const page = depot.lirePage(id)
  if (!page || page.etat !== 'corbeille') throw erreurs.pageIntrouvable()

  transaction(() => {
    depot.changerEtat(id, 'brouillon')
    journaliser({
      utilisateurId: utilisateur.id,
      action: 'page.restauree',
      resume: `${utilisateur.nomAffiche} a restauré « ${page.titre} »`,
      cibleId: id,
    })
  })
}

export function dupliquer(id: string, utilisateur: Connecte): depot.Page {
  const source = depot.lirePage(id)
  if (!source) throw erreurs.pageIntrouvable()

  const nouveau = nouvelId()
  const titre = `${source.titre} (copie)`

  transaction(() => {
    depot.creerPage({
      id: nouveau,
      modele: source.modele,
      titre,
      ordre: depot.prochainOrdre(),
      contenu: source.contenuBrouillon,
      utilisateurId: utilisateur.id,
    })
    journaliser({
      utilisateurId: utilisateur.id,
      action: 'page.dupliquee',
      resume: `${utilisateur.nomAffiche} a dupliqué « ${source.titre} »`,
      cibleId: nouveau,
    })
  })

  const page = depot.lirePage(nouveau)
  if (!page) throw erreurs.pageIntrouvable()
  return page
}

export function purgerCorbeille(): number {
  return depot.purgerCorbeille(JOURS_CORBEILLE)
}
