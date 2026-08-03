import type { ContenuPage, IdModele, Probleme, Reglages } from '@borne/contenu'

/**
 * Client de l'API. Un seul point d'entrée : toute requête passe par « api »,
 * qui joint le cookie de session et le jeton anti-CSRF, et convertit les
 * réponses d'erreur en objet exploitable par l'interface (§16.4).
 */

const BASE = '/api/v1'

let jetonCsrf: string | null = null

export function definirJetonCsrf(jeton: string | null): void {
  jetonCsrf = jeton
}

export class ErreurApi extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statut: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ErreurApi'
  }
}

async function api<T>(
  chemin: string,
  options: { methode?: string; corps?: unknown; formulaire?: FormData } = {},
): Promise<T> {
  const { methode = 'GET', corps, formulaire } = options

  const entetes: Record<string, string> = {}
  if (corps !== undefined) entetes['Content-Type'] = 'application/json'
  if (jetonCsrf) entetes['X-Jeton-CSRF'] = jetonCsrf

  const reponse = await fetch(BASE + chemin, {
    method: methode,
    credentials: 'same-origin',
    headers: entetes,
    body: formulaire ?? (corps === undefined ? undefined : JSON.stringify(corps)),
  })

  if (reponse.status === 204) return undefined as T

  const donnees = (await reponse.json().catch(() => null)) as
    | { erreur?: { code: string; message: string; details?: unknown } }
    | T
    | null

  if (!reponse.ok) {
    const erreur = (donnees as { erreur?: { code: string; message: string; details?: unknown } })
      ?.erreur
    throw new ErreurApi(
      erreur?.code ?? 'ERREUR_RESEAU',
      erreur?.message ?? "Le serveur n'a pas répondu. Vérifiez votre connexion.",
      reponse.status,
      erreur?.details,
    )
  }

  return donnees as T
}

// ── Types partagés avec l'API ────────────────────────────────────────────────

export interface Utilisateur {
  id: string
  identifiant: string
  nomAffiche: string
  role: 'administrateur' | 'editeur'
}

export type EtatPage = 'brouillon' | 'en_ligne' | 'retiree' | 'corbeille'

export interface ResumePage {
  id: string
  titre: string
  modele: IdModele
  etat: EtatPage
  ordre: number
  modifieeLe: string
  modifieeParNom: string
  publieeLe: string | null
  supprimeeLe: string | null
  aDesModifications: boolean
}

export interface PageComplete extends ResumePage {
  contenuBrouillon: ContenuPage
  contenuPublie: ContenuPage | null
  problemes: Probleme[]
}

export interface Media {
  id: string
  type: 'image' | 'video'
  nomAffiche: string
  legende: string
  largeur: number | null
  hauteur: number | null
  dureeSecondes: number | null
  poidsOctets: number
  poidsOptimise: number
  pointFocal: { x: number; y: number }
  creeLe: string
  utilisations: number
  urls: {
    vignette: string
    moyen: string
    grand: string
    origine: string
    poster: string | null
  }
}

export interface Sante {
  etat: string
  publication: number
  pagesEnLigne: number
  genereLe: string | null
}

// ── Points d'entrée ──────────────────────────────────────────────────────────

export const clientApi = {
  connexion: (identifiant: string, motDePasse: string) =>
    api<{ utilisateur: Utilisateur; jetonCsrf: string }>('/auth/connexion', {
      methode: 'POST',
      corps: { identifiant, motDePasse },
    }),

  deconnexion: () => api<{ ok: true }>('/auth/deconnexion', { methode: 'POST' }),

  moi: () => api<{ utilisateur: Utilisateur; jetonCsrf: string }>('/auth/moi'),

  pages: (corbeille = false) => api<ResumePage[]>(`/pages${corbeille ? '?corbeille=1' : ''}`),

  page: (id: string) => api<PageComplete>(`/pages/${id}`),

  creerPage: (titre: string, modele: IdModele) =>
    api<PageComplete>('/pages', { methode: 'POST', corps: { titre, modele } }),

  enregistrerBrouillon: (
    id: string,
    entree: { titre: string; contenu: ContenuPage; modifieeLe: string | null },
  ) =>
    api<{ modifieeLe: string; problemes: Probleme[] }>(`/pages/${id}/brouillon`, {
      methode: 'PATCH',
      corps: entree,
    }),

  mettreEnLigne: (id: string) =>
    api<{ version: number }>(`/pages/${id}/publication`, { methode: 'POST' }),

  retirer: (id: string) =>
    api<{ version: number }>(`/pages/${id}/publication`, { methode: 'DELETE' }),

  reordonner: (ids: string[]) =>
    api<{ version: number }>('/pages/ordre', { methode: 'POST', corps: { ids } }),

  dupliquer: (id: string) =>
    api<ResumePage>(`/pages/${id}/duplication`, { methode: 'POST' }),

  supprimerPage: (id: string) => api<{ ok: true }>(`/pages/${id}`, { methode: 'DELETE' }),

  restaurerPage: (id: string) =>
    api<{ ok: true }>(`/pages/${id}/restauration`, { methode: 'POST' }),

  medias: (type?: 'image' | 'video') => api<Media[]>(`/medias${type ? `?type=${type}` : ''}`),

  media: (id: string) => api<Media & { pages: { id: string; titre: string }[] }>(`/medias/${id}`),

  televerser: (formulaire: FormData) => api<Media>('/medias', { methode: 'POST', formulaire }),

  majMedia: (id: string, champs: { nomAffiche?: string; legende?: string }) =>
    api<Media>(`/medias/${id}`, { methode: 'PATCH', corps: champs }),

  supprimerMedia: (id: string) => api<{ ok: true }>(`/medias/${id}`, { methode: 'DELETE' }),

  parametres: () => api<Reglages & { pinBorne: string | null }>('/parametres'),

  enregistrerParametres: (valeurs: Reglages & { pinBorne?: string }) =>
    api<{ ok: true; version: number }>('/parametres', { methode: 'PUT', corps: valeurs }),

  journal: () => api<{ horodatage: string; resume: string; action: string }[]>('/journal'),

  sante: () => api<Sante>('/sante'),
}
