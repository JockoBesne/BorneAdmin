/**
 * Erreurs métier. Un seul type, converti en réponse HTTP par l'unique
 * gestionnaire d'erreurs (§16.2) : aucune route ne contient de try/catch.
 *
 * Le `message` est destiné à être affiché tel quel à l'utilisateur : il est
 * rédigé en français, dit ce qui s'est passé et, quand c'est utile, quoi faire.
 */
export class ErreurMetier extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statut: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ErreurMetier'
  }
}

export const erreurs = {
  entreeInvalide: (message = "Les informations envoyées ne sont pas valides.", details?: unknown) =>
    new ErreurMetier('ENTREE_INVALIDE', message, 400, details),

  identifiantsInvalides: () =>
    new ErreurMetier(
      'IDENTIFIANTS_INVALIDES',
      'Identifiant ou mot de passe incorrect.',
      401,
    ),

  sessionExpiree: () =>
    new ErreurMetier(
      'SESSION_EXPIREE',
      'Votre session a expiré. Reconnectez-vous — votre travail est enregistré.',
      401,
    ),

  droitInsuffisant: () =>
    new ErreurMetier(
      'DROIT_INSUFFISANT',
      "Cette action est réservée aux administrateurs.",
      403,
    ),

  pageIntrouvable: () =>
    new ErreurMetier('PAGE_INTROUVABLE', "Cette page n'existe pas ou a été supprimée.", 404),

  mediaIntrouvable: () =>
    new ErreurMetier('MEDIA_INTROUVABLE', "Ce fichier n'existe plus dans la bibliothèque.", 404),

  conflitEdition: (nom: string) =>
    new ErreurMetier(
      'CONFLIT_EDITION',
      `Cette page a été modifiée par ${nom} pendant votre saisie.`,
      409,
    ),

  mediaUtilise: (pages: { id: string; titre: string }[]) =>
    new ErreurMetier(
      'MEDIA_UTILISE',
      pages.length === 1
        ? 'Ce fichier est utilisé par une page.'
        : `Ce fichier est utilisé par ${pages.length} pages.`,
      409,
      pages,
    ),

  contenuIncomplet: (details: unknown) =>
    new ErreurMetier(
      'CONTENU_INCOMPLET',
      "Cette page ne peut pas encore être mise en ligne.",
      422,
      details,
    ),

  tropDeTentatives: (minutes: number) =>
    new ErreurMetier(
      'TROP_DE_TENTATIVES',
      `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
      429,
    ),

  fichierRefuse: (message: string) => new ErreurMetier('FICHIER_REFUSE', message, 422),

  etatImpossible: (message: string) => new ErreurMetier('ETAT_IMPOSSIBLE', message, 409),
}
