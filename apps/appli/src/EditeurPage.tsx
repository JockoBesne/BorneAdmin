import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  COLONNES_GRILLE,
  COLONNES_MIN,
  colonnesDe,
  colonnesEmplacement,
  ordreCellules,
  controlerContenu,
  DEFS_BLOCS_LIBRES,
  lireSuite,
  modelePar,
  FRISE_CONSIGNE_MAX_SIGNES,
  FRISE_DETAIL_MAX_SIGNES,
  FRISE_LIBELLE_MAX_SIGNES,
  QUIZ_EXPLICATION_MAX_SIGNES,
  QUIZ_QUESTION_MAX_SIGNES,
  QUIZ_REPONSE_MAX_SIGNES,
  type BlocLibre,
  type ContenuPage,
  type DefEmplacement,
  type EvenementFrise,
  type InfoMedia,
  type Manifeste,
  type MediaManifeste,
  type PageManifeste,
  type ReponseQuiz,
  type ValeurFrise,
  type ValeurQuiz,
  type TypeBlocLibre,
  type ValeurEmplacement,
} from '@borne/contenu'
import {
  RenduPage,
  ToileBorne,
  type EnveloppeEmplacement,
  type ResoudreMedia,
} from '@borne/contenu/rendu'
import { importerMedia, resolveurMedias } from './contenu.js'
import { couleursEffectives, stylesCouleurs } from './couleurs.js'
import { RoueCouleur } from './RoueCouleur.jsx'

/**
 * Éditeur d'une page.
 *
 * À gauche, la page telle que le visiteur la verra — c'est le même moteur de
 * rendu que la borne, l'aperçu est donc fidèle par construction. À droite, les
 * blocs de la page : on clique un bloc (dans la liste ou directement sur la
 * page) et son formulaire s'ouvre.
 *
 * L'éditeur ne touche jamais au disque : chaque changement remonte à
 * l'administration par « surModification », qui enregistre toute seule.
 */
export function EditeurPage({
  manifeste,
  page,
  surModification,
  surAjoutMedia,
}: {
  manifeste: Manifeste
  page: PageManifeste
  surModification: (transformation: (page: PageManifeste) => PageManifeste) => void
  surAjoutMedia: (media: MediaManifeste) => void
}) {
  const [selection, setSelection] = useState<string | null>(null)
  const [selecteur, setSelecteur] = useState<{ nom: string; type: 'image' | 'video' } | null>(null)
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [retraitEnCours, setRetraitEnCours] = useState<string | null>(null)
  const [couleursOuvertes, setCouleursOuvertes] = useState(false)
  // Glisser-déposer sur l'aperçu : bloc en cours de déplacement, et endroit visé.
  const [glisseId, setGlisseId] = useState<string | null>(null)
  const [depot, setDepot] = useState<{
    cle: string
    ou: 'avant' | 'apres' | 'gauche' | 'droite'
  } | null>(null)

  // Le manifeste est validé au chargement : le contenu a la forme attendue.
  const contenu = page.contenu as ContenuPage
  const modele = modelePar(contenu.modele)
  const suite = lireSuite(contenu)

  const resoudre = useMemo(() => resolveurMedias(manifeste), [manifeste])

  const infoMedia = useMemo(() => {
    const parId = new Map(manifeste.medias.map((media) => [media.id, media]))
    return (id: string): InfoMedia | null => {
      const media = parId.get(id)
      if (!media) return null
      return {
        id: media.id,
        type: media.type,
        largeur: media.largeur,
        hauteur: media.hauteur,
        dureeSecondes: media.dureeSecondes,
        legende: media.legende,
      }
    }
  }, [manifeste.medias])

  const problemes = useMemo(() => controlerContenu(contenu, infoMedia), [contenu, infoMedia])

  const modifierEmplacement = (
    nom: string,
    transformation: (valeur: ValeurEmplacement) => ValeurEmplacement,
  ) => {
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage

      // Bloc ajouté : le nom est « suite:<identifiant> ».
      if (nom.startsWith('suite:')) {
        const id = nom.slice('suite:'.length)
        const blocs = lireSuite(contenuPage).map((bloc) => {
          if (bloc.id !== id) return bloc
          const nouvelle = transformation(bloc.valeur)
          // Un bloc libre n'est jamais un titre : on ignore une transformation
          // qui tenterait d'en changer la nature (texte, image, galerie, vidéo
          // sont acceptés).
          if (nouvelle.type === 'titre') return bloc
          return { ...bloc, valeur: nouvelle }
        })
        return { ...precedente, contenu: { ...contenuPage, suite: blocs } }
      }

      const valeur = contenuPage.emplacements[nom]
      if (!valeur) return precedente
      const nouvelle = transformation(valeur)

      // Le titre affiché dans les listes suit le bloc « titre » de la page.
      let titre = precedente.titre
      if (nom === 'titre' && nouvelle.type === 'titre') {
        titre = nouvelle.valeur.trim() === '' ? 'Sans titre' : nouvelle.valeur.trim()
      }

      return {
        ...precedente,
        titre,
        contenu: {
          ...contenuPage,
          emplacements: { ...contenuPage.emplacements, [nom]: nouvelle },
        },
      }
    })
  }

  // ── Blocs ajoutés : ajout, retrait, déplacement ────────────────────────────

  // ── Couleurs propres à la page ─────────────────────────────────────────────

  const changerCouleurPage = (champ: 'couleurFond' | 'couleurTexte', hex: string) =>
    surModification((p) => ({ ...p, [champ]: hex }))

  // Revenir au thème global : on retire les couleurs propres à la page.
  const suivreThemeGlobal = () =>
    surModification((p) => {
      const copie = { ...p }
      delete copie.couleurFond
      delete copie.couleurTexte
      return copie
    })

  const couleursPage = couleursEffectives(manifeste.reglages, page)
  const pagePersonnalisee = page.couleurFond !== undefined || page.couleurTexte !== undefined

  // Règle la largeur d'un bloc, en colonnes sur la grille de 12. Appelé par la
  // poignée de l'aperçu (glissement) comme par le bouton du panneau (clavier).
  const redimensionnerBloc = (cle: string, colonnes: number) => {
    const borne = Math.min(COLONNES_GRILLE, Math.max(COLONNES_MIN, Math.round(colonnes)))
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage

      // Un bloc ajouté porte sa largeur ; un emplacement du modèle la range
      // dans « largeurs », parce qu'on ne réécrit pas la déclaration du modèle.
      if (cle.startsWith('suite:')) {
        const id = cle.slice('suite:'.length)
        return {
          ...precedente,
          contenu: {
            ...contenuPage,
            suite: lireSuite(contenuPage).map((bloc) =>
              // « largeur » est laissé de côté : « colonnes » l'emporte à la
              // lecture, et garder l'ancien champ permet d'ouvrir le contenu
              // avec une version précédente de l'application sans tout perdre.
              bloc.id === id ? { ...bloc, colonnes: borne } : bloc,
            ),
          },
        }
      }

      return {
        ...precedente,
        contenu: {
          ...contenuPage,
          largeurs: { ...(contenuPage.largeurs ?? {}), [cle]: borne },
        },
      }
    })
  }

  /** Largeurs proposées au bouton : les fractions qui tombent juste sur 12. */
  const PALIERS = [COLONNES_GRILLE, 9, 8, 6, 4, 3]

  const libelleLargeur = (colonnes: number): string => {
    switch (colonnes) {
      case 12:
        return 'Pleine largeur'
      case 9:
        return 'Trois quarts'
      case 8:
        return 'Deux tiers'
      case 6:
        return 'Moitié'
      case 4:
        return 'Un tiers'
      case 3:
        return 'Un quart'
      default:
        return `${colonnes} colonnes sur ${COLONNES_GRILLE}`
    }
  }


  const choisirMedia = (nom: string, media: MediaManifeste) => {
    modifierEmplacement(nom, (valeur) => {
      if (valeur.type === 'galerie') {
        return {
          ...valeur,
          elements: [...valeur.elements, { mediaId: media.id, legende: media.legende }],
        }
      }
      if (valeur.type === 'image' || valeur.type === 'video') {
        return { ...valeur, mediaId: media.id, legende: valeur.legende || media.legende }
      }
      return valeur
    })
    setSelecteur(null)
  }

  // Import depuis l'ordinateur : le fichier est copié dans la bibliothèque,
  // puis placé directement dans le bloc qui a ouvert le sélecteur.
  const importerDepuisDisque = () => {
    if (!selecteur) return
    const { nom, type } = selecteur
    void importerMedia(type).then((media) => {
      if (!media) return
      surAjoutMedia(media)
      choisirMedia(nom, media)
    })
  }

  if (!modele) {
    return <p className="admin__message">Le modèle de cette page est inconnu.</p>
  }

  // Définition d'un bloc à partir de son nom : un emplacement du modèle, ou —
  // préfixe « suite: » — un bloc ajouté, dont la définition dépend de son type.
  const defPour = (nom: string): DefEmplacement | undefined => {
    if (nom.startsWith('suite:')) {
      const id = nom.slice('suite:'.length)
      const bloc = suite.find((candidat) => candidat.id === id)
      return bloc ? DEFS_BLOCS_LIBRES[bloc.valeur.type] : undefined
    }
    return modele.emplacements[nom]
  }

  // ── Glisser-déposer d'un bloc sur l'aperçu ─────────────────────────────────
  //
  // On attrape un bloc ajouté et on le lâche sur un autre : au centre pour
  // l'insérer avant/après, sur un flanc pour les mettre côte à côte.
  //
  // Événements pointeur, jamais l'API « drag and drop » HTML5 : celle-ci ne
  // fonctionne pas au doigt, et la borne est un écran tactile.

  /** Où le bloc va tomber, tel que le pointeur le désigne. */
  type Depot = { cle: string; ou: 'avant' | 'apres' | 'gauche' | 'droite' }

  const depart = useRef<{ x: number; y: number; id: string; actif: boolean } | null>(null)
  const vientDeGlisser = useRef(false)
  /** Dernière position connue du pointeur, relue par le défilement automatique. */
  const dernierPoint = useRef<{ x: number; y: number } | null>(null)
  const minuterieDefilement = useRef<ReturnType<typeof setInterval> | null>(null)

  const arreterDefilement = () => {
    if (minuterieDefilement.current !== null) {
      clearInterval(minuterieDefilement.current)
      minuterieDefilement.current = null
    }
  }

  // L'éditeur peut être quitté en plein glissement : sans ce nettoyage, la
  // minuterie continuerait de tourner dans le vide.
  useEffect(() => arreterDefilement, [])

  /**
   * Défilement automatique de l'aperçu quand on approche du haut ou du bas.
   *
   * Indispensable : un quiz ou une frise occupe presque tout l'écran, la cible
   * est donc souvent hors de vue au moment où l'on saisit le bloc. Le doigt
   * peut rester immobile au bord — c'est une minuterie qui fait défiler, pas le
   * mouvement du pointeur.
   */
  const lancerDefilement = () => {
    if (minuterieDefilement.current !== null) return
    minuterieDefilement.current = setInterval(() => {
      const point = dernierPoint.current
      const glisse = depart.current
      const toile = document.querySelector('.edit__apercu .toile') as HTMLElement | null
      if (!point || !glisse?.actif || !toile) return

      const cadre = toile.getBoundingClientRect()
      const marge = 90
      const pas = point.y < cadre.top + marge ? -18 : point.y > cadre.bottom - marge ? 18 : 0
      if (pas === 0) return

      const avant = toile.scrollTop
      toile.scrollTop += pas
      // La page a bougé sous le pointeur : la cible visée n'est plus la même.
      if (toile.scrollTop !== avant) setDepot(depotDepuisPoint(point.x, point.y, glisse.id))
    }, 16)
  }

  /**
   * Cellule visée par le pointeur, et à quel endroit d'icelle.
   *
   * Les coordonnées n'ont pas besoin d'être converties malgré la mise à
   * l'échelle de l'aperçu : la toile utilise « zoom », qui recalcule vraiment la
   * mise en page — les rectangles renvoyés sont donc déjà dans le même repère
   * que « clientX / clientY ». (Ce ne serait pas vrai avec « transform ».)
   */
  const depotDepuisPoint = (x: number, y: number, cleGlisse: string): Depot | null => {
    const dessous = document.elementFromPoint(x, y) as HTMLElement | null
    const emplacement = dessous?.closest('.emp[data-nom]') as HTMLElement | null
    const cle = emplacement?.dataset['nom']
    if (!emplacement || !cle || cle === cleGlisse) return null

    const cadre = emplacement.getBoundingClientRect()
    const fractionX = (x - cadre.left) / cadre.width
    if (fractionX < 0.28) return { cle, ou: 'gauche' }
    if (fractionX > 0.72) return { cle, ou: 'droite' }
    return { cle, ou: (y - cadre.top) / cadre.height < 0.5 ? 'avant' : 'apres' }
  }

  /** Largeur actuelle d'une cellule, qu'elle vienne du modèle ou de la suite. */
  const colonnesDeCle = (contenuPage: ContenuPage, cle: string): number => {
    if (cle.startsWith('suite:')) {
      const bloc = lireSuite(contenuPage).find(
        (candidat) => `suite:${candidat.id}` === cle,
      )
      return bloc ? colonnesDe(bloc) : COLONNES_GRILLE
    }
    return colonnesEmplacement(contenuPage, cle, modele.emplacements[cle]?.colonnes)
  }

  /** Fixe la largeur d'une cellule, au bon endroit selon sa nature. */
  const avecLargeur = (contenuPage: ContenuPage, cle: string, colonnes: number): ContenuPage => {
    const borne = Math.min(COLONNES_GRILLE, Math.max(COLONNES_MIN, Math.round(colonnes)))
    if (cle.startsWith('suite:')) {
      const id = cle.slice('suite:'.length)
      return {
        ...contenuPage,
        suite: lireSuite(contenuPage).map((bloc) =>
          bloc.id === id ? { ...bloc, colonnes: borne } : bloc,
        ),
      }
    }
    return {
      ...contenuPage,
      largeurs: { ...(contenuPage.largeurs ?? {}), [cle]: borne },
    }
  }

  /**
   * Rangées de la page : les cellules se suivent sur les 12 colonnes et passent
   * à la ligne dès qu'il n'y a plus la place — la règle même de la grille de
   * l'aperçu, refaite ici pour savoir qui partage sa rangée avec qui.
   */
  const rangeesDe = (contenuPage: ContenuPage): string[][] => {
    const rangees: string[][] = []
    let reste = 0
    for (const cle of ordreCellules(contenuPage, modele)) {
      const colonnes = colonnesDeCle(contenuPage, cle)
      const derniere = rangees[rangees.length - 1]
      if (derniere && colonnes <= reste) {
        derniere.push(cle)
        reste -= colonnes
      } else {
        rangees.push([cle])
        reste = COLONNES_GRILLE - colonnes
      }
    }
    return rangees
  }

  /**
   * Un bloc qui vient de perdre le voisin avec lequel il partageait sa rangée
   * reprend toute la largeur. Sans cela, sortir un bloc d'une paire laisse
   * l'autre en demi-largeur, seul, avec un grand vide à côté de lui — ce que
   * personne ne demande jamais. Un bloc qui était **déjà** seul n'est pas
   * touché : sa largeur a été réglée exprès, à la poignée ou au bouton.
   */
  const recollerOrphelins = (avant: ContenuPage, apres: ContenuPage): ContenuPage => {
    const accompagnes = new Set(
      rangeesDe(avant)
        .filter((rangee) => rangee.length > 1)
        .flat(),
    )
    let resultat = apres
    for (const rangee of rangeesDe(apres)) {
      const [cle] = rangee
      if (rangee.length !== 1 || !cle || !accompagnes.has(cle)) continue
      if (colonnesDeCle(resultat, cle) < COLONNES_GRILLE) {
        resultat = avecLargeur(resultat, cle, COLONNES_GRILLE)
      }
    }
    return resultat
  }

  /**
   * Place une cellule à l'endroit désigné par le dépôt : rang dans l'ordre de
   * la page, et répartition des colonnes quand on la pose sur un flanc.
   *
   * Tout passe par « ordre », la liste unique des cellules : un emplacement du
   * modèle et un bloc ajouté s'y déplacent exactement pareil. Sert au
   * déplacement d'un bloc existant **comme** à l'arrivée d'un bloc tout neuf
   * glissé depuis le menu d'ajout.
   */
  const placerCellule = (
    contenuPage: ContenuPage,
    cleGlisse: string,
    depot: Depot,
  ): ContenuPage | null => {
    const reste = ordreCellules(contenuPage, modele).filter((cle) => cle !== cleGlisse)

    let vers = reste.indexOf(depot.cle)
    if (vers < 0) return null
    if (depot.ou === 'apres' || depot.ou === 'droite') vers += 1
    reste.splice(vers, 0, cleGlisse)

    let resultat: ContenuPage = { ...contenuPage, ordre: reste }

    if (depot.ou === 'gauche' || depot.ou === 'droite') {
      // Côte à côte : les deux cellules doivent tenir sur les mêmes 12
      // colonnes. Si le voisin est trop large pour laisser la place minimale,
      // on partage en deux moitiés ; sinon il garde sa largeur et l'autre
      // prend le reste.
      const largeurVoisin = colonnesDeCle(resultat, depot.cle)
      const partage = largeurVoisin > COLONNES_GRILLE - COLONNES_MIN
      const colonnesVoisin = partage ? COLONNES_GRILLE / 2 : largeurVoisin
      resultat = avecLargeur(resultat, depot.cle, colonnesVoisin)
      resultat = avecLargeur(resultat, cleGlisse, COLONNES_GRILLE - colonnesVoisin)
    } else {
      // Déposé au-dessus ou en dessous : le bloc prend **toute la largeur**,
      // il occupe donc une rangée à lui seul. C'est ce que le geste annonce —
      // un trait horizontal pleine largeur — et cela évite qu'un bloc resté
      // en demi-largeur se glisse à côté du voisin sans qu'on l'ait demandé.
      resultat = avecLargeur(resultat, cleGlisse, COLONNES_GRILLE)
    }

    return resultat
  }

  /** Déplace une cellule existante à l'endroit désigné par le dépôt. */
  const deposerCellule = (cleGlisse: string, depot: Depot) => {
    surModification((precedente) => {
      const avant = precedente.contenu as ContenuPage
      if (cleGlisse === depot.cle) return precedente
      if (!ordreCellules(avant, modele).includes(cleGlisse)) return precedente

      const apres = placerCellule(avant, cleGlisse, depot)
      if (!apres) return precedente
      return { ...precedente, contenu: recollerOrphelins(avant, apres) }
    })
  }

  /**
   * Crée un bloc et le pose à l'endroit visé : c'est le glissement depuis le
   * menu d'ajout. Sans dépôt — simple clic sur le type — le bloc naît en bas de
   * page, comme avant, et les flèches ▲▼ le remontent.
   */
  const ajouterBloc = (type: TypeBlocLibre, depot: Depot | null = null) => {
    const bloc: BlocLibre = {
      id: crypto.randomUUID(),
      apres: modele.sections[modele.sections.length - 1]?.nom,
      valeur: valeurNeuve(type),
    }
    const cle = `suite:${bloc.id}`

    surModification((precedente) => {
      const avant = precedente.contenu as ContenuPage
      const avecBloc: ContenuPage = { ...avant, suite: [...lireSuite(avant), bloc] }
      const place = depot ? placerCellule(avecBloc, cle, depot) : null
      return { ...precedente, contenu: place ?? avecBloc }
    })

    setAjoutOuvert(false)
    setSelection(cle)
  }

  /** Remet en bas de page un emplacement du modèle qui en avait été retiré. */
  const remettreEmplacement = (nom: string) => {
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage
      const ordreActuel = ordreCellules(contenuPage, modele)
      if (ordreActuel.includes(nom)) return precedente
      return { ...precedente, contenu: { ...contenuPage, ordre: [...ordreActuel, nom] } }
    })
    setSelection(nom)
  }

  // ── Glisser-déposer dans la liste du panneau ───────────────────────────────
  //
  // Second chemin, volontairement plus simple que celui de l'aperçu : les
  // lignes sont compactes et toutes visibles, donc le geste reste praticable
  // même quand les blocs sont hauts. Il ne fait que réordonner (haut/bas) ; la
  // mise côte à côte reste l'affaire de l'aperçu et du bouton de largeur.

  const departListe = useRef<{ y: number; cle: string; actif: boolean } | null>(null)
  const [cibleListe, setCibleListe] = useState<string | null>(null)

  /** Ligne du panneau visée par le pointeur, et de quel côté l'insérer. */
  const cibleListeDepuisY = (y: number, cleGlisse: string): string | null => {
    const lignes = [...document.querySelectorAll<HTMLElement>('.pan__ligne[data-cle]')]
    for (const ligne of lignes) {
      const cle = ligne.dataset['cle']
      if (!cle || cle === cleGlisse) continue
      const cadre = ligne.getBoundingClientRect()
      if (y >= cadre.top && y <= cadre.bottom) return cle
    }
    return null
  }

  /** Place la cellule glissée juste avant celle visée. */
  const deposerDansListe = (cleGlisse: string, cleCible: string) => {
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage
      const ordreActuel = ordreCellules(contenuPage, modele)
      const depuis = ordreActuel.indexOf(cleGlisse)
      const vers = ordreActuel.indexOf(cleCible)
      if (depuis < 0 || vers < 0 || depuis === vers) return precedente

      const reste = ordreActuel.filter((cle) => cle !== cleGlisse)
      const position = reste.indexOf(cleCible)
      // Vers le bas, on se pose après la cible ; vers le haut, avant : le bloc
      // atterrit ainsi là où le trait d'insertion l'annonçait.
      reste.splice(depuis < vers ? position + 1 : position, 0, cleGlisse)
      return {
        ...precedente,
        contenu: recollerOrphelins(contenuPage, { ...contenuPage, ordre: reste }),
      }
    })
  }

  /** Monte ou descend une cellule d'un cran dans l'ordre de la page. */
  const deplacerCellule = (cle: string, sens: -1 | 1) => {
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage
      const ordreActuel = [...ordreCellules(contenuPage, modele)]
      const depuis = ordreActuel.indexOf(cle)
      const vers = depuis + sens
      if (depuis < 0 || vers < 0 || vers >= ordreActuel.length) return precedente
      const [retiree] = ordreActuel.splice(depuis, 1)
      if (!retiree) return precedente
      ordreActuel.splice(vers, 0, retiree)
      return {
        ...precedente,
        contenu: recollerOrphelins(contenuPage, { ...contenuPage, ordre: ordreActuel }),
      }
    })
  }

  /**
   * Retire une cellule de la page. Un bloc ajouté est supprimé pour de bon ; un
   * emplacement du modèle est seulement retiré de l'ordre — sa valeur reste
   * dans le contenu, donc le remettre plus tard le retrouve intact.
   */
  const retirerCellule = (cle: string) => {
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage
      const ordre = ordreCellules(contenuPage, modele).filter((autre) => autre !== cle)
      const apres: ContenuPage = cle.startsWith('suite:')
        ? {
            ...contenuPage,
            ordre,
            suite: lireSuite(contenuPage).filter(
              (bloc) => bloc.id !== cle.slice('suite:'.length),
            ),
          }
        : { ...contenuPage, ordre }
      return { ...precedente, contenu: recollerOrphelins(contenuPage, apres) }
    })
    setRetraitEnCours(null)
    if (selection === cle) setSelection(null)
  }

  /**
   * Clé d'un bloc qui n'existe pas encore : le geste part du menu d'ajout, la
   * cellule sera créée au moment du dépôt. Le préfixe suffit à la reconnaître —
   * aucune cellule réelle ne s'appelle ainsi.
   */
  const PREFIXE_NEUF = 'nouveau:'

  const auPointeurDescendu = (evenement: React.PointerEvent<HTMLElement>, nom: string) => {
    // La poignée de largeur a son propre glissement : ne pas le lui voler.
    if ((evenement.target as HTMLElement).closest('.mdl__poignee')) return
    depart.current = { x: evenement.clientX, y: evenement.clientY, id: nom, actif: false }
  }

  const auPointeurDeplace = (evenement: React.PointerEvent<HTMLElement>) => {
    const debut = depart.current
    if (!debut) return

    // Seuil : en deçà, c'est un clic (sélection), pas un glissement.
    if (!debut.actif) {
      if (Math.hypot(evenement.clientX - debut.x, evenement.clientY - debut.y) < 8) return
      debut.actif = true
      try {
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
      } catch {
        /* capture refusée : le glissement reste utilisable, simplement moins tolérant */
      }
      setGlisseId(debut.id)
      lancerDefilement()
    }

    dernierPoint.current = { x: evenement.clientX, y: evenement.clientY }
    setDepot(depotDepuisPoint(evenement.clientX, evenement.clientY, debut.id))
  }

  const auPointeurRelache = () => {
    const debut = depart.current
    depart.current = null
    arreterDefilement()
    dernierPoint.current = null
    if (debut?.actif) {
      if (depot) {
        if (debut.id.startsWith(PREFIXE_NEUF)) {
          ajouterBloc(debut.id.slice(PREFIXE_NEUF.length) as TypeBlocLibre, depot)
        } else {
          deposerCellule(debut.id, depot)
        }
      }
      // Empêche le clic qui suit de re-sélectionner (ou d'ajouter un second
      // bloc en bas de page) : un glissement n'est pas un clic.
      vientDeGlisser.current = true
      // …mais le drapeau doit retomber tout de suite après. Le clic de fin de
      // geste part avant la moindre minuterie ; s'il n'a pas lieu du tout (le
      // menu d'ajout se referme au dépôt), sans cela le drapeau avalerait un
      // vrai clic, plus tard.
      setTimeout(() => {
        vientDeGlisser.current = false
      }, 0)
    }
    setGlisseId(null)
    setDepot(null)
  }

  // Enveloppe des blocs dans l'aperçu : un liseré au survol, une étiquette avec
  // le nom du bloc, et un clic qui le sélectionne dans le panneau de droite.
  const enveloppe: EnveloppeEmplacement = (info, defaut) => {
    const def = defPour(info.nom)
    if (!def) return defaut

    const actif = selection === info.nom
    const enProbleme = problemes.some(
      (probleme) => probleme.emplacement === info.nom && probleme.gravite === 'bloquant',
    )

    const enGlissement = glisseId === info.nom
    const vise = depot?.cle === info.nom ? ` emp--depot-${depot.ou}` : ''

    return (
      <div
        className={`emp emp--deplacable${actif ? ' emp--actif' : ''}${
          enProbleme ? ' emp--probleme' : ''
        }${enGlissement ? ' emp--glisse' : ''}${vise}`}
        data-nom={info.nom}
        role="button"
        tabIndex={0}
        aria-label={`Modifier : ${def.libelle}`}
        onPointerDown={(evenement) => auPointeurDescendu(evenement, info.nom)}
        onPointerMove={auPointeurDeplace}
        onPointerUp={auPointeurRelache}
        onPointerCancel={auPointeurRelache}
        onClick={(evenement) => {
          evenement.stopPropagation()
          // Un glissement vient de se terminer : ne pas le traiter comme un clic.
          if (vientDeGlisser.current) {
            vientDeGlisser.current = false
            return
          }
          setSelection(info.nom)
        }}
        onKeyDown={(evenement) => {
          if (evenement.key === 'Enter' || evenement.key === ' ') {
            evenement.preventDefault()
            setSelection(info.nom)
          }
        }}
      >
        {defaut}
        <span className="emp__etiquette" aria-hidden="true">
          {def.libelle}
        </span>
      </div>
    )
  }

  const defSelection = selection ? defPour(selection) : undefined
  const valeurSelection = selection
    ? selection.startsWith('suite:')
      ? suite.find((bloc) => `suite:${bloc.id}` === selection)?.valeur
      : contenu.emplacements[selection]
    : undefined

  // La page dans son ordre réel : chaque section du modèle, puis les blocs
  // ajoutés qui la suivent. C'est ce plan que le panneau affiche.
  // L'ordre réel de la page : emplacements du modèle et blocs ajoutés mêlés,
  // du haut vers le bas. Même source que le rendu — le panneau montre donc
  // exactement ce que le visiteur verra.
  const ordre = ordreCellules(contenu, modele)
  // Emplacements du modèle absents de la page : on doit pouvoir les remettre.
  const retires = Object.keys(modele.emplacements).filter((nom) => !ordre.includes(nom))

  return (
    <div className="edit">
      <div
        className="edit__apercu"
        style={stylesCouleurs(couleursEffectives(manifeste.reglages, page))}
        onClick={() => setSelection(null)}
      >
        <ToileBorne>
          <RenduPage
            contenu={contenu}
            media={resoudre}
            emp={enveloppe}
            surRedimensionner={redimensionnerBloc}
          />
        </ToileBorne>
      </div>

      <aside className="pan">
        <div className="pan__couleurs">
          <button
            type="button"
            className="pan__replier"
            aria-expanded={couleursOuvertes}
            onClick={() => setCouleursOuvertes((v) => !v)}
          >
            <span>Couleurs de la page</span>
            <span aria-hidden="true">{couleursOuvertes ? '▲' : '▼'}</span>
          </button>

          {couleursOuvertes ? (
            <div className="pan__couleurs-corps">
              <p className="pan__aide">
                {pagePersonnalisee
                  ? 'Cette page a ses propres couleurs, différentes du thème général.'
                  : 'Cette page suit le thème général. La régler ici ne change qu’elle.'}
              </p>

              <div className="apparence__couleur">
                <span className="champ__libelle">Fond de la page</span>
                <RoueCouleur
                  valeur={couleursPage.couleurFond}
                  surChangement={(hex) => changerCouleurPage('couleurFond', hex)}
                />
              </div>

              <div className="apparence__couleur">
                <span className="champ__libelle">Texte de la page</span>
                <RoueCouleur
                  valeur={couleursPage.couleurTexte}
                  surChangement={(hex) => changerCouleurPage('couleurTexte', hex)}
                />
              </div>

              {pagePersonnalisee ? (
                <button type="button" className="abtn abtn--discret" onClick={suivreThemeGlobal}>
                  Suivre le thème général
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <h2 className="pan__titre">Blocs de la page</h2>

        <ul className="pan__blocs">
          {ordre.map((cle, index) => {
            const def = defPour(cle)
            if (!def) return null
            const blocAjoute = suite.find((candidat) => `suite:${candidat.id}` === cle)
            const valeur = blocAjoute ? blocAjoute.valeur : contenu.emplacements[cle]
            const colonnes = colonnesDeCle(contenu, cle)

            return (
              <li
                key={cle}
                data-cle={cle}
                className={`pan__ligne${blocAjoute ? ' pan__ligne--ajoutee' : ''}${
                  departListe.current?.cle === cle && departListe.current.actif
                    ? ' pan__ligne--glisse'
                    : ''
                }${cibleListe === cle ? ' pan__ligne--cible' : ''}`}
              >
                {retraitEnCours === cle ? (
                  <>
                    <span className="pan__retrait">
                      {blocAjoute ? 'Retirer ce bloc ?' : 'Retirer de la page ?'}
                    </span>
                    <button
                      type="button"
                      className="abtn abtn--danger"
                      onClick={() => retirerCellule(cle)}
                    >
                      Retirer
                    </button>
                    <button
                      type="button"
                      className="abtn abtn--discret"
                      onClick={() => setRetraitEnCours(null)}
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    {/* Poignée de saisie : on attrape ici, jamais sur le bloc
                        lui-même — sans quoi le clic de sélection deviendrait
                        imprévisible. */}
                    <button
                      type="button"
                      className="pan__poignee"
                      aria-label={`Déplacer : ${def.libelle}`}
                      title="Glisser pour déplacer"
                      onPointerDown={(evenement) => {
                        departListe.current = { y: evenement.clientY, cle, actif: false }
                      }}
                      onPointerMove={(evenement) => {
                        const debut = departListe.current
                        if (!debut) return
                        if (!debut.actif) {
                          if (Math.abs(evenement.clientY - debut.y) < 8) return
                          debut.actif = true
                          try {
                            evenement.currentTarget.setPointerCapture(evenement.pointerId)
                          } catch {
                            /* capture refusée : le glissement reste utilisable */
                          }
                        }
                        setCibleListe(cibleListeDepuisY(evenement.clientY, debut.cle))
                      }}
                      onPointerUp={() => {
                        const debut = departListe.current
                        departListe.current = null
                        if (debut?.actif && cibleListe) deposerDansListe(debut.cle, cibleListe)
                        setCibleListe(null)
                      }}
                      onPointerCancel={() => {
                        departListe.current = null
                        setCibleListe(null)
                      }}
                    >
                      ⠿
                    </button>
                    <button
                      type="button"
                      className={`pan__bloc${selection === cle ? ' pan__bloc--actif' : ''}`}
                      onClick={() => setSelection(selection === cle ? null : cle)}
                    >
                      <span className="pan__bloc-libelle">{def.libelle}</span>
                      <span className="pan__bloc-resume">{resumeBloc(valeur)}</span>
                    </button>
                    <button
                      type="button"
                      className="abtn abtn--mini"
                      aria-label="Monter ce bloc"
                      disabled={index === 0}
                      onClick={() => deplacerCellule(cle, -1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="abtn abtn--mini"
                      aria-label="Descendre ce bloc"
                      disabled={index === ordre.length - 1}
                      onClick={() => deplacerCellule(cle, 1)}
                    >
                      ▼
                    </button>
                    {/* Équivalent au clavier de la poignée de l'aperçu : passe
                        d'une largeur courante à la suivante. Le glissement ne
                        doit jamais être le seul moyen. */}
                    <button
                      type="button"
                      className={`abtn abtn--mini${colonnes < COLONNES_GRILLE ? ' abtn--actif' : ''}`}
                      aria-label={`Largeur : ${libelleLargeur(colonnes)}. Changer.`}
                      title={`Largeur : ${libelleLargeur(colonnes)}`}
                      onClick={() => {
                        const rang = PALIERS.indexOf(colonnes)
                        const suivante = PALIERS[(rang === -1 ? 0 : rang + 1) % PALIERS.length]!
                        redimensionnerBloc(cle, suivante)
                      }}
                    >
                      {colonnes === COLONNES_GRILLE ? '▭' : '◧'}
                    </button>
                    <button
                      type="button"
                      className="abtn abtn--mini abtn--danger"
                      aria-label="Retirer ce bloc de la page"
                      onClick={() => setRetraitEnCours(cle)}
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>

        {suite.length === 0 ? (
          <p className="pan__aide">
            Ajoutez du texte, une photo ou une galerie : touchez le type et le bloc se place en
            bas de page, ou glissez-le directement à l'endroit voulu sur l'aperçu. Les flèches
            ▲▼ le déplacent ensuite — y compris entre les blocs du modèle.
          </p>
        ) : null}

        {/* Emplacements du modèle retirés de la page. Leur contenu est conservé :
            les remettre le retrouve intact. Sans cette liste, un retrait serait
            sans retour. */}
        {retires.length > 0 ? (
          <div className="pan__retires">
            <span className="champ__libelle">Retirés de cette page</span>
            <div className="pan__actions">
              {retires.map((nom) => (
                <button
                  key={nom}
                  type="button"
                  className="abtn abtn--discret"
                  onClick={() => remettreEmplacement(nom)}
                >
                  + {modele.emplacements[nom]?.libelle ?? nom}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {ajoutOuvert ? (
          <div className="pan__actions" role="group" aria-label="Type de bloc à ajouter">
            {/* Chaque type s'ajoute de deux façons : on le touche (le bloc se
                pose en bas de page) ou on le glisse jusqu'à l'endroit voulu sur
                l'aperçu. Le glissement n'est jamais le seul moyen. */}
            {TYPES_AJOUTABLES.map(({ type, libelle }) => (
              <button
                key={type}
                type="button"
                className="abtn"
                title={`${libelle} — toucher pour l'ajouter en bas, ou glisser sur la page`}
                onPointerDown={(evenement) =>
                  auPointeurDescendu(evenement, `${PREFIXE_NEUF}${type}`)
                }
                onPointerMove={auPointeurDeplace}
                onPointerUp={auPointeurRelache}
                onPointerCancel={auPointeurRelache}
                onClick={() => {
                  // Le glissement vient de déposer le bloc : ne pas en ajouter
                  // un second.
                  if (vientDeGlisser.current) {
                    vientDeGlisser.current = false
                    return
                  }
                  ajouterBloc(type)
                }}
              >
                {libelle}
              </button>
            ))}
            <button
              type="button"
              className="abtn abtn--discret"
              onClick={() => setAjoutOuvert(false)}
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="abtn abtn--principal"
            onClick={() => setAjoutOuvert(true)}
          >
            + Ajouter un bloc
          </button>
        )}

        {selection && defSelection && valeurSelection ? (
          <FormulaireBloc
            key={selection}
            def={defSelection}
            valeur={valeurSelection}
            resoudre={resoudre}
            surChangement={(transformation) => modifierEmplacement(selection, transformation)}
            surChoisirMedia={(type) => setSelecteur({ nom: selection, type })}
          />
        ) : (
          <p className="pan__aide">
            Cliquez un bloc — ici ou directement sur la page — pour le modifier.
          </p>
        )}

        <div className="pan__problemes">
          {problemes.length === 0 ? (
            <p className="controle controle--ok">✓ Cette page est complète.</p>
          ) : (
            problemes.map((probleme, index) => (
              <p key={index} className={`controle controle--${probleme.gravite}`}>
                {probleme.gravite === 'bloquant' ? '✗' : '⚠'} {probleme.message}
              </p>
            ))
          )}
        </div>
      </aside>

      {selecteur ? (
        <SelecteurMedia
          type={selecteur.type}
          manifeste={manifeste}
          resoudre={resoudre}
          surChoix={(media) => choisirMedia(selecteur.nom, media)}
          surImporter={importerDepuisDisque}
          surFermeture={() => setSelecteur(null)}
        />
      ) : null}
    </div>
  )
}

/** Résumé d'un bloc pour la liste : dit d'un coup d'œil ce qu'il contient. */
function resumeBloc(valeur: ValeurEmplacement | undefined): string {
  if (!valeur) return '—'
  switch (valeur.type) {
    case 'titre':
    case 'texte': {
      const signes = valeur.valeur.trim().length
      return signes === 0 ? 'vide' : `${signes} signe${signes > 1 ? 's' : ''}`
    }
    case 'image':
      return valeur.mediaId ? 'photo choisie' : 'vide'
    case 'video':
      return valeur.mediaId ? 'vidéo choisie' : 'vide'
    case 'galerie':
      return valeur.elements.length === 0
        ? 'vide'
        : `${valeur.elements.length} photo${valeur.elements.length > 1 ? 's' : ''}`
    case 'quiz': {
      const remplies = valeur.reponses.filter((reponse) => reponse.texte.trim() !== '').length
      if (valeur.question.trim() === '') return 'sans question'
      return `${remplies} réponse${remplies > 1 ? 's' : ''}`
    }
    case 'frise': {
      const remplis = valeur.evenements.filter((evenement) => evenement.libelle.trim() !== '').length
      return remplis === 0 ? 'vide' : `${remplis} événement${remplis > 1 ? 's' : ''}`
    }
  }
}

/** Les types de blocs proposés par le menu d'ajout, dans l'ordre affiché. */
const TYPES_AJOUTABLES: { type: TypeBlocLibre; libelle: string }[] = [
  { type: 'texte', libelle: 'Texte' },
  { type: 'image', libelle: 'Photo' },
  { type: 'galerie', libelle: 'Galerie' },
  { type: 'video', libelle: 'Vidéo' },
  { type: 'quiz', libelle: 'Quiz' },
  { type: 'frise', libelle: 'Frise' },
]

/**
 * Contenu d'un bloc qui vient d'être ajouté. Les ateliers naissent avec leurs
 * lignes vides déjà en place : le personnel voit tout de suite ce qu'on attend
 * de lui, au lieu d'une liste vide devant laquelle il faut deviner.
 */
function valeurNeuve(type: TypeBlocLibre): BlocLibre['valeur'] {
  switch (type) {
    case 'texte':
      return { type: 'texte', valeur: '' }
    case 'image':
      return { type: 'image', mediaId: null, legende: '' }
    case 'video':
      return { type: 'video', mediaId: null, legende: '' }
    case 'galerie':
      return { type: 'galerie', elements: [] }
    case 'quiz':
      return {
        type: 'quiz',
        question: '',
        reponses: [reponseNeuve(true), reponseNeuve(false)],
      }
    case 'frise':
      return {
        type: 'frise',
        consigne: '',
        evenements: [evenementNeuf(), evenementNeuf(), evenementNeuf()],
      }
  }
}

const reponseNeuve = (correcte: boolean): ReponseQuiz => ({
  id: crypto.randomUUID(),
  texte: '',
  correcte,
  explication: '',
})

const evenementNeuf = (): EvenementFrise => ({
  id: crypto.randomUUID(),
  libelle: '',
  annee: new Date().getFullYear(),
  detail: '',
})

const LEGENDE_MAX = 200

/**
 * Formulaire du bloc sélectionné. Défini hors du composant principal :
 * un composant défini pendant le rendu serait recréé à chaque frappe, et le
 * champ perdrait le focus à chaque lettre.
 */
function FormulaireBloc({
  def,
  valeur,
  resoudre,
  surChangement,
  surChoisirMedia,
}: {
  def: DefEmplacement
  valeur: ValeurEmplacement
  resoudre: ResoudreMedia
  surChangement: (transformation: (valeur: ValeurEmplacement) => ValeurEmplacement) => void
  surChoisirMedia: (type: 'image' | 'video') => void
}) {
  const conseil = def.conseil ? <p className="champ__conseil">{def.conseil}</p> : null

  if ((def.type === 'titre' || def.type === 'texte') && valeur.type === def.type) {
    const changerTexte = (texte: string) =>
      surChangement((v) => (v.type === def.type ? { ...v, valeur: texte } : v))

    return (
      <div className="pan__formulaire">
        <label className="champ">
          <span className="champ__libelle">{def.libelle}</span>
          {def.type === 'titre' ? (
            <input
              autoFocus
              maxLength={def.maxSignes}
              value={valeur.valeur}
              onChange={(evenement) => changerTexte(evenement.target.value)}
            />
          ) : (
            <textarea
              autoFocus
              rows={10}
              maxLength={def.maxSignes}
              value={valeur.valeur}
              onChange={(evenement) => changerTexte(evenement.target.value)}
            />
          )}
          <span className="champ__compte">
            {valeur.valeur.length} / {def.maxSignes}
          </span>
        </label>
        {def.type === 'texte' ? (
          <p className="champ__conseil">
            Mise en forme : **gras**, _italique_, listes commençant par «&nbsp;-&nbsp;».
          </p>
        ) : null}
        {conseil}
      </div>
    )
  }

  if ((def.type === 'image' || def.type === 'video') && valeur.type === def.type) {
    const resolu = resoudre(valeur.mediaId)
    const vignette =
      resolu === null ? '' : resolu.type === 'image' ? resolu.url('vignette') : (resolu.poster ?? '')

    return (
      <div className="pan__formulaire">
        {resolu ? (
          <div className="media-actuel">
            {vignette ? (
              <img className="media-actuel__vignette" src={vignette} alt="" draggable={false} />
            ) : (
              <span className="media-actuel__vignette media-actuel__vignette--absente">🎬</span>
            )}
            <span className="media-actuel__nom">{resolu.legende || valeur.mediaId}</span>
          </div>
        ) : (
          <p className="pan__aide">
            {def.type === 'image' ? 'Aucune photo choisie.' : 'Aucune vidéo choisie.'}
          </p>
        )}

        <div className="pan__actions">
          <button type="button" className="abtn" onClick={() => surChoisirMedia(def.type)}>
            {resolu ? 'Remplacer' : 'Choisir dans la bibliothèque'}
          </button>
          {resolu && !def.requis ? (
            <button
              type="button"
              className="abtn abtn--discret"
              onClick={() =>
                surChangement((v) =>
                  v.type === 'image' || v.type === 'video'
                    ? { ...v, mediaId: null, legende: '' }
                    : v,
                )
              }
            >
              Retirer
            </button>
          ) : null}
        </div>

        {resolu ? (
          <label className="champ">
            <span className="champ__libelle">Légende</span>
            <input
              maxLength={LEGENDE_MAX}
              value={valeur.legende}
              onChange={(evenement) =>
                surChangement((v) =>
                  v.type === 'image' || v.type === 'video'
                    ? { ...v, legende: evenement.target.value }
                    : v,
                )
              }
            />
          </label>
        ) : null}
        {conseil}
      </div>
    )
  }

  if (def.type === 'galerie' && valeur.type === 'galerie') {
    // Échange une photo avec sa voisine : l'ordre de la liste est celui du
    // diaporama sur la borne, il doit pouvoir se changer après coup.
    const deplacerPhoto = (index: number, sens: -1 | 1) =>
      surChangement((v) => {
        if (v.type !== 'galerie') return v
        const elements = [...v.elements]
        const photo = elements[index]
        const voisine = elements[index + sens]
        if (!photo || !voisine) return v
        elements[index] = voisine
        elements[index + sens] = photo
        return { ...v, elements }
      })

    return (
      <div className="pan__formulaire">
        {valeur.elements.length === 0 ? (
          <p className="pan__aide">Aucune photo dans la galerie.</p>
        ) : (
          <ul className="galerie-liste">
            {valeur.elements.map((element, index) => {
              const resolu = resoudre(element.mediaId)
              return (
                <li key={`${element.mediaId}-${index}`} className="galerie-el">
                  {resolu ? (
                    <img
                      className="galerie-el__vignette"
                      src={resolu.url('vignette')}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    <span className="galerie-el__vignette galerie-el__vignette--absente">?</span>
                  )}
                  <input
                    maxLength={LEGENDE_MAX}
                    value={element.legende}
                    placeholder="Légende"
                    onChange={(evenement) =>
                      surChangement((v) =>
                        v.type === 'galerie'
                          ? {
                              ...v,
                              elements: v.elements.map((el, i) =>
                                i === index ? { ...el, legende: evenement.target.value } : el,
                              ),
                            }
                          : v,
                      )
                    }
                  />
                  <button
                    type="button"
                    className="abtn abtn--mini"
                    aria-label="Monter cette photo"
                    disabled={index === 0}
                    onClick={() => deplacerPhoto(index, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--mini"
                    aria-label="Descendre cette photo"
                    disabled={index === valeur.elements.length - 1}
                    onClick={() => deplacerPhoto(index, 1)}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--discret"
                    aria-label="Retirer cette photo"
                    onClick={() =>
                      surChangement((v) =>
                        v.type === 'galerie'
                          ? { ...v, elements: v.elements.filter((_, i) => i !== index) }
                          : v,
                      )
                    }
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {valeur.elements.length < def.max ? (
          <button type="button" className="abtn" onClick={() => surChoisirMedia('image')}>
            + Ajouter une photo
          </button>
        ) : (
          <p className="pan__aide">Cette galerie est pleine ({def.max} photos au maximum).</p>
        )}
        {conseil}
      </div>
    )
  }

  if (def.type === 'quiz' && valeur.type === 'quiz') {
    return (
      <FormulaireQuiz def={def} valeur={valeur} surChangement={surChangement} conseil={conseil} />
    )
  }

  if (def.type === 'frise' && valeur.type === 'frise') {
    return (
      <FormulaireFrise def={def} valeur={valeur} surChangement={surChangement} conseil={conseil} />
    )
  }

  return null
}

/**
 * Formulaire du quiz.
 *
 * Une réponse tient sur une ligne : son texte, la case « bonne réponse », et
 * l'explication lue par le visiteur après son choix. Rien à numéroter, rien à
 * ordonner — l'ordre d'affichage est celui de la saisie.
 */
function FormulaireQuiz({
  def,
  valeur,
  surChangement,
  conseil,
}: {
  def: Extract<DefEmplacement, { type: 'quiz' }>
  valeur: Extract<ValeurEmplacement, { type: 'quiz' }>
  surChangement: (transformation: (valeur: ValeurEmplacement) => ValeurEmplacement) => void
  conseil: ReactNode
}) {
  const modifier = (transformation: (quiz: ValeurQuiz) => ValeurQuiz) =>
    surChangement((v) => (v.type === 'quiz' ? transformation(v) : v))

  const changerReponse = (id: string, champs: Partial<ReponseQuiz>) =>
    modifier((quiz) => ({
      ...quiz,
      reponses: quiz.reponses.map((reponse) =>
        reponse.id === id ? { ...reponse, ...champs } : reponse,
      ),
    }))

  return (
    <div className="pan__formulaire">
      <label className="champ">
        <span className="champ__libelle">Question</span>
        <textarea
          autoFocus
          rows={2}
          maxLength={QUIZ_QUESTION_MAX_SIGNES}
          value={valeur.question}
          onChange={(champ) => modifier((quiz) => ({ ...quiz, question: champ.target.value }))}
        />
        <span className="champ__compte">
          {valeur.question.length} / {QUIZ_QUESTION_MAX_SIGNES}
        </span>
      </label>

      <ul className="atelier-liste">
        {valeur.reponses.map((reponse, index) => (
          <li key={reponse.id} className="atelier-ligne">
            <div className="atelier-ligne__entete">
              <span className="atelier-ligne__rang">Réponse {index + 1}</span>
              <label className="atelier-ligne__juste">
                <input
                  type="checkbox"
                  checked={reponse.correcte}
                  onChange={(champ) =>
                    changerReponse(reponse.id, { correcte: champ.target.checked })
                  }
                />
                bonne réponse
              </label>
              {valeur.reponses.length > def.minReponses ? (
                <button
                  type="button"
                  className="atelier-ligne__retirer"
                  aria-label={`Retirer la réponse ${index + 1}`}
                  onClick={() =>
                    modifier((quiz) => ({
                      ...quiz,
                      reponses: quiz.reponses.filter((autre) => autre.id !== reponse.id),
                    }))
                  }
                >
                  ✕
                </button>
              ) : null}
            </div>
            <input
              placeholder="Texte de la réponse"
              maxLength={QUIZ_REPONSE_MAX_SIGNES}
              value={reponse.texte}
              onChange={(champ) => changerReponse(reponse.id, { texte: champ.target.value })}
            />
            <textarea
              rows={2}
              placeholder="Explication montrée au visiteur après son choix"
              maxLength={QUIZ_EXPLICATION_MAX_SIGNES}
              value={reponse.explication}
              onChange={(champ) => changerReponse(reponse.id, { explication: champ.target.value })}
            />
          </li>
        ))}
      </ul>

      {valeur.reponses.length < def.maxReponses ? (
        <button
          type="button"
          className="abtn"
          onClick={() =>
            modifier((quiz) => ({ ...quiz, reponses: [...quiz.reponses, reponseNeuve(false)] }))
          }
        >
          + Ajouter une réponse
        </button>
      ) : (
        <p className="pan__aide">Ce quiz est complet ({def.maxReponses} réponses au maximum).</p>
      )}
      {conseil}
    </div>
  )
}

/**
 * Formulaire de la frise.
 *
 * On saisit un événement et son année ; l'ordre attendu s'en déduit. Les lignes
 * peuvent donc être saisies dans n'importe quel ordre — c'est voulu : on ajoute
 * un événement oublié sans rien réorganiser.
 */
function FormulaireFrise({
  def,
  valeur,
  surChangement,
  conseil,
}: {
  def: Extract<DefEmplacement, { type: 'frise' }>
  valeur: Extract<ValeurEmplacement, { type: 'frise' }>
  surChangement: (transformation: (valeur: ValeurEmplacement) => ValeurEmplacement) => void
  conseil: ReactNode
}) {
  const modifier = (transformation: (frise: ValeurFrise) => ValeurFrise) =>
    surChangement((v) => (v.type === 'frise' ? transformation(v) : v))

  const changerEvenement = (id: string, champs: Partial<EvenementFrise>) =>
    modifier((frise) => ({
      ...frise,
      evenements: frise.evenements.map((evenement) =>
        evenement.id === id ? { ...evenement, ...champs } : evenement,
      ),
    }))

  // Aperçu de l'ordre attendu : le personnel vérifie d'un coup d'œil que les
  // années donnent bien la chronologie qu'il a en tête.
  const ordonnes = [...valeur.evenements]
    .filter((evenement) => evenement.libelle.trim() !== '')
    .sort((a, b) => a.annee - b.annee)

  return (
    <div className="pan__formulaire">
      <label className="champ">
        <span className="champ__libelle">Consigne</span>
        <input
          autoFocus
          placeholder="Replacez ces événements du plus ancien au plus récent."
          maxLength={FRISE_CONSIGNE_MAX_SIGNES}
          value={valeur.consigne}
          onChange={(champ) => modifier((frise) => ({ ...frise, consigne: champ.target.value }))}
        />
      </label>

      <ul className="atelier-liste">
        {valeur.evenements.map((evenement, index) => (
          <li key={evenement.id} className="atelier-ligne">
            <div className="atelier-ligne__entete">
              <span className="atelier-ligne__rang">Événement {index + 1}</span>
              <label className="atelier-ligne__annee">
                année
                <input
                  type="number"
                  min={-3000}
                  max={3000}
                  value={evenement.annee}
                  onChange={(champ) =>
                    changerEvenement(evenement.id, {
                      annee: Number.parseInt(champ.target.value, 10) || 0,
                    })
                  }
                />
              </label>
              {valeur.evenements.length > def.minEvenements ? (
                <button
                  type="button"
                  className="atelier-ligne__retirer"
                  aria-label={`Retirer l'événement ${index + 1}`}
                  onClick={() =>
                    modifier((frise) => ({
                      ...frise,
                      evenements: frise.evenements.filter((autre) => autre.id !== evenement.id),
                    }))
                  }
                >
                  ✕
                </button>
              ) : null}
            </div>
            <input
              placeholder="Événement (ce que le visiteur doit replacer)"
              maxLength={FRISE_LIBELLE_MAX_SIGNES}
              value={evenement.libelle}
              onChange={(champ) => changerEvenement(evenement.id, { libelle: champ.target.value })}
            />
            <input
              placeholder="Précision révélée à la correction (facultatif)"
              maxLength={FRISE_DETAIL_MAX_SIGNES}
              value={evenement.detail}
              onChange={(champ) => changerEvenement(evenement.id, { detail: champ.target.value })}
            />
          </li>
        ))}
      </ul>

      {valeur.evenements.length < def.maxEvenements ? (
        <button
          type="button"
          className="abtn"
          onClick={() =>
            modifier((frise) => ({ ...frise, evenements: [...frise.evenements, evenementNeuf()] }))
          }
        >
          + Ajouter un événement
        </button>
      ) : (
        <p className="pan__aide">
          Cette frise est complète ({def.maxEvenements} événements au maximum).
        </p>
      )}

      {ordonnes.length > 1 ? (
        <div className="atelier-ordre">
          <p className="champ__conseil">Ordre attendu, déduit des années :</p>
          <ol>
            {ordonnes.map((evenement) => (
              <li key={evenement.id}>
                <strong>{evenement.annee}</strong> — {evenement.libelle}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {conseil}
    </div>
  )
}

/** Choix d'un média dans la bibliothèque du contenu. */
function SelecteurMedia({
  type,
  manifeste,
  resoudre,
  surChoix,
  surImporter,
  surFermeture,
}: {
  type: 'image' | 'video'
  manifeste: Manifeste
  resoudre: ResoudreMedia
  surChoix: (media: MediaManifeste) => void
  surImporter: () => void
  surFermeture: () => void
}) {
  const disponibles = manifeste.medias.filter((media) => media.type === type)

  return (
    <div className="voile" role="dialog" aria-modal="true" aria-label="Bibliothèque des médias">
      <div className="voile__boite">
        <h2 className="voile__titre">
          {type === 'image' ? 'Choisir une photo' : 'Choisir une vidéo'}
        </h2>

        <div className="pan__actions">
          <button type="button" className="abtn abtn--principal" onClick={surImporter}>
            Importer depuis l'ordinateur…
          </button>
        </div>

        {disponibles.length === 0 ? (
          <p className="pan__aide">
            La bibliothèque ne contient encore aucun média de ce type — importez-en un depuis
            l'ordinateur.
          </p>
        ) : (
          <ul className="medias-grille">
            {disponibles.map((media) => {
              const resolu = resoudre(media.id)
              const vignette =
                resolu === null
                  ? ''
                  : resolu.type === 'image'
                    ? resolu.url('vignette')
                    : (resolu.poster ?? '')
              return (
                <li key={media.id}>
                  <button type="button" className="media-carte" onClick={() => surChoix(media)}>
                    {vignette ? (
                      <img className="media-carte__image" src={vignette} alt="" draggable={false} />
                    ) : (
                      <span className="media-carte__image media-carte__image--absente">🎬</span>
                    )}
                    <span className="media-carte__nom">{media.legende || media.id}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="pan__actions">
          <button type="button" className="abtn abtn--discret" onClick={surFermeture}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
