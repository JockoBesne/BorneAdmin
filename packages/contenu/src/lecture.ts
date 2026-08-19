import {
  COLONNES_GRILLE,
  COLONNES_MIN,
  HAUTEUR_MAX,
  HAUTEUR_MIN,
  HAUTEUR_PHOTO_VISEE,
  largeurEnPixels,
} from './types.js'
import type {
  BlocLibre,
  ContenuPage,
  ElementGalerie,
  StyleBloc,
  ValeurImage,
  ValeurTexte,
  ValeurVideo,
} from './types.js'

/* Lecture typée du contenu d'une page.
 * Un emplacement absent ou d'un autre type renvoie une valeur vide plutôt que
 * de lever : un contenu abîmé ne doit jamais faire tomber l'affichage (§14.6). */

export function lireTexte(contenu: ContenuPage, nom: string): string {
  const valeur = contenu.emplacements[nom]
  if (valeur && (valeur.type === 'titre' || valeur.type === 'texte')) {
    return valeur.valeur
  }
  return ''
}

/**
 * Le texte d'un emplacement, mise en forme comprise. `lireTexte` ne rend que
 * les caractères ; c'est celle-ci qu'il faut pour afficher un texte.
 */
export function lireValeurTexte(contenu: ContenuPage, nom: string): ValeurTexte {
  const valeur = contenu.emplacements[nom]
  if (valeur && valeur.type === 'texte') return valeur
  return { type: 'texte', valeur: '' }
}

export function lireImage(contenu: ContenuPage, nom: string): ValeurImage {
  const valeur = contenu.emplacements[nom]
  if (valeur && valeur.type === 'image') return valeur
  return { type: 'image', mediaId: null, legende: '' }
}

export function lireVideo(contenu: ContenuPage, nom: string): ValeurVideo {
  const valeur = contenu.emplacements[nom]
  if (valeur && valeur.type === 'video') return valeur
  return { type: 'video', mediaId: null, legende: '' }
}

export function lireGalerie(contenu: ContenuPage, nom: string): ElementGalerie[] {
  const valeur = contenu.emplacements[nom]
  if (valeur && valeur.type === 'galerie') return valeur.elements
  return []
}

/** Blocs ajoutés à la suite de la page. Toujours un tableau, jamais undefined. */
export function lireSuite(contenu: ContenuPage): BlocLibre[] {
  return contenu.suite ?? []
}

/**
 * Habillage d'un bloc (fond, mise en forme du texte), par son nom : celui de
 * l'emplacement pour un bloc du modèle, « suite:<identifiant> » pour un bloc
 * ajouté. Absent = le bloc s'affiche sans habillage.
 */
export function lireStyle(contenu: ContenuPage, nom: string): StyleBloc | undefined {
  return contenu.styles?.[nom]
}

/**
 * Un habillage dont plus rien n'est réglé. On ne le garde pas dans le contenu :
 * remettre un bloc à zéro doit laisser le fichier tel qu'il était avant qu'on y
 * touche, sans habillage vide qui traîne.
 */
export function estStyleVide(style: StyleBloc): boolean {
  return (
    style.fond === undefined &&
    style.couleur === undefined &&
    !style.gras &&
    !style.italique &&
    !style.souligne &&
    (style.alignement === undefined || style.alignement === 'gauche') &&
    (style.opacite === undefined || style.opacite === 100) &&
    (style.taille === undefined || style.taille === 100) &&
    !style.recadre
  )
}

/** Une photo qu'on a demandé à recadrer. Faux partout ailleurs. */
export function estRecadre(contenu: ContenuPage, nom: string): boolean {
  return lireStyle(contenu, nom)?.recadre === true
}

/**
 * Largeur en colonnes qu'il faut donner au bloc d'une photo pour qu'elle ne
 * dépasse pas la hauteur visée — jamais plus large que ce qu'il est déjà.
 *
 * C'est ce qui évite les « formats bizarres » au moment où l'on choisit une
 * photo : une photo en hauteur mise en pleine largeur ferait deux écrans de haut.
 * On réduit la largeur du bloc, on ne touche pas à la photo : elle reste entière.
 * Dimensions du média inconnues : on ne change rien.
 */
export function colonnesPourPhoto(
  largeurMedia: number | null,
  hauteurMedia: number | null,
  colonnesActuelles: number,
): number {
  if (!largeurMedia || !hauteurMedia || largeurMedia <= 0) return colonnesActuelles
  const proportions = hauteurMedia / largeurMedia
  let colonnes = colonnesActuelles
  while (
    colonnes > COLONNES_MIN &&
    largeurEnPixels(colonnes) * proportions > HAUTEUR_PHOTO_VISEE
  ) {
    colonnes -= 1
  }
  return colonnes
}

/**
 * Section après laquelle un bloc s'affiche réellement. Ancre absente ou
 * inconnue du modèle : bas de page (la dernière section). Le rendu et
 * l'éditeur appliquent cette même règle — un bloc est toujours affiché là où
 * l'éditeur le montre.
 */
export function positionBloc(bloc: BlocLibre, sections: readonly string[]): string | undefined {
  if (bloc.apres !== undefined && sections.includes(bloc.apres)) return bloc.apres
  return sections[sections.length - 1]
}

/**
 * Un bloc ajouté mais laissé vide n'apparaît pas sur la borne : cette règle
 * est partagée entre le rendu (qui le saute) et les contrôles (qui le
 * signalent). Une seule définition de « vide », pour que les deux soient
 * toujours d'accord.
 */
export function estBlocLibreVide(bloc: BlocLibre): boolean {
  switch (bloc.valeur.type) {
    case 'texte':
      return bloc.valeur.valeur.trim() === ''
    case 'image':
    case 'video':
      return bloc.valeur.mediaId === null
    case 'galerie':
      return bloc.valeur.elements.length === 0
    // Un atelier est « vide » tant qu'il n'est pas jouable : sans question ou
    // sans réponses, sans consigne ou sans assez d'événements, il ne doit pas
    // apparaître devant le public.
    case 'quiz':
      return (
        bloc.valeur.question.trim() === '' ||
        bloc.valeur.reponses.filter((reponse) => reponse.texte.trim() !== '').length < 2
      )
    case 'frise':
      return bloc.valeur.evenements.filter((evenement) => evenement.libelle.trim() !== '').length < 3
  }
}

/**
 * Largeur d'un bloc en colonnes, sur la grille de 12.
 *
 * Un contenu écrit avant la poignée n'a pas de « colonnes » : on retombe alors
 * sur l'ancien champ « largeur ». Les bornes sont appliquées ici plutôt qu'à
 * l'écriture — un contenu.json retouché à la main ne doit pas pouvoir produire
 * un bloc de deux pixels de large sur la borne.
 */
export function colonnesDe(bloc: BlocLibre): number {
  if (typeof bloc.colonnes === 'number' && Number.isFinite(bloc.colonnes)) {
    return Math.min(COLONNES_GRILLE, Math.max(COLONNES_MIN, Math.round(bloc.colonnes)))
  }
  return bloc.largeur === 'moitie' ? COLONNES_GRILLE / 2 : COLONNES_GRILLE
}

/**
 * Largeur d'un emplacement du modèle, en colonnes.
 * Priorité : le réglage de la page, puis la valeur par défaut du modèle, puis
 * la pleine largeur.
 */
export function colonnesEmplacement(
  contenu: ContenuPage,
  nom: string,
  parDefaut: number | undefined,
): number {
  const choisie = contenu.largeurs?.[nom]
  const brute = typeof choisie === 'number' ? choisie : (parDefaut ?? COLONNES_GRILLE)
  return Math.min(COLONNES_GRILLE, Math.max(COLONNES_MIN, Math.round(brute)))
}

/**
 * Colonnes laissées vides à gauche d'une cellule — ce qui la pousse vers la
 * droite et laisse un trou derrière elle.
 *
 * Bornées ici, comme les largeurs : un contenu.json retouché à la main ne doit
 * pas pouvoir pousser un bloc hors de la page. Le plafond tient compte de la
 * largeur du bloc, pour qu'il reste toujours quelque chose à afficher.
 */
function borneDecalage(valeur: unknown, colonnes: number): number {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return 0
  return Math.min(COLONNES_GRILLE - colonnes, Math.max(0, Math.round(valeur)))
}

/** Décalage d'un bloc ajouté, en colonnes vides à sa gauche. 0 = collé. */
export function decalageDe(bloc: BlocLibre): number {
  return borneDecalage(bloc.decalage, colonnesDe(bloc))
}

/** Décalage d'un emplacement du modèle, en colonnes vides à sa gauche. */
export function decalageEmplacement(
  contenu: ContenuPage,
  nom: string,
  colonnes: number,
): number {
  return borneDecalage(contenu.decalages?.[nom], colonnes)
}

/**
 * Ordre réel des cellules d'une page, du haut vers le bas.
 *
 * Une cellule est soit un emplacement du modèle (« titre »), soit un bloc
 * ajouté (« suite:<id> »). C'est **la** référence : le rendu, les contrôles et
 * l'éditeur l'utilisent tous, donc la page affichée est toujours celle que
 * l'éditeur montre.
 *
 * Deux cas :
 * - `contenu.ordre` présent → il fait autorité (ordre **et** présence : un
 *   emplacement absent de la liste a été retiré de la page). On filtre les
 *   entrées devenues caduques (bloc supprimé, emplacement disparu du modèle).
 * - absent → ordre d'origine : les sections du modèle dans l'ordre déclaré,
 *   chacune suivie des blocs qui s'y ancrent (`apres`). Les pages jamais
 *   réordonnées s'affichent donc exactement comme avant.
 */
export function ordreCellules(
  contenu: ContenuPage,
  modele: {
    emplacements: Record<string, unknown>
    sections: readonly { nom: string; emplacements: readonly string[] }[]
  },
): string[] {
  const suite = lireSuite(contenu)
  const existe = (cle: string): boolean =>
    cle.startsWith('suite:')
      ? suite.some((bloc) => `suite:${bloc.id}` === cle)
      : Object.prototype.hasOwnProperty.call(modele.emplacements, cle)

  if (contenu.ordre && contenu.ordre.length > 0) {
    const vues = new Set<string>()
    const retenues = contenu.ordre.filter((cle) => {
      if (vues.has(cle) || !existe(cle)) return false
      vues.add(cle)
      return true
    })
    // Un bloc ajouté après coup par une autre version de l'application ne doit
    // pas disparaître silencieusement : on le remet en fin de page.
    for (const bloc of suite) {
      if (!vues.has(`suite:${bloc.id}`)) retenues.push(`suite:${bloc.id}`)
    }
    return retenues
  }

  const noms = modele.sections.map((section) => section.nom)
  const cles: string[] = []
  const places = new Set<string>()
  for (const section of modele.sections) {
    for (const nom of section.emplacements) {
      if (existe(nom)) cles.push(nom)
    }
    for (const bloc of suite) {
      if (positionBloc(bloc, noms) === section.nom) {
        cles.push(`suite:${bloc.id}`)
        places.add(`suite:${bloc.id}`)
      }
    }
  }
  // Même garantie que plus haut : un bloc ajouté ne disparaît jamais en
  // silence. Sans cela, une page **vierge** — un modèle sans aucune section —
  // n'afficherait rien du tout, puisqu'il n'y a pas de section où accrocher ses
  // blocs, et que l'ordre explicite n'est écrit qu'au premier déplacement.
  for (const bloc of suite) {
    if (!places.has(`suite:${bloc.id}`)) cles.push(`suite:${bloc.id}`)
  }
  return cles
}

/**
 * Un bloc dont la hauteur est réglable : **tous**, sauf la photo — elle ne
 * l'est que si on a demandé à la **recadrer**.
 *
 * La photo reste l'exception : sans recadrage elle n'a pas de hauteur du tout,
 * elle est entière et son bloc suit ses proportions. Les poignées haute et
 * basse n'apparaissent donc sur une photo qu'après avoir coché « Recadrer » —
 * ce qui rend impossible de couper une photo par accident.
 *
 * Partout ailleurs (texte, titre, galerie, vidéo, quiz, frise), la hauteur
 * réglée est un **plancher** : le bloc ne descend jamais sous son contenu (voir
 * « min-height » dans modeles.css), il ne peut donc pas couper un texte.
 */
export function hauteurReglable(type: string, recadre = false): boolean {
  if (type === 'image') return recadre
  return true
}

function borneHauteur(valeur: number | undefined): number | undefined {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return undefined
  return Math.min(HAUTEUR_MAX, Math.max(HAUTEUR_MIN, Math.round(valeur)))
}

/**
 * Hauteur imposée à une cellule, ou « undefined » si sa hauteur est libre.
 *
 * Un seul passage pour les blocs ajoutés et les emplacements du modèle : c'est
 * lui qui garantit qu'une photo non recadrée n'a **jamais** de hauteur imposée,
 * quoi qu'il traîne dans le fichier. Les hauteurs enregistrées avant l'arrivée
 * du recadrage sont ainsi ignorées au lieu de couper les photos existantes.
 *
 * Une photo recadrée sans hauteur enregistrée reçoit la hauteur visée : le cadre
 * existe toujours, il n'est jamais plat.
 */
export function hauteurCellule(
  contenu: ContenuPage,
  nom: string,
  type: string,
  brute: number | undefined,
): number | undefined {
  if (!hauteurReglable(type, estRecadre(contenu, nom))) return undefined
  return borneHauteur(brute) ?? (type === 'image' ? HAUTEUR_PHOTO_VISEE : undefined)
}

/** Hauteur imposée à un bloc ajouté, ou « undefined » pour la hauteur d'origine. */
export function hauteurDe(contenu: ContenuPage, bloc: BlocLibre): number | undefined {
  return hauteurCellule(contenu, `suite:${bloc.id}`, bloc.valeur.type, bloc.hauteur)
}

/** Hauteur imposée à un emplacement du modèle, ou « undefined ». */
export function hauteurEmplacement(
  contenu: ContenuPage,
  nom: string,
  type: string,
): number | undefined {
  return hauteurCellule(contenu, nom, type, contenu.hauteurs?.[nom])
}

/** Tous les identifiants de médias référencés par une page (index d'usage, §9.4). */
export function mediasReferences(contenu: ContenuPage): string[] {
  const ids = new Set<string>()
  const valeurs = [
    ...Object.values(contenu.emplacements),
    ...lireSuite(contenu).map((bloc) => bloc.valeur),
  ]
  for (const valeur of valeurs) {
    if (!valeur) continue
    if (valeur.type === 'image' || valeur.type === 'video') {
      if (valeur.mediaId) ids.add(valeur.mediaId)
    } else if (valeur.type === 'galerie') {
      for (const element of valeur.elements) ids.add(element.mediaId)
    }
  }
  return [...ids]
}
