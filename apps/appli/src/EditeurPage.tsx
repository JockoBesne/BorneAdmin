import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  COLONNES_GRILLE,
  COLONNES_MIN,
  DECALAGE_MAX,
  HAUTEUR_MAX,
  HAUTEUR_MIN,
  colonnesDe,
  colonnesEmplacement,
  colonnesPourPhoto,
  decalageDe,
  decalageEmplacement,
  estRecadre,
  LARGEUR_TOILE,
  ordreCellules,
  controlerContenu,
  DEFS_BLOCS_LIBRES,
  estAncreBas,
  estStyleVide,
  lignesDeTexte,
  lireStyle,
  lireSuite,
  modelePar,
  sansMiseEnForme,
  texteBrut,
  HAUTEUR_BANDEAU_DEFAUT,
  HAUTEUR_BANDEAU_MAX,
  HAUTEUR_BANDEAU_MIN,
  FRISE_CONSIGNE_MAX_SIGNES,
  FRISE_DETAIL_MAX_SIGNES,
  FRISE_LIBELLE_MAX_SIGNES,
  QUIZ_EXPLICATION_MAX_SIGNES,
  QUIZ_QUESTION_MAX_SIGNES,
  QUIZ_REPONSE_MAX_SIGNES,
  PAS_TAILLE_TEXTE,
  TAILLE_TEXTE_MAX,
  TAILLE_TEXTE_MIN,
  type BlocLibre,
  type ContenuPage,
  type DefEmplacement,
  type EvenementFrise,
  type InfoMedia,
  type Manifeste,
  type MediaManifeste,
  type PageManifeste,
  type AlignementBloc,
  type LigneTexte,
  type ReponseQuiz,
  type StyleBloc,
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
import { ChampTexteRiche, type CommandesTexteRiche } from './ChampTexteRiche.jsx'
import { importerMedias, resolveurMedias } from './contenu.js'
import {
  BANDEAU_DEFAUT,
  couleursEffectives,
  stylesCouleurs,
  surFondLisible,
  type Couleurs,
} from './couleurs.js'
import { RoueCouleur } from './RoueCouleur.jsx'
import { BoutonFermer } from './Voile.jsx'

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
  generation,
  surModification,
  surAjoutMedia,
  surRetraitMedia,
}: {
  manifeste: Manifeste
  page: PageManifeste
  /**
   * Change à chaque « Annuler » / « Rétablir ». Le champ de texte enrichi ne
   * relit son contenu qu'au montage : ce compteur entre dans sa clé, ce qui le
   * remonte à neuf — sans lui, un texte annulé resterait affiché.
   */
  generation: number
  surModification: (transformation: (page: PageManifeste) => PageManifeste) => void
  surAjoutMedia: (media: MediaManifeste) => void
  /**
   * Retire un média de la bibliothèque. Le fichier reste dans « medias/ » :
   * « Annuler » (Ctrl + Z) doit pouvoir remettre le média, ce qu'un fichier
   * effacé rendrait impossible.
   */
  surRetraitMedia: (id: string) => void
}) {
  const [selection, setSelection] = useState<string | null>(null)
  const [selecteur, setSelecteur] = useState<{ nom: string; type: 'image' | 'video' } | null>(null)
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [retraitEnCours, setRetraitEnCours] = useState<string | null>(null)
  const [couleursOuvertes, setCouleursOuvertes] = useState(false)
  // Glisser-déposer sur l'aperçu : bloc en cours de déplacement, et endroit visé.
  const [glisseId, setGlisseId] = useState<string | null>(null)
  // Une seule déclaration de la forme d'un dépôt, plus bas (« type Depot ») :
  // en la répétant ici, les deux finissaient par ne plus dire la même chose.
  const [depot, setDepot] = useState<Depot | null>(null)

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

  // L'ajout et le retrait d'un bloc ont déménagé plus bas, avec le
  // glisser-déposer : « ajouterBloc » sait désormais poser le bloc à l'endroit
  // visé, et « retirerCellule » retire aussi bien un bloc ajouté qu'un
  // emplacement du modèle.

  // ── Habillage d'un bloc : fond, mise en forme du texte ─────────────────────

  const modifierStyle = (
    nom: string,
    transformation: (style: StyleBloc) => StyleBloc,
  ) => {
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage
      const styles = { ...(contenuPage.styles ?? {}) }
      const nouveau = transformation(styles[nom] ?? {})
      // Un habillage remis à zéro est retiré, pas gardé vide : une page qu'on
      // repersonnalise puis remet comme avant retrouve son contenu d'origine.
      if (estStyleVide(nouveau)) delete styles[nom]
      else styles[nom] = nouveau
      return { ...precedente, contenu: sansStylesVides({ ...contenuPage, styles }) }
    })
  }

  // ── Couleurs propres à la page ─────────────────────────────────────────────

  const changerCouleurPage = (
    champ: 'couleurFond' | 'couleurTexte' | 'couleurBandeau' | 'couleurBandeauTexte',
    hex: string,
  ) => surModification((p) => ({ ...p, [champ]: hex }))

  // Hauteur du bandeau. Une saisie vide ou illisible ne change rien : on ne
  // remplace pas un réglage par « 0 » pendant que l'utilisateur efface le champ.
  const changerHauteurBandeau = (saisie: string) =>
    surModification((p) => {
      const pixels = Number.parseInt(saisie, 10)
      if (!Number.isFinite(pixels)) return p
      return {
        ...p,
        hauteurBandeau: Math.min(HAUTEUR_BANDEAU_MAX, Math.max(HAUTEUR_BANDEAU_MIN, pixels)),
      }
    })

  const masquerBandeau = (actif: boolean) =>
    surModification((p) => ({ ...p, bandeauMasque: actif || undefined }))

  // Revenir au thème global : on retire les couleurs propres à la page.
  const suivreThemeGlobal = () =>
    surModification((p) => {
      const copie = { ...p }
      delete copie.couleurFond
      delete copie.couleurTexte
      delete copie.couleurBandeau
      delete copie.couleurBandeauTexte
      delete copie.hauteurBandeau
      delete copie.bandeauMasque
      return copie
    })

  const couleursPage = couleursEffectives(manifeste.reglages, page)

  // Couleur du texte du bandeau telle que la borne l'affichera : celle qu'on a
  // choisie, ou celle qu'elle calcule d'après le fond.
  const texteBandeau =
    page.couleurBandeauTexte ?? surFondLisible(page.couleurBandeau ?? BANDEAU_DEFAUT)
  const pagePersonnalisee =
    page.couleurFond !== undefined ||
    page.couleurTexte !== undefined ||
    page.couleurBandeau !== undefined ||
    page.couleurBandeauTexte !== undefined ||
    page.hauteurBandeau !== undefined ||
    page.bandeauMasque !== undefined

  // Règle la largeur d'un bloc, en colonnes sur la grille de 12. Appelé par la
  // poignée de l'aperçu (glissement) comme par le bouton du panneau (clavier).
  const redimensionnerBloc = (cle: string, colonnes: number) => {
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage
      // Un bloc ajouté porte sa largeur ; un emplacement du modèle la range dans
      // « largeurs », parce qu'on ne réécrit pas la déclaration du modèle.
      // « avecLargeur » connaît cette différence, et laisse l'ancien champ
      // « largeur » en place — un contenu ouvert avec une version précédente de
      // l'application ne perd pas tout.
      //
      // Le décalage du bloc mange sa largeur possible : les deux tiennent
      // toujours sur les 12 colonnes.
      const plafond = COLONNES_GRILLE - decalageDeCle(contenuPage, cle)
      const largeur = Math.min(plafond, Math.max(COLONNES_MIN, Math.round(colonnes)))
      return { ...precedente, contenu: avecLargeur(contenuPage, cle, largeur) }
    })
  }

  /**
   * Coche / décoche « Recadrer la photo ».
   *
   * En cochant, on donne au cadre **la hauteur qu'occupe déjà la photo** : rien
   * ne bouge à l'écran, la photo n'est pas coupée, et les poignées de hauteur
   * apparaissent pour la réduire. C'est ce qui rend le réglage sans danger — un
   * réglage qui recadre au moment où on le coche serait une mauvaise surprise.
   * En décochant, la photo redevient entière (la hauteur est simplement ignorée).
   */
  const basculerRecadrage = (nom: string, actif: boolean) => {
    // Mesuré avant toute modification, sur la photo elle-même : l'aperçu est
    // réduit, on repasse donc en pixels de toile.
    const zone = document
      .querySelector(`.edit__apercu .emp[data-nom="${nom}"] .b-image__zone`)
      ?.getBoundingClientRect()
    const page = document.querySelector('.edit__apercu .mdl')?.getBoundingClientRect()
    const echelle = page && page.width > 0 ? page.width / LARGEUR_TOILE : 0

    modifierStyle(nom, (style) => {
      if (actif) return { ...style, recadre: true }
      const copie = { ...style }
      delete copie.recadre
      return copie
    })

    if (actif && zone && echelle > 0) redimensionnerHauteur(nom, zone.height / echelle)
  }

  /** Pose ou retire l'ancre basse d'un bloc, sans toucher au reste de son habillage. */
  const avecAncre = (contenuPage: ContenuPage, cle: string, ancre?: 'bas'): ContenuPage => {
    if (estAncreBas(contenuPage, cle) === (ancre === 'bas')) return contenuPage
    const styles = { ...(contenuPage.styles ?? {}) }
    const style = { ...(styles[cle] ?? {}) }
    if (ancre === 'bas') style.ancre = 'bas'
    else delete style.ancre
    if (estStyleVide(style)) delete styles[cle]
    else styles[cle] = style
    return { ...contenuPage, styles }
  }

  /**
   * Hauteur d'un bloc, en pixels de toile.
   *
   * L'ancre vient de la poignée employée : celle du haut retient le bas du bloc
   * (`ancre: 'bas'`), celle du bas remet l'ancrage ordinaire. Les deux sont
   * écrites dans le **même** pas de modification que la hauteur — sinon annuler
   * un glissement laisserait l'ancre derrière lui.
   */
  const redimensionnerHauteur = (cle: string, hauteur: number, ancre?: 'bas') => {
    const borne = Math.min(HAUTEUR_MAX, Math.max(HAUTEUR_MIN, Math.round(hauteur)))
    surModification((precedente) => {
      const contenuPage = avecAncre(precedente.contenu as ContenuPage, cle, ancre)

      if (cle.startsWith('suite:')) {
        const id = cle.slice('suite:'.length)
        return {
          ...precedente,
          contenu: {
            ...contenuPage,
            suite: lireSuite(contenuPage).map((bloc) =>
              bloc.id === id ? { ...bloc, hauteur: borne } : bloc,
            ),
          },
        }
      }

      return {
        ...precedente,
        contenu: {
          ...contenuPage,
          hauteurs: { ...(contenuPage.hauteurs ?? {}), [cle]: borne },
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


  /**
   * Range les médias dans le bloc. Une galerie les prend **tous** ; une image
   * ou une vidéo n'en accueille qu'un — les autres restent en bibliothèque.
   */
  const choisirMedias = (nom: string, medias: MediaManifeste[]) => {
    modifierEmplacement(nom, (valeur) => {
      if (valeur.type === 'galerie') {
        return {
          ...valeur,
          elements: [
            ...valeur.elements,
            ...medias.map((media) => ({ mediaId: media.id, legende: media.legende })),
          ],
        }
      }
      const media = medias[0]
      if (media && (valeur.type === 'image' || valeur.type === 'video')) {
        return { ...valeur, mediaId: media.id, legende: valeur.legende || media.legende }
      }
      return valeur
    })

    // Le bloc s'adapte à la photo qu'on vient de lui donner : sa largeur est
    // réduite juste assez pour que la photo ne fasse pas deux écrans de haut.
    // On ne touche pas à la photo, qui reste entière — c'est le bloc qui cède.
    // Une photo recadrée est déjà tenue par la hauteur de son cadre : rien à
    // faire pour elle.
    const photo = medias[0]
    if (photo && defPour(nom)?.type === 'image' && !estRecadre(contenu, nom)) {
      const actuelles = colonnesDeCle(contenu, nom)
      const voulues = colonnesPourPhoto(photo.largeur, photo.hauteur, actuelles)
      if (voulues !== actuelles) redimensionnerBloc(nom, voulues)
    }

    setSelecteur(null)
  }

  const choisirMedia = (nom: string, media: MediaManifeste) => choisirMedias(nom, [media])

  // Import depuis l'ordinateur : les fichiers sont copiés dans la bibliothèque,
  // puis placés directement dans le bloc qui a ouvert le sélecteur.
  const importerDepuisDisque = () => {
    if (!selecteur) return
    const { nom, type } = selecteur
    void importerMedias(type).then((medias) => {
      if (medias.length === 0) return
      for (const media of medias) surAjoutMedia(media)
      choisirMedias(nom, medias)
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

  /**
   * Où le bloc va tomber, tel que le pointeur le désigne.
   *
   * « decalage » et « largeur » ne sont renseignés que pour un dépôt dans le
   * vide d'une rangée : la place visée y est mesurée sur la grille au moment du
   * geste, donc le bloc atterrit exactement là où on l'a lâché.
   */
  type Depot = {
    cle: string
    ou: 'avant' | 'apres' | 'gauche' | 'droite'
    decalage?: number
    largeur?: number
    /**
     * Emplacement exact où le bloc va se poser, en pixels d'écran — dessiné en
     * cadre pointillé pendant le geste. Renseigné pour les dépôts dans le vide,
     * où éclairer un bloc voisin serait trompeur : ce n'est pas contre lui que
     * le bloc vient se coller, il y a un espace entre les deux.
     */
    fantome?: { gauche: number; haut: number; largeur: number; hauteur: number }
  }

  /** Un cadre de l'aperçu de dépôt, en pixels d'écran. */
  type CadreApercu = {
    cle: string
    gauche: number
    haut: number
    largeur: number
    hauteur: number
  }

  const depart = useRef<{
    x: number
    y: number
    id: string
    actif: boolean
    /** Le bloc de l'aperçu qu'on tient, s'il y en a un : il suit le doigt. */
    element: HTMLElement | null
    /** Mise à l'échelle de la toile, pour traduire les pixels d'écran. */
    echelle: number
    /**
     * Hauteur du bloc au repos, en pixels d'écran, relevée **avant** qu'il ne
     * soit réduit pour être porté : une fois la transformation posée, sa boîte
     * mesurée ne vaut plus que 45 % et les cadres seraient tout plats.
     */
    hauteur: number
  } | null>(null)

  /**
   * Facteur de « zoom » subi par un élément de la toile. Un déplacement de 10
   * pixels d'écran vaut 10 / echelle pixels **dans** la toile : sans cette
   * division, le bloc traînerait derrière le doigt.
   *
   * Chromium le donne directement (« currentCSSZoom ») depuis la version 128 ;
   * avant, on le mesure — la boîte englobante est zoomée, « offsetWidth » ne
   * l'est pas.
   */
  const echelleDe = (element: HTMLElement): number => {
    const donne = (element as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom
    if (donne && donne > 0) return donne
    const mesure = element.getBoundingClientRect().width / (element.offsetWidth || 1)
    return mesure > 0 ? mesure : 1
  }

  /**
   * Taille du bloc pendant qu'on le porte. À l'échelle 1, un bloc pleine largeur
   * recouvrait la moitié de la page : on ne voyait plus ni les blocs voisins ni
   * les cadres qui annoncent le résultat — c'est le reproche qui a été fait au
   * geste. Réduit, il se lit comme ce qu'il est : l'objet qu'on tient en main,
   * pas la page. La place réelle, elle, est donnée par les cadres.
   */
  const ECHELLE_PORTE = 0.45

  /** Rend au bloc suivi sa place : fin du geste, ou abandon. */
  const relacherBlocSuivi = () => {
    const element = depart.current?.element
    if (!element) return
    element.style.transform = ''
    element.style.transformOrigin = ''
    element.style.willChange = ''
  }

  /**
   * Deux dépôts qui désignent la même place. Sans cette comparaison, chaque
   * mouvement du pointeur remplacerait l'état par un objet **équivalent** et
   * redessinerait tout l'éditeur — cinquante fois par seconde pour rien.
   */
  const memeDepot = (a: Depot | null, b: Depot | null): boolean => {
    if (a === b) return true
    if (!a || !b) return false
    return (
      a.cle === b.cle &&
      a.ou === b.ou &&
      a.decalage === b.decalage &&
      a.largeur === b.largeur &&
      a.fantome?.gauche === b.fantome?.gauche &&
      a.fantome?.haut === b.fantome?.haut &&
      a.fantome?.largeur === b.fantome?.largeur &&
      a.fantome?.hauteur === b.fantome?.hauteur
    )
  }

  /** Change la place visée, mais **seulement** si elle a vraiment changé. */
  const viser = (nouveau: Depot | null) =>
    setDepot((precedent) => (memeDepot(precedent, nouveau) ? precedent : nouveau))
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
      if (toile.scrollTop !== avant) viser(depotDepuisPoint(point.x, point.y, glisse.id))
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
    // « elementsFromPoint » au pluriel : le bloc qu'on tient suit le doigt, il
    // est donc en permanence sous le pointeur. On regarde **à travers** lui,
    // sinon plus aucune cible ne serait jamais atteinte.
    const dessous = document.elementsFromPoint(x, y) as HTMLElement[]
    const emplacement = dessous
      .map((element) => element.closest('.emp[data-nom]') as HTMLElement | null)
      .find(
        (candidat): candidat is HTMLElement =>
          candidat !== null && candidat.dataset['nom'] !== cleGlisse,
      )
    const cle = emplacement?.dataset['nom']
    // Le pointeur ne vise aucun bloc : peut-être le vide laissé à droite d'une
    // rangée. On s'y pose plutôt que de ne rien faire.
    if (!emplacement || !cle) {
      return dessous.some((element) => element.closest('.mdl'))
        ? depotDansLeVide(x, y, cleGlisse)
        : null
    }

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

  /** Décalage actuel d'une cellule : les colonnes vides à sa gauche. */
  const decalageDeCle = (contenuPage: ContenuPage, cle: string): number => {
    if (cle.startsWith('suite:')) {
      const bloc = lireSuite(contenuPage).find((candidat) => `suite:${candidat.id}` === cle)
      return bloc ? decalageDe(bloc) : 0
    }
    return decalageEmplacement(contenuPage, cle, colonnesDeCle(contenuPage, cle))
  }

  /**
   * Place qu'une cellule prend sur sa rangée : son décalage **et** sa largeur.
   * C'est cette mesure qui dit qui tient sur la même rangée que qui.
   */
  const occupeDeCle = (contenuPage: ContenuPage, cle: string): number =>
    decalageDeCle(contenuPage, cle) + colonnesDeCle(contenuPage, cle)

  /** Fixe le décalage d'une cellule. Zéro efface le réglage plutôt que l'écrire. */
  const avecDecalage = (contenuPage: ContenuPage, cle: string, decalage: number): ContenuPage => {
    const borne = Math.max(0, Math.min(DECALAGE_MAX, Math.round(decalage)))
    if (cle.startsWith('suite:')) {
      const id = cle.slice('suite:'.length)
      return {
        ...contenuPage,
        suite: lireSuite(contenuPage).map((bloc) => {
          if (bloc.id !== id) return bloc
          if (borne === 0) {
            const { decalage: _retire, ...sansDecalage } = bloc
            return sansDecalage
          }
          return { ...bloc, decalage: borne }
        }),
      }
    }
    if (borne === 0) {
      // Le rangement disparaît quand il devient vide : une page dont plus aucun
      // bloc n'est décalé retrouve exactement le fichier qu'elle avait avant.
      const restant = sansEntree(contenuPage.decalages, cle)
      return {
        ...contenuPage,
        decalages: Object.keys(restant).length > 0 ? restant : undefined,
      }
    }
    return { ...contenuPage, decalages: { ...(contenuPage.decalages ?? {}), [cle]: borne } }
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
  const rangeesDeCles = (contenuPage: ContenuPage, cles: string[]): string[][] => {
    const rangees: string[][] = []
    let reste = 0
    for (const cle of cles) {
      const occupe = occupeDeCle(contenuPage, cle)
      const derniere = rangees[rangees.length - 1]
      if (derniere && occupe <= reste) {
        derniere.push(cle)
        reste -= occupe
      } else {
        rangees.push([cle])
        reste = COLONNES_GRILLE - occupe
      }
    }
    return rangees
  }

  const rangeesDe = (contenuPage: ContenuPage): string[][] =>
    rangeesDeCles(contenuPage, ordreCellules(contenuPage, modele))

  /** Colonnes restées libres à droite d'une rangée, sur les 12 de la grille. */
  const libreDeRangee = (contenuPage: ContenuPage, rangee: string[]): number =>
    COLONNES_GRILLE - rangee.reduce((total, cle) => total + occupeDeCle(contenuPage, cle), 0)

  /**
   * Dépôt dans l'espace resté libre à droite d'une rangée.
   *
   * Le pointeur ne vise alors aucun bloc : on cherche la rangée qui se trouve à
   * cette hauteur, et le bloc s'y pose **à la colonne visée**, à la suite des
   * blocs déjà là et sans toucher à leurs largeurs. Les colonnes sautées
   * deviennent un vide — c'est tout l'intérêt : on pousse un bloc vers la
   * droite au lieu de tout redistribuer.
   *
   * La rangée où se trouve déjà le bloc glissé compte comme les autres : c'est
   * ainsi qu'on écarte deux photos côte à côte sans les déplacer ailleurs.
   *
   * Rien n'est proposé si la rangée n'a plus la place minimale d'un bloc : il
   * passerait à la ligne, ce que le geste n'annonce pas.
   */
  const depotDansLeVide = (x: number, y: number, cleGlisse: string): Depot | null => {
    const grille = document.querySelector('.edit__apercu .mdl__grille')
    if (!grille) return null
    const cadreGrille = grille.getBoundingClientRect()
    const echelleGrille = echelleDe(grille as HTMLElement)
    const pas = cadreGrille.width / COLONNES_GRILLE
    if (pas <= 0) return null

    for (const rangee of rangeesDe(contenu)) {
      const cadres = rangee
        .map((cle) =>
          document.querySelector(`.edit__apercu .emp[data-nom="${cle}"]`)?.getBoundingClientRect(),
        )
        .filter((cadre): cadre is DOMRect => cadre !== undefined)
      if (cadres.length === 0) continue
      const haut = Math.min(...cadres.map((cadre) => cadre.top))
      const bas = Math.max(...cadres.map((cadre) => cadre.bottom))
      if (y < haut || y > bas) continue

      // Les blocs de la rangée, le glissé mis à part : c'est après eux qu'on se
      // pose, et c'est leur total qui dit où commence le vide.
      const restants = rangee.filter((cle) => cle !== cleGlisse)
      // Rangée où le bloc glissé est seul : il se pousse **lui-même**, l'ordre
      // de la page ne change pas. Sans ce cas, viser le vide à droite d'un bloc
      // isolé ne ferait rien du tout.
      const dernier = restants[restants.length - 1] ?? cleGlisse
      const occupe = restants.reduce((total, cle) => total + occupeDeCle(contenu, cle), 0)
      if (COLONNES_GRILLE - occupe < COLONNES_MIN) return null
      // Le pointeur doit être dans le vide, pas sur les blocs.
      if (x <= cadreGrille.left + occupe * pas) continue

      // Colonne visée, aimantée sur la grille, puis bornée : jamais avant le
      // vide, et toujours assez de place pour afficher le bloc.
      const debut = Math.min(
        COLONNES_GRILLE - COLONNES_MIN,
        Math.max(occupe, Math.floor((x - cadreGrille.left) / pas)),
      )
      const largeur = Math.min(
        colonnesDeCle(contenu, cleGlisse),
        COLONNES_GRILLE - debut,
      )

      // Le cadre pointillé, aux vraies dimensions de la place visée. La
      // gouttière est relue sur la grille plutôt que réécrite ici : les deux ne
      // peuvent donc pas se contredire. « pas » ne suffirait pas — il vaut une
      // colonne **plus sa part de gouttière**, ce qui décalerait le cadre.
      // « columnGap » est lu en pixels **de toile**, la boîte englobante est en
      // pixels **d'écran** : sans la remise à l'échelle, les deux mesures ne
      // parlent pas de la même chose et le cadre tombe une dizaine de pixels
      // trop à gauche, trop étroit.
      const gouttiere = (parseFloat(getComputedStyle(grille).columnGap) || 0) * echelleGrille
      const colonne = Math.max(
        0,
        (cadreGrille.width - (COLONNES_GRILLE - 1) * gouttiere) / COLONNES_GRILLE,
      )

      return {
        cle: dernier,
        ou: 'droite',
        decalage: debut - occupe,
        largeur,
        fantome: {
          gauche: cadreGrille.left + debut * (colonne + gouttiere),
          haut,
          largeur: largeur * colonne + (largeur - 1) * gouttiere,
          // La hauteur du bloc qu'on tient, relevée à la saisie — pas celle de
          // la rangée : le cadre doit avoir la taille du bloc annoncé.
          hauteur: depart.current?.hauteur || bas - haut,
        },
      }
    }
    return null
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
      // Toute la largeur **restante** : un bloc poussé vers la droite garde son
      // espace, il s'élargit seulement jusqu'au bord de la page.
      const pleine = COLONNES_GRILLE - decalageDeCle(resultat, cle)
      if (colonnesDeCle(resultat, cle) < pleine) {
        resultat = avecLargeur(resultat, cle, pleine)
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

    // Le bloc se pousse lui-même dans le vide de sa propre rangée : rien ne
    // change dans l'ordre de la page, seule sa place sur la rangée bouge.
    if (depot.cle === cleGlisse) {
      if (depot.decalage === undefined || depot.largeur === undefined) return null
      return avecLargeur(
        avecDecalage(contenuPage, cleGlisse, depot.decalage),
        cleGlisse,
        depot.largeur,
      )
    }

    // Place libre sur la rangée du voisin, mesurée **avant** l'insertion — et
    // sur cette liste-ci, d'où le bloc glissé est absent.
    const rangeeVoisine = rangeesDeCles(contenuPage, reste).find((rangee) =>
      rangee.includes(depot.cle),
    )
    const libre = rangeeVoisine ? libreDeRangee(contenuPage, rangeeVoisine) : 0

    let vers = reste.indexOf(depot.cle)
    if (vers < 0) return null
    if (depot.ou === 'apres' || depot.ou === 'droite') vers += 1
    reste.splice(vers, 0, cleGlisse)

    let resultat: ContenuPage = { ...contenuPage, ordre: reste }

    // Dépôt dans le vide d'une rangée : la place a été mesurée sur la grille au
    // moment du geste (voir `depotDansLeVide`), on l'applique telle quelle.
    if (depot.decalage !== undefined && depot.largeur !== undefined) {
      resultat = avecDecalage(resultat, cleGlisse, depot.decalage)
      return avecLargeur(resultat, cleGlisse, depot.largeur)
    }

    // Tout autre dépôt remet le bloc au contact de son voisin : c'est ainsi
    // qu'on **supprime** un espace qu'on ne veut plus.
    resultat = avecDecalage(resultat, cleGlisse, 0)

    if (depot.ou === 'gauche' || depot.ou === 'droite') {
      if (libre >= COLONNES_MIN) {
        // Il reste de la place sur la rangée : le bloc s'y glisse **tel quel**
        // (au plus la place disponible) et personne d'autre ne bouge. C'est ce
        // qui permet de remplir un espace libre, quitte à en laisser un peu.
        resultat = avecLargeur(
          resultat,
          cleGlisse,
          Math.min(colonnesDeCle(contenuPage, cleGlisse), libre),
        )
      } else {
        // Rangée pleine : les deux cellules doivent tenir sur les mêmes 12
        // colonnes. Si le voisin est trop large pour laisser la place minimale,
        // on partage en deux moitiés ; sinon il garde sa largeur et l'autre
        // prend le reste.
        const largeurVoisin = colonnesDeCle(resultat, depot.cle)
        const partage = largeurVoisin > COLONNES_GRILLE - COLONNES_MIN
        const colonnesVoisin = partage ? COLONNES_GRILLE / 2 : largeurVoisin
        resultat = avecLargeur(resultat, depot.cle, colonnesVoisin)
        resultat = avecLargeur(resultat, cleGlisse, COLONNES_GRILLE - colonnesVoisin)
      }
    }
    // Déposé au-dessus ou en dessous : le bloc **garde sa taille**. Il la
    // prenait auparavant sur toute la largeur, pour être sûr d'occuper une
    // rangée à lui seul ; mais déplacer un bloc n'est pas demander à le
    // redimensionner, et se retrouver avec une photo élargie parce qu'on l'a
    // bougée est la pire des surprises. Le seul cas où sa largeur change
    // encore est celui où elle ne rentre pas : voir juste au-dessus.

    return resultat
  }

  /**
   * Aperçu du dépôt : la rangée visée telle qu'elle sera **après**, un cadre
   * par bloc, aux largeurs d'après.
   *
   * Sans lui, poser un bloc sur une rangée déjà pleine rétrécit le voisin sans
   * l'avoir annoncé : on ne l'apprend qu'une fois le doigt levé.
   *
   * Les largeurs ne sont **pas** recalculées ici : on demande à
   * « placerCellule » le contenu tel qu'il serait (elle est pure, rien n'est
   * enregistré) et on dessine ce qu'elle répond. C'est la seule façon que
   * l'aperçu ne puisse pas annoncer autre chose que ce qui se produira.
   *
   * La bande verticale (haut et hauteur) est celle qu'occupe la rangée
   * aujourd'hui, relevée dans l'aperçu — comme le fait déjà le cadre fantôme.
   */
  const apercuDepot = (cleGlisse: string, vise: Depot): CadreApercu[] => {
    const grille = document.querySelector('.edit__apercu .mdl__grille')
    if (!grille) return []
    const apres = placerCellule(contenu, cleGlisse, vise)
    if (!apres) return []
    const rangee = rangeesDe(apres).find((cles) => cles.includes(cleGlisse))
    if (!rangee) return []

    // Le bloc glissé est mis à part : il est encore à son ancienne place dans
    // l'aperçu, sa position actuelle fausserait le haut de la rangée.
    const boites = new Map<string, DOMRect>()
    for (const cle of rangee) {
      if (cle === cleGlisse) continue
      const boite = document
        .querySelector(`.edit__apercu .emp[data-nom="${cle}"]`)
        ?.getBoundingClientRect()
      if (boite) boites.set(cle, boite)
    }
    // Le bloc atterrit seul sur sa rangée : il n'y a rien à annoncer d'autre
    // que sa propre place, dont le cadre fantôme se charge déjà.
    if (boites.size === 0) return []
    const haut = Math.min(...[...boites.values()].map((boite) => boite.top))
    // Hauteur du bloc qu'on tient, relevée à la saisie : pendant le geste il est
    // réduit, le mesurer maintenant donnerait 45 % de sa taille.
    const hauteurTenue =
      depart.current?.hauteur || Math.max(...[...boites.values()].map((boite) => boite.height))

    // Même mesure que dans « depotDansLeVide » : la gouttière est relue sur la
    // grille, jamais réécrite ici — les deux ne peuvent donc pas se contredire.
    // Elle est en pixels de toile, les rectangles en pixels d'écran : d'où la
    // remise à l'échelle.
    const cadreGrille = grille.getBoundingClientRect()
    const gouttiere =
      (parseFloat(getComputedStyle(grille).columnGap) || 0) * echelleDe(grille as HTMLElement)
    const colonne = Math.max(
      0,
      (cadreGrille.width - (COLONNES_GRILLE - 1) * gouttiere) / COLONNES_GRILLE,
    )

    let curseur = 0
    return rangee.map((cle) => {
      const debut = curseur + decalageDeCle(apres, cle)
      const largeur = colonnesDeCle(apres, cle)
      curseur = debut + largeur
      return {
        cle,
        gauche: cadreGrille.left + debut * (colonne + gouttiere),
        haut,
        largeur: largeur * colonne + (largeur - 1) * gouttiere,
        // **Chaque cadre a la taille de son bloc**, pas celle de la rangée :
        // celui du bloc porté fait exactement sa hauteur, celui d'un voisin la
        // sienne. Une bande commune donnait des cadres qui ne ressemblaient à
        // aucun des blocs qu'ils annonçaient.
        hauteur: cle === cleGlisse ? hauteurTenue : (boites.get(cle)?.height ?? hauteurTenue),
      }
    })
  }

  /** Déplace une cellule existante à l'endroit désigné par le dépôt. */
  const deposerCellule = (cleGlisse: string, depot: Depot) => {
    surModification((precedente) => {
      const avant = precedente.contenu as ContenuPage
      // Se déposer sur soi-même ne veut rien dire… sauf pour se pousser dans le
      // vide de sa propre rangée, où c'est justement le geste attendu.
      if (cleGlisse === depot.cle && depot.decalage === undefined) return precedente
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
        ? // L'habillage du bloc part avec lui : sans cela il resterait dans le
          // fichier sans plus rien à habiller.
          sansStylesVides({
            ...contenuPage,
            ordre,
            suite: lireSuite(contenuPage).filter(
              (bloc) => bloc.id !== cle.slice('suite:'.length),
            ),
            styles: sansEntree(contenuPage.styles, cle),
          })
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

  /**
   * Cadrage d'une photo recadrée : on fait glisser la photo **dans** son cadre
   * pour choisir la partie qui reste visible.
   *
   * Le geste n'existe que sur le bloc **sélectionné** : partout ailleurs, tirer
   * une photo déplace le bloc, comme avant. C'est ce qui évite de voler le
   * glisser-déposer — on choisit le bloc, puis on cadre sa photo.
   */
  const cadrage = useRef<{
    x: number
    y: number
    nom: string
    focalX: number
    focalY: number
    /** Ce qui dépasse du cadre, en pixels d'écran : la course du geste. */
    debordX: number
    debordY: number
    /** La photo elle-même : elle suit le doigt sans passer par React. */
    image: HTMLImageElement
  } | null>(null)

  const commencerCadrage = (
    evenement: React.PointerEvent<HTMLElement>,
    nom: string,
    zone: HTMLElement,
  ): boolean => {
    const image = zone.querySelector('img')
    if (!image || !image.naturalWidth || !image.naturalHeight) return false
    const cadre = zone.getBoundingClientRect()
    // « object-fit: cover » : la photo est agrandie jusqu'à couvrir le cadre,
    // et ce qui dépasse est la course du geste. Cadre et débordement sont tous
    // deux en pixels d'écran : leur rapport ne dépend pas du zoom de la toile.
    const echelle = Math.max(cadre.width / image.naturalWidth, cadre.height / image.naturalHeight)
    const style = lireStyle(contenu, nom)
    cadrage.current = {
      x: evenement.clientX,
      y: evenement.clientY,
      nom,
      focalX: style?.focalX ?? 50,
      focalY: style?.focalY ?? 50,
      debordX: image.naturalWidth * echelle - cadre.width,
      debordY: image.naturalHeight * echelle - cadre.height,
      image,
    }
    try {
      evenement.currentTarget.setPointerCapture(evenement.pointerId)
    } catch {
      /* capture indisponible : le glissement reste possible sans elle */
    }
    return true
  }

  /** Dernier cadrage visé pendant le geste, enregistré au relâchement. */
  const dernierCadrage = useRef<{ focalX: number; focalY: number } | null>(null)

  /** Où en est le cadrage pendant le geste : calculé ici, enregistré au relâchement. */
  const cadrageDepuis = (evenement: React.PointerEvent<HTMLElement>) => {
    const debut = cadrage.current
    if (!debut) return null
    // Tirer la photo vers la droite montre ce qui était à gauche : le
    // pourcentage baisse. D'où le signe. Un axe qui ne déborde pas ne bouge pas.
    const pourcent = (ecart: number, debord: number, depart: number) =>
      debord <= 0 ? depart : Math.min(100, Math.max(0, Math.round(depart - (ecart / debord) * 100)))
    return {
      focalX: pourcent(evenement.clientX - debut.x, debut.debordX, debut.focalX),
      focalY: pourcent(evenement.clientY - debut.y, debut.debordY, debut.focalY),
    }
  }

  const glisserCadrage = (evenement: React.PointerEvent<HTMLElement>): boolean => {
    const debut = cadrage.current
    const vise = cadrageDepuis(evenement)
    if (!debut || !vise) return false
    // La photo suit le doigt **tout de suite**, écrit dans son style : comme
    // pour le déplacement d'un bloc, un rendu React par mouvement de pointeur
    // ferait traîner le geste. Le contenu, lui, n'est écrit qu'au relâchement —
    // le cadrage tient donc en un seul pas d'annulation.
    debut.image.style.objectPosition = `${vise.focalX}% ${vise.focalY}%`
    dernierCadrage.current = vise
    return true
  }


  const auPointeurDescendu = (evenement: React.PointerEvent<HTMLElement>, nom: string) => {
    // La poignée de largeur a son propre glissement : ne pas le lui voler.
    if ((evenement.target as HTMLElement).closest('.mdl__poignee')) return
    // La photo du bloc sélectionné non plus : là, le geste cadre la photo.
    const zone = (evenement.target as HTMLElement).closest('.b-image__zone')
    if (selection === nom && estRecadre(contenu, nom) && zone instanceof HTMLElement) {
      if (commencerCadrage(evenement, nom, zone)) return
    }
    // Le glissement part parfois du panneau de droite (poignée « ⠿ ») : là, rien
    // ne suit le doigt, la ligne du panneau resterait coupée par son cadre.
    const surApercu = evenement.currentTarget.closest('.edit__apercu')
      ? evenement.currentTarget
      : null
    const echelle = surApercu ? echelleDe(surApercu) : 1
    depart.current = {
      x: evenement.clientX,
      y: evenement.clientY,
      id: nom,
      actif: false,
      element: surApercu,
      echelle,
      hauteur: surApercu ? surApercu.getBoundingClientRect().height : 0,
    }

    // Le bloc rétrécit **autour du point saisi** : c'est ce qui fait que
    // l'endroit qu'on a touché reste sous le doigt au lieu de filer vers un
    // coin. Posé dès la saisie, avant toute transformation.
    if (surApercu) {
      const cadre = surApercu.getBoundingClientRect()
      surApercu.style.transformOrigin = `${(evenement.clientX - cadre.left) / echelle}px ${
        (evenement.clientY - cadre.top) / echelle
      }px`
    }
  }

  const auPointeurDeplace = (evenement: React.PointerEvent<HTMLElement>) => {
    if (glisserCadrage(evenement)) return
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

    // Le bloc suit le doigt **tout de suite**, écrit directement dans le style :
    // aucun rendu React ne s'interpose, le geste ne peut donc pas traîner.
    if (debut.element) {
      const dx = (evenement.clientX - debut.x) / debut.echelle
      const dy = (evenement.clientY - debut.y) / debut.echelle
      debut.element.style.willChange = 'transform'
      debut.element.style.transform = `translate(${dx}px, ${dy}px) scale(${ECHELLE_PORTE})`
    }

    viser(depotDepuisPoint(evenement.clientX, evenement.clientY, debut.id))
  }

  const auPointeurRelache = () => {
    // Fin d'un cadrage : c'est ici qu'on enregistre, une fois.
    if (cadrage.current) {
      const nom = cadrage.current.nom
      const vise = dernierCadrage.current
      cadrage.current = null
      dernierCadrage.current = null
      if (vise) modifierStyle(nom, (style) => ({ ...style, ...vise }))
      vientDeGlisser.current = true
      setTimeout(() => {
        vientDeGlisser.current = false
      }, 0)
      return
    }
    const debut = depart.current
    relacherBlocSuivi()
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
    // Un dépôt qui montre son cadre fantôme n'éclaire aucun bloc : le bloc ne
    // vient pas se coller contre celui-ci, il se pose plus loin.
    const vise = depot?.cle === info.nom && !depot.fantome ? ` emp--depot-${depot.ou}` : ''

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

  // La page dans son ordre réel : chaque section du modèle, puis les blocs
  // ajoutés qui la suivent. C'est ce plan que le panneau affiche.
  // L'ordre réel de la page : emplacements du modèle et blocs ajoutés mêlés,
  // du haut vers le bas. Même source que le rendu — le panneau montre donc
  // exactement ce que le visiteur verra.
  const ordre = ordreCellules(contenu, modele)
  // Emplacements du modèle absents de la page : on doit pouvoir les remettre.
  const retires = Object.keys(modele.emplacements).filter((nom) => !ordre.includes(nom))

  /**
   * Tout ce qui concerne un bloc s'ouvre **sous lui** : son contenu (le texte,
   * la photo…) et sa personnalisation, dans un seul panneau. Rien n'est renvoyé
   * ailleurs dans la colonne : on modifie le bloc là où on vient de le cliquer.
   */
  const editionDuBloc = (nom: string) => {
    if (selection !== nom) return null
    const def = defPour(nom)
    const valeur = nom.startsWith('suite:')
      ? suite.find((bloc) => `suite:${bloc.id}` === nom)?.valeur
      : contenu.emplacements[nom]
    if (!def || !valeur) return null

    return (
      <PanneauBloc
        // « generation » change à chaque annulation : le panneau se remonte, et
        // le champ de texte enrichi relit alors le contenu rétabli.
        key={`${nom}-${generation}`}
        def={def}
        valeur={valeur}
        style={lireStyle(contenu, nom) ?? {}}
        couleursPage={couleursPage}
        resoudre={resoudre}
        surContenu={(transformation) => modifierEmplacement(nom, transformation)}
        surStyle={(transformation) => modifierStyle(nom, transformation)}
        surRecadrer={(actif) => basculerRecadrage(nom, actif)}
        surChoisirMedia={(type) => setSelecteur({ nom, type })}
        surFermeture={() => setSelection(null)}
      />
    )
  }

  // Mesuré à chaque rendu, donc à chaque mouvement du pointeur : les rectangles
  // relevés sont ceux de l'aperçu tel qu'il est en ce moment. Un aperçu gardé
  // en mémoire vieillirait dès le premier défilement.
  const apercuRangee = glisseId && depot ? apercuDepot(glisseId, depot) : []

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
            surHauteur={redimensionnerHauteur}
          />
        </ToileBorne>
      </div>

      {/* Place visée pendant un dépôt : la rangée entière telle qu'elle sera,
          ou à défaut le seul bloc déposé. Posé hors de l'aperçu et en
          « fixed » : les coordonnées relevées par « getBoundingClientRect » sont
          celles de l'écran, il n'y a donc aucune conversion à faire — et rien à
          craindre du « zoom » de la toile, qui ne s'applique pas ici. */}
      {apercuRangee.length > 0
        ? apercuRangee.map((cadre) => (
            <div
              key={cadre.cle}
              className={
                cadre.cle === glisseId
                  ? 'edit__fantome'
                  : 'edit__fantome edit__fantome--voisin'
              }
              aria-hidden="true"
              style={{
                left: cadre.gauche,
                top: cadre.haut,
                width: cadre.largeur,
                height: cadre.hauteur,
              }}
            />
          ))
        : depot?.fantome
          ? (
              <div
                className="edit__fantome"
                aria-hidden="true"
                style={{
                  left: depot.fantome.gauche,
                  top: depot.fantome.haut,
                  width: depot.fantome.largeur,
                  height: depot.fantome.hauteur,
                }}
              />
            )
          : null}

      <aside className="pan">
        <div className="pan__couleurs">
          <button
            type="button"
            className="pan__replier"
            aria-expanded={couleursOuvertes}
            onClick={() => setCouleursOuvertes((v) => !v)}
          >
            <span>Apparence de la page</span>
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

              {/* ── Le bandeau du haut ────────────────────────────────────
                  La barre « ← Accueil » du mode visiteur. Elle est **hors de la
                  toile** : l'aperçu de gauche ne la montre pas, ces réglages ne
                  se voient qu'en mode visiteur. */}
              <h3 className="pan__sous-titre">Bandeau du haut</h3>

              <label className="perso__bascule">
                <input
                  type="checkbox"
                  checked={page.bandeauMasque === true}
                  onChange={(evenement) => masquerBandeau(evenement.target.checked)}
                />
                <span>
                  <strong>Masquer le bandeau</strong>
                  <span className="pan__aide">
                    {page.bandeauMasque === true
                      ? 'La page prend toute la hauteur de l’écran. Le bouton « ← Accueil » reste, posé dans le coin : le visiteur garde toujours une sortie.'
                      : 'La barre du haut affiche le retour à l’accueil et le titre de la page.'}
                  </span>
                </span>
              </label>

              {page.bandeauMasque === true ? null : (
                <>
                  <div className="apparence__couleur">
                    <span className="champ__libelle">Fond du bandeau</span>
                    <RoueCouleur
                      valeur={couleursPage.couleurBandeau ?? BANDEAU_DEFAUT}
                      surChangement={(hex) => changerCouleurPage('couleurBandeau', hex)}
                    />
                  </div>

                  {/* Tant qu'aucune couleur n'est choisie ici, le disque montre
                      celle que la borne calcule d'elle-même d'après le fond :
                      ce qu'on voit est bien ce qui s'affiche. */}
                  <div className="apparence__couleur">
                    <span className="champ__libelle">Texte du bandeau</span>
                    <RoueCouleur
                      valeur={texteBandeau}
                      surChangement={(hex) => changerCouleurPage('couleurBandeauTexte', hex)}
                    />
                  </div>

                  <div className="apparence__veille">
                    <span className="champ__libelle">Hauteur du bandeau</span>
                    <input
                      type="number"
                      min={HAUTEUR_BANDEAU_MIN}
                      max={HAUTEUR_BANDEAU_MAX}
                      step={4}
                      value={page.hauteurBandeau ?? HAUTEUR_BANDEAU_DEFAUT}
                      onChange={(evenement) => changerHauteurBandeau(evenement.target.value)}
                    />
                    <span>pixels</span>
                  </div>
                </>
              )}

              {pagePersonnalisee ? (
                <button type="button" className="abtn abtn--discret" onClick={suivreThemeGlobal}>
                  Revenir à l’apparence par défaut
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
              <li key={cle} className={blocAjoute ? 'pan__ligne--ajoutee' : undefined}>
                {/* La ligne elle-même porte la clé : c'est elle que vise le
                    glissement dans le panneau. Le formulaire du bloc s'ouvre
                    juste en dessous, dans le même <li>. */}
                <div
                  data-cle={cle}
                  className={`pan__ligne${
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
                </div>
                {editionDuBloc(cle)}
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

        {selection ? null : (
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
          surSuppression={surRetraitMedia}
          surFermeture={() => setSelecteur(null)}
        />
      ) : null}
    </div>
  )
}

/**
 * Donne le clavier au premier champ d'un formulaire, sans faire défiler le
 * panneau. Le défilement d'un « autoFocus » ordinaire emporterait la vue
 * jusqu'au formulaire, tout en bas — par-dessus la personnalisation qui vient
 * de se déplier sous le bloc cliqué.
 *
 * Définie ici, hors des composants : une fonction recréée à chaque rendu serait
 * rappelée à chaque frappe, et remettrait le curseur au début du champ.
 */
const donnerLeClavier = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
  element?.focus({ preventScroll: true })
}

/** Les trois marques de mise en forme : champ, lettre du bouton, libellé. */
const MARQUES: ['gras' | 'italique' | 'souligne', string, string][] = [
  ['gras', 'G', 'Gras'],
  ['italique', 'I', 'Italique'],
  ['souligne', 'S', 'Souligné'],
]

/**
 * Icône d'alignement : quatre traits, un long sur deux, poussés du côté choisi.
 * Dessinée plutôt qu'écrite — les caractères d'alignement d'Unicode ne sont pas
 * présents dans toutes les polices, et s'afficheraient en carrés vides.
 */
function IconeAlignement({ vers }: { vers: AlignementBloc }) {
  const decalage = vers === 'gauche' ? 0 : vers === 'centre' ? 3 : 6
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3].map((rang) => {
        const court = rang % 2 === 1
        return (
          <rect
            key={rang}
            x={court ? decalage : 0}
            y={rang * 3}
            width={court ? 10 : 16}
            height="2"
            rx="1"
            fill="currentColor"
          />
        )
      })}
    </svg>
  )
}

/** Icône du fond d'un bloc : un pavé plein, comme la surface qu'on colore. */
function IconeFond() {
  return (
    <svg width="14" height="11" viewBox="0 0 14 11" aria-hidden="true" focusable="false">
      <rect
        x="0.75"
        y="0.75"
        width="12.5"
        height="9.5"
        rx="2"
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

/** Retire une entrée d'un rangement par nom de bloc, sans toucher à l'original. */
function sansEntree<T>(table: Record<string, T> | undefined, nom: string): Record<string, T> {
  const copie = { ...(table ?? {}) }
  delete copie[nom]
  return copie
}

/**
 * Contenu de page dont le rangement des habillages disparaît s'il est vide :
 * une page dont aucun bloc n'est personnalisé s'écrit exactement comme avant
 * l'introduction de ce réglage.
 */
function sansStylesVides(contenu: ContenuPage): ContenuPage {
  if (contenu.styles && Object.keys(contenu.styles).length > 0) return contenu
  const copie = { ...contenu }
  delete copie.styles
  return copie
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

/**
 * Le panneau d'un bloc, déplié juste sous lui dans la liste : tout ce qui
 * concerne le bloc, au même endroit. On le ferme par la croix, ou en recliquant
 * le bloc.
 *
 * La barre d'apparence est posée en tête, avant le formulaire : **tout** bloc
 * sélectionné se règle donc, y compris ceux qui n'ont pas de champ texte — une
 * galerie, un quiz, une frise, une photo. (Elle était auparavant réservée aux
 * blocs qui ont un champ texte, contre lequel elle se posait.)
 */
function PanneauBloc({
  def,
  valeur,
  style,
  couleursPage,
  resoudre,
  surContenu,
  surStyle,
  surRecadrer,
  surChoisirMedia,
  surFermeture,
}: {
  def: DefEmplacement
  valeur: ValeurEmplacement
  style: StyleBloc
  /** Couleurs effectives de la page : le point de départ des disques. */
  couleursPage: Couleurs
  resoudre: ResoudreMedia
  surContenu: (transformation: (valeur: ValeurEmplacement) => ValeurEmplacement) => void
  surStyle: (transformation: (style: StyleBloc) => StyleBloc) => void
  /** Coche « Recadrer la photo » : passe par l'éditeur, qui mesure la hauteur. */
  surRecadrer: (actif: boolean) => void
  surChoisirMedia: (type: 'image' | 'video') => void
  surFermeture: () => void
}) {
  const cadre = useRef<HTMLDivElement>(null)
  const commandesTexte = useRef<CommandesTexteRiche | null>(null)

  // Sur un bloc de texte, G / I / S ne mettent pas le bloc entier en gras : ils
  // mettent en forme **le morceau sélectionné**, dans le champ juste en dessous.
  // C'est la différence entre « ce bloc est en gras » et « ce mot est en gras ».
  const texteRiche = def.type === 'texte' && valeur.type === 'texte'

  // Le bloc cliqué peut se trouver au ras du bas de la colonne. On amène dans
  // la vue la ligne entière — le bloc **et** son panneau, d'où le « li » — et du
  // strict nécessaire : « nearest » ne bouge rien quand tout est déjà visible.
  // Viser le panneau seul le collerait en haut de la colonne, en chassant hors
  // de l'écran le bloc qu'on vient de cliquer.
  useEffect(() => {
    cadre.current?.closest('li')?.scrollIntoView({ block: 'nearest' })
  }, [])

  return (
    <div className="perso" ref={cadre}>
      {/* La croix se pose dans le coin du panneau, au niveau du libellé du
          premier champ : elle ne prend plus une ligne à elle, et le panneau ne
          s'ouvre plus sur un grand vide. */}
      <button
        type="button"
        className="abtn abtn--discret perso__fermer"
        aria-label="Fermer ce bloc"
        onClick={surFermeture}
      >
        ✕
      </button>

      <BarreMiseEnForme
        style={style}
        couleursPage={couleursPage}
        texteRiche={texteRiche}
        commandesTexte={commandesTexte}
        surStyle={surStyle}
      />

      <FormulaireBloc
        def={def}
        valeur={valeur}
        style={style}
        resoudre={resoudre}
        commandesTexte={commandesTexte}
        surChangement={surContenu}
        surRecadrer={surRecadrer}
        surChoisirMedia={surChoisirMedia}
      />
    </div>
  )
}

/**
 * La barre d'apparence d'un bloc, posée en tête de son panneau : gras, italique,
 * souligné | alignement | couleur du texte, couleur du fond (et, avec elle, sa
 * transparence).
 *
 * Les réglages portent sur le bloc entier — c'est pourquoi le fond s'appelle
 * « couleur du fond du bloc ». Seuls G / I / S font exception sur un bloc de
 * texte, où ils s'appliquent au morceau sélectionné.
 *
 * Ce qui se déplie (les disques de couleur, le curseur de transparence) n'est
 * pas montré d'emblée : côte à côte, deux disques feraient plus de cinq cents
 * pixels de haut et rejetteraient le formulaire hors de l'écran. On n'ouvre que
 * celui dont on a besoin.
 */
function BarreMiseEnForme({
  style,
  couleursPage,
  texteRiche,
  commandesTexte,
  surStyle,
}: {
  style: StyleBloc
  /** Couleurs effectives de la page : le point de départ des disques. */
  couleursPage: Couleurs
  /** Vrai sur un bloc de texte : G / I / S visent alors la sélection. */
  texteRiche: boolean
  commandesTexte: RefObject<CommandesTexteRiche | null>
  surStyle: (transformation: (style: StyleBloc) => StyleBloc) => void
}) {
  const [roue, setRoue] = useState<'fond' | 'couleur' | null>(null)
  /**
   * Ce qu'on est en train de taper dans la case de la taille, tant qu'on n'a pas
   * validé. Sans cet état, « 1 » (le début de « 150 ») serait aussitôt ramené
   * dans les bornes et l'on ne pourrait plus rien écrire.
   */
  const [tailleSaisie, setTailleSaisie] = useState<string | null>(null)

  const basculer = (champ: 'gras' | 'italique' | 'souligne') => {
    if (texteRiche) commandesTexte.current?.basculer(champ)
    else surStyle((precedent) => ({ ...precedent, [champ]: !precedent[champ] }))
  }

  const changerCouleur = (champ: 'fond' | 'couleur', hex: string) =>
    surStyle((precedent) => ({ ...precedent, [champ]: hex }))

  const retirerCouleur = (champ: 'fond' | 'couleur') =>
    surStyle((precedent) => {
      const copie = { ...precedent }
      delete copie[champ]
      // Le fond parti, sa transparence n'a plus rien à rendre translucide :
      // elle s'en va avec lui, plutôt que de rester dans le fichier.
      if (champ === 'fond') delete copie.opacite
      return copie
    })

  // On règle une **transparence** (0 = fond bien plein), plus parlante que
  // l'opacité qu'on range dans le contenu. Remise à zéro, elle sort du fichier.
  const transparence = 100 - (style.opacite ?? 100)
  const changerTransparence = (valeur: number) =>
    surStyle((precedent) => {
      const copie = { ...precedent }
      if (valeur <= 0) delete copie.opacite
      else {
        // Rendre translucide suppose un fond. Tant qu'aucun n'a été choisi, on
        // pose **celui que le disque affiche** — la couleur de la page. Sans
        // cela, le curseur ne pouvait rien faire tant qu'on n'avait pas touché
        // au disque, ce qui le faisait passer pour cassé.
        if (copie.fond === undefined) copie.fond = couleursPage.couleurFond
        copie.opacite = 100 - valeur
      }
      return copie
    })

  // Taille du texte du bloc, en pourcentage. Ramenée à 100, elle sort du
  // fichier : un bloc qu'on remet à sa taille normale ne laisse pas de trace.
  const taille = style.taille ?? 100
  // Le pas est compté sur la valeur **rangée dans le contenu**, pas sur celle
  // qu'affiche la barre : deux appuis rapprochés partiraient sinon tous les deux
  // du même point de départ, et l'un des deux serait perdu (constaté).
  const poserTaille = (valeur: number) =>
    surStyle((precedent) => {
      const borne = Math.min(TAILLE_TEXTE_MAX, Math.max(TAILLE_TEXTE_MIN, Math.round(valeur)))
      const copie = { ...precedent }
      if (borne === 100) delete copie.taille
      else copie.taille = borne
      return copie
    })

  const changerTaille = (sens: -1 | 1) => {
    setTailleSaisie(null)
    surStyle((precedent) => {
      const vise = (precedent.taille ?? 100) + sens * PAS_TAILLE_TEXTE
      const borne = Math.min(TAILLE_TEXTE_MAX, Math.max(TAILLE_TEXTE_MIN, vise))
      const copie = { ...precedent }
      if (borne === 100) delete copie.taille
      else copie.taille = borne
      return copie
    })
  }

  // Ce qui a été tapé est appliqué en quittant la case (ou par « Entrée »).
  // Une case vide ou un texte qui n'est pas un nombre ne change rien : on
  // retrouve la valeur d'avant plutôt qu'une taille inventée.
  const validerTaille = () => {
    const tape = tailleSaisie
    setTailleSaisie(null)
    if (tape === null) return
    const nombre = Number(tape.replace(',', '.'))
    if (tape.trim() === '' || !Number.isFinite(nombre)) return
    poserTaille(nombre)
  }

  const alignement = style.alignement ?? 'gauche'
  const alignements: [AlignementBloc, string][] = [
    ['gauche', 'Gauche'],
    ['centre', 'Centre'],
    ['droite', 'Droite'],
  ]

  const couleurRoue =
    roue === 'fond'
      ? (style.fond ?? couleursPage.couleurFond)
      : (style.couleur ?? couleursPage.couleurTexte)

  return (
    <div className="barre">
      {/* Barre d'outils : boutons carrés serrés, groupés par famille et séparés
          par un filet — la disposition d'un traitement de texte, que le
          personnel du musée connaît déjà. */}
      <div className="ruban">
        <div
          className="ruban__groupe"
          role="group"
          aria-label={texteRiche ? 'Mise en forme du texte sélectionné' : 'Mise en forme du texte'}
        >
          {MARQUES.map(([champ, lettre, libelle]) => (
            <button
              key={champ}
              type="button"
              className={`ruban__bouton${!texteRiche && style[champ] ? ' ruban__bouton--actif' : ''}`}
              // Sur un texte, ces boutons ne sont pas des interrupteurs du bloc :
              // ils agissent sur la sélection. Pas d'état « enfoncé », donc — la
              // mise en forme se voit dans le champ lui-même.
              aria-pressed={texteRiche ? undefined : style[champ] === true}
              // Sans libellé, le lecteur d'écran annoncerait « G », « I », « S ».
              aria-label={texteRiche ? `${libelle} — sur le texte sélectionné` : libelle}
              title={texteRiche ? `${libelle} — sur le texte sélectionné` : libelle}
              // Garde la sélection : sans cela le clic donnerait le clavier au
              // bouton, et il n'y aurait plus rien de sélectionné à mettre en forme.
              onMouseDown={texteRiche ? (evenement) => evenement.preventDefault() : undefined}
              onClick={() => basculer(champ)}
            >
              <span className={`perso__${champ}`}>{lettre}</span>
            </button>
          ))}
        </div>

        <span className="ruban__separateur" aria-hidden="true" />

        <div className="ruban__groupe" role="group" aria-label="Alignement du texte">
          {alignements.map(([alignementChoisi, libelle]) => (
            <button
              key={alignementChoisi}
              type="button"
              className={`ruban__bouton${alignement === alignementChoisi ? ' ruban__bouton--actif' : ''}`}
              aria-pressed={alignement === alignementChoisi}
              aria-label={`Aligner à ${libelle.toLowerCase()}`}
              title={libelle}
              onClick={() =>
                surStyle((precedent) => ({ ...precedent, alignement: alignementChoisi }))
              }
            >
              <IconeAlignement vers={alignementChoisi} />
            </button>
          ))}
        </div>

        <span className="ruban__separateur" aria-hidden="true" />

        {/* Taille du texte du bloc. Deux boutons plutôt qu'une liste déroulante :
            on lit la valeur en même temps qu'on la change, et il n'y a rien à
            viser au pixel. Le réglage vaut pour tout le bloc — comme
            l'alignement, et non comme G / I / S sur un texte. */}
        <div className="ruban__groupe" role="group" aria-label="Taille du texte">
          <button
            type="button"
            className="ruban__bouton"
            aria-label="Réduire le texte"
            title="Réduire le texte"
            disabled={taille <= TAILLE_TEXTE_MIN}
            onClick={() => changerTaille(-1)}
          >
            <span className="ruban__lettre ruban__lettre--petite">A</span>
          </button>
          {/* La valeur s'écrit aussi à la main : les deux boutons vont par pas
              de dix, taper « 145 » est plus court que quatre appuis — et permet
              une taille qui ne tombe pas sur un pas. */}
          <span className="ruban__taille">
            <input
              type="number"
              className="ruban__valeur"
              aria-label="Taille du texte, en pourcentage"
              title="Taille du texte, en pourcentage"
              min={TAILLE_TEXTE_MIN}
              max={TAILLE_TEXTE_MAX}
              step={PAS_TAILLE_TEXTE}
              value={tailleSaisie ?? taille}
              onChange={(evenement) => setTailleSaisie(evenement.target.value)}
              onBlur={validerTaille}
              onKeyDown={(evenement) => {
                if (evenement.key === 'Enter') evenement.currentTarget.blur()
                if (evenement.key === 'Escape') setTailleSaisie(null)
              }}
            />
            <span className="ruban__unite" aria-hidden="true">
              %
            </span>
          </span>
          <button
            type="button"
            className="ruban__bouton"
            aria-label="Agrandir le texte"
            title="Agrandir le texte"
            disabled={taille >= TAILLE_TEXTE_MAX}
            onClick={() => changerTaille(1)}
          >
            <span className="ruban__lettre ruban__lettre--grande">A</span>
          </button>
        </div>

        <span className="ruban__separateur" aria-hidden="true" />

        <div className="ruban__groupe" role="group" aria-label="Couleurs du bloc">
          <button
            type="button"
            className={`ruban__bouton${roue === 'couleur' ? ' ruban__bouton--actif' : ''}`}
            aria-expanded={roue === 'couleur'}
            aria-label="Couleur du texte"
            title="Couleur du texte"
            onClick={() => setRoue((ouverte) => (ouverte === 'couleur' ? null : 'couleur'))}
          >
            <span className="ruban__lettre">A</span>
            <span
              className="ruban__barre"
              // « backgroundColor » et non « background » : la forme courte
              // effacerait le damier de la classe, qui signale « aucune couleur ».
              style={{ backgroundColor: style.couleur ?? couleursPage.couleurTexte }}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className={`ruban__bouton${roue === 'fond' ? ' ruban__bouton--actif' : ''}`}
            aria-expanded={roue === 'fond'}
            aria-label="Couleur du fond du bloc"
            title="Couleur du fond du bloc"
            onClick={() => setRoue((ouverte) => (ouverte === 'fond' ? null : 'fond'))}
          >
            <IconeFond />
            <span
              className="ruban__barre"
              // Le bandeau montre le fond **tel qu'il sera**, transparence
              // comprise : le damier de la classe se lit à travers.
              style={{
                backgroundColor:
                  style.fond === undefined
                    ? 'transparent'
                    : `color-mix(in srgb, ${style.fond} ${style.opacite ?? 100}%, transparent)`,
              }}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {roue ? (
        <div className="perso__roue">
          <RoueCouleur valeur={couleurRoue} surChangement={(hex) => changerCouleur(roue, hex)} />

          {/* La transparence est rangée avec le fond, et non ailleurs dans la
              barre : elle ne rend translucide que lui. Elle est montrée dès que
              le disque du fond est ouvert, avant même qu'une couleur ait été
              choisie — la cacher jusque-là la rendait introuvable, surtout sur
              une galerie, dont les cases ont déjà un fond visible. Le curseur
              porte son propre libellé, avec le nombre — sinon on ne saurait pas
              où on en est une fois le doigt levé. */}
          {roue === 'fond' ? (
            <label className="perso__glissiere">
              <span>Transparence du fond : {transparence} %</span>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={transparence}
                onChange={(evenement) => changerTransparence(Number(evenement.target.value))}
              />
            </label>
          ) : null}

          {/* Le choix demandé : un aplat de couleur de la hauteur réglée, ou un
              fond qui épouse le texte avec l'espace autour. Il ne s'affiche
              qu'une fois un fond choisi — sans fond, la case ne changerait rien
              à l'écran. */}
          {roue === 'fond' && style.fond !== undefined ? (
            <label className="perso__bascule">
              <input
                type="checkbox"
                checked={style.remplir === true}
                onChange={(evenement) =>
                  surStyle((precedent) => {
                    const copie = { ...precedent }
                    if (evenement.target.checked) copie.remplir = true
                    else delete copie.remplir
                    return copie
                  })
                }
              />
              <span>
                <strong>Le fond remplit toute la hauteur</strong>
                <span className="pan__aide">
                  {style.remplir === true
                    ? 'Le fond descend jusqu’aux bords de la hauteur réglée aux poignées.'
                    : 'Le fond épouse le texte : la hauteur réglée aux poignées reste en espace libre au-dessus et au-dessous du bloc.'}
                </span>
              </span>
            </label>
          ) : null}

          {(roue === 'fond' ? style.fond : style.couleur) !== undefined ? (
            <button
              type="button"
              className="abtn abtn--discret"
              onClick={() => retirerCouleur(roue)}
            >
              {roue === 'fond' ? 'Retirer le fond' : 'Reprendre la couleur de la page'}
            </button>
          ) : null}
        </div>
      ) : null}

      {estStyleVide(style) ? null : (
        <button
          type="button"
          className="abtn abtn--discret"
          onClick={() => {
            setRoue(null)
            surStyle(() => ({}))
          }}
        >
          Rétablir par défaut
        </button>
      )}
    </div>
  )
}

/**
 * Un champ texte et son libellé.
 *
 * Un « div » et non un « label » : le libellé désignerait le premier élément de
 * formulaire venu, et un clic dessus déclencherait sa commande. Les saisies
 * portent donc leur libellé par « aria-label ».
 */
function ChampMisEnForme({
  libelle,
  compte,
  children,
}: {
  libelle: string
  /** Compteur de signes, sous le champ. Absent quand il n'y a rien à compter. */
  compte?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="champ">
      <span className="champ__libelle">{libelle}</span>
      {children}
      {compte}
    </div>
  )
}

const LEGENDE_MAX = 200

/**
 * Formulaire du bloc sélectionné. Défini hors du composant principal :
 * un composant défini pendant le rendu serait recréé à chaque frappe, et le
 * champ perdrait le focus à chaque lettre.
 */
function FormulaireBloc({
  def,
  valeur,
  style,
  resoudre,
  commandesTexte,
  surChangement,
  surRecadrer,
  surChoisirMedia,
}: {
  def: DefEmplacement
  valeur: ValeurEmplacement
  /** Sert au seul réglage de photo : « recadrer ». */
  style: StyleBloc
  resoudre: ResoudreMedia
  /** Boîte par laquelle les boutons G I S atteignent le texte sélectionné. */
  commandesTexte: RefObject<CommandesTexteRiche | null>
  surChangement: (transformation: (valeur: ValeurEmplacement) => ValeurEmplacement) => void
  surRecadrer?: (actif: boolean) => void
  surChoisirMedia: (type: 'image' | 'video') => void
}) {
  // Un texte se saisit mis en forme, directement dans le champ.
  if (def.type === 'texte' && valeur.type === 'texte') {
    const changerLignes = (lignes: LigneTexte[]) =>
      surChangement((v) => {
        if (v.type !== 'texte') return v
        const plat = texteBrut(lignes)
        // Un texte sans mise en forme n'écrit pas ses lignes : le fichier de
        // contenu reste alors exactement ce qu'il était auparavant.
        if (sansMiseEnForme(lignes)) {
          const copie = { ...v, valeur: plat }
          delete copie.lignes
          return copie
        }
        return { ...v, valeur: plat, lignes }
      })

    return (
      <div className="pan__formulaire">
        <ChampMisEnForme
          libelle={def.libelle}
          compte={
            <span className="champ__compte">
              {valeur.valeur.length} / {def.maxSignes}
            </span>
          }
        >
          <ChampTexteRiche
            lignes={lignesDeTexte(valeur)}
            maxSignes={def.maxSignes}
            commandes={commandesTexte}
            surChangement={changerLignes}
          />
        </ChampMisEnForme>
      </div>
    )
  }

  if (def.type === 'titre' && valeur.type === 'titre') {
    const changerTexte = (texte: string) =>
      surChangement((v) => (v.type === 'titre' ? { ...v, valeur: texte } : v))

    return (
      <div className="pan__formulaire">
        <ChampMisEnForme
          libelle={def.libelle}
          compte={
            <span className="champ__compte">
              {valeur.valeur.length} / {def.maxSignes}
            </span>
          }
        >
          <input
            ref={donnerLeClavier}
            aria-label={def.libelle}
            maxLength={def.maxSignes}
            value={valeur.valeur}
            onChange={(evenement) => changerTexte(evenement.target.value)}
          />
        </ChampMisEnForme>
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
          <ChampMisEnForme libelle="Légende">
            <input
              aria-label="Légende"
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
          </ChampMisEnForme>
        ) : null}

        {/* Le seul endroit d'où une photo peut être coupée : une case à cocher,
            décochée par défaut. Tant qu'elle l'est, la photo est montrée entière
            et son bloc suit ses proportions. */}
        {resolu && def.type === 'image' && surRecadrer ? (
          <label className="perso__bascule">
            <input
              type="checkbox"
              checked={style.recadre === true}
              onChange={(evenement) => surRecadrer(evenement.target.checked)}
            />
            <span>
              <strong>Recadrer la photo</strong>
              <span className="pan__aide">
                {style.recadre === true
                  ? 'La photo remplit un cadre dont vous réglez la hauteur (poignées en haut et en bas du bloc). Ce qui dépasse est coupé. Faites glisser la photo dans son cadre pour choisir la partie visible.'
                  : 'La photo est montrée entière. Cochez pour choisir vous-même la hauteur du bloc : la photo remplira le cadre et ce qui dépasse sera coupé.'}
              </span>
            </span>
          </label>
        ) : null}
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
      </div>
    )
  }

  if (def.type === 'quiz' && valeur.type === 'quiz') {
    return (
      <FormulaireQuiz def={def} valeur={valeur} surChangement={surChangement} />
    )
  }

  if (def.type === 'frise' && valeur.type === 'frise') {
    return (
      <FormulaireFrise def={def} valeur={valeur} surChangement={surChangement} />
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
}: {
  def: Extract<DefEmplacement, { type: 'quiz' }>
  valeur: Extract<ValeurEmplacement, { type: 'quiz' }>
  surChangement: (transformation: (valeur: ValeurEmplacement) => ValeurEmplacement) => void
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
          ref={donnerLeClavier}
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
}: {
  def: Extract<DefEmplacement, { type: 'frise' }>
  valeur: Extract<ValeurEmplacement, { type: 'frise' }>
  surChangement: (transformation: (valeur: ValeurEmplacement) => ValeurEmplacement) => void
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
          ref={donnerLeClavier}
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
  surSuppression,
  surFermeture,
}: {
  type: 'image' | 'video'
  manifeste: Manifeste
  resoudre: ResoudreMedia
  surChoix: (media: MediaManifeste) => void
  surImporter: () => void
  surSuppression: (id: string) => void
  surFermeture: () => void
}) {
  const disponibles = manifeste.medias.filter((media) => media.type === type)

  /** Média dont la croix vient d'être touchée : la carte demande confirmation. */
  const [aSupprimer, setASupprimer] = useState<string | null>(null)

  // Un média employé quelque part ne doit pas disparaître sous les pieds de la
  // page qui l'affiche. Plutôt que d'énumérer les endroits possibles (bloc
  // image, galerie, vignette, fond d'accueil… et ceux à venir), on cherche
  // l'identifiant dans le contenu entier : c'est un identifiant unique, il ne
  // peut pas s'y trouver par hasard.
  const contenuBrut = useMemo(
    () => JSON.stringify({ pages: manifeste.pages, reglages: manifeste.reglages }),
    [manifeste.pages, manifeste.reglages],
  )

  return (
    <div className="voile" role="dialog" aria-modal="true" aria-label="Bibliothèque des médias">
      <div className="voile__boite">
        <BoutonFermer surFermeture={surFermeture} libelle="Fermer la bibliothèque" />
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
              const nom = media.legende || media.id
              const utilise = contenuBrut.includes(media.id)
              return (
                <li key={media.id} className="media-case">
                  <button type="button" className="media-carte" onClick={() => surChoix(media)}>
                    {vignette ? (
                      <img className="media-carte__image" src={vignette} alt="" draggable={false} />
                    ) : (
                      <span className="media-carte__image media-carte__image--absente">🎬</span>
                    )}
                    <span className="media-carte__nom">{nom}</span>
                  </button>

                  <button
                    type="button"
                    className="media-case__croix"
                    aria-label={`Supprimer ${nom} de la bibliothèque`}
                    onClick={() => setASupprimer(media.id)}
                  >
                    ✕
                  </button>

                  {aSupprimer === media.id ? (
                    <div className="media-case__confirme">
                      {utilise ? (
                        <>
                          <span className="media-case__mot">
                            Déjà utilisée dans le contenu. Retirez-la d'abord des pages qui
                            l'affichent.
                          </span>
                          <button
                            type="button"
                            className="abtn abtn--discret"
                            onClick={() => setASupprimer(null)}
                          >
                            Fermer
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="media-case__mot">Supprimer de la bibliothèque ?</span>
                          <button
                            type="button"
                            className="abtn abtn--danger"
                            onClick={() => {
                              surSuppression(media.id)
                              setASupprimer(null)
                            }}
                          >
                            Supprimer
                          </button>
                          <button
                            type="button"
                            className="abtn abtn--discret"
                            onClick={() => setASupprimer(null)}
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
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
