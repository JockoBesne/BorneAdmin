import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LISTE_MODELES,
  modelePar,
  REGLAGES_DEFAUT,
  TAILLE_TEXTE_MAX,
  TAILLE_TEXTE_MIN,
  type ContenuPage,
  type IdModele,
  type Manifeste,
  type PageManifeste,
} from '@borne/contenu'
import { RenduPage, ToileBorne, type ResoudreMedia } from '@borne/contenu/rendu'
import { Accueil, ApercuPage } from './Accueil.jsx'
import { ClavierTactile } from './ClavierTactile.jsx'
import {
  chargerContenu,
  enregistrerContenu,
  exporterPage,
  importerMedia,
  importerPage,
  resolveurMedias,
} from './contenu.js'
import { ACCENT_ORIGINE, couleursHub, stylesCouleurs } from './couleurs.js'
import { EditeurPage } from './EditeurPage.jsx'
import { BoutonFermer } from './Voile.jsx'
import { RoueCouleur } from './RoueCouleur.jsx'

/**
 * Administration.
 *
 * Deux écrans : la liste des pages (créer, modifier, réordonner, dupliquer,
 * supprimer) et l'éditeur d'une page (EditeurPage).
 *
 * Le contenu est tenu ici, en un seul exemplaire ; chaque modification est
 * enregistrée sur le disque toute seule, 600 ms après la dernière frappe.
 * Personne n'a de bouton « Enregistrer » à connaître — l'indicateur de la
 * barre dit en permanence où on en est.
 */

type EtatEnregistrement = 'repos' | 'modifications' | 'ecriture' | 'enregistre' | 'echec'

/** Deux modifications plus rapprochées que cela ne font qu'un pas d'historique. */
const REGROUPEMENT_MS = 600

/** Profondeur de l'historique. Au-delà, les plus vieux pas sont oubliés. */
const PAS_MAX = 50

/**
 * Historique tenu **hors du composant**, exprès : il survit à un aller-retour
 * par la borne. Revenir voir sa page côté visiteur puis rouvrir
 * l'administration ne fait plus perdre le droit d'annuler — c'est justement en
 * regardant le résultat qu'on se dit qu'on préférait l'état d'avant.
 *
 * Sans danger : rien d'autre que cet écran n'écrit le contenu, et tout est
 * enregistré avant de rendre la main à la borne — les pas gardés décrivent donc
 * bien le fichier tel qu'il est. Sans poids non plus : 50 pas au plus, et un pas
 * n'est pas une copie du contenu mais le manifeste tel qu'il était, dont
 * l'immense majorité des objets est partagée avec ses voisins.
 *
 * Il disparaît à la fermeture de l'application, comme n'importe quelle mémoire
 * vive : on n'annule pas une modification de la semaine dernière.
 */
const HISTORIQUE: { passe: Manifeste[]; futur: Manifeste[] } = { passe: [], futur: [] }

const TEXTES_ETAT: Record<EtatEnregistrement, string> = {
  repos: '',
  modifications: 'Modifications…',
  ecriture: 'Enregistrement…',
  enregistre: '✓ Enregistré',
  echec: '⚠ Échec de l’enregistrement — nouvel essai à la prochaine modification',
}

/**
 * Apparence d'un des textes de l'accueil : sa couleur et sa taille.
 *
 * Le disque montre **la couleur qui s'affiche** — celle réglée, ou celle
 * d'origine tant que rien n'a été choisi : sans cela il partirait du noir, et
 * le premier geste changerait tout d'un coup.
 */
function ReglageTexteHub({
  libelle,
  couleur,
  couleurDefaut,
  taille,
  surCouleur,
  surTaille,
}: {
  libelle: string
  couleur: string | undefined
  couleurDefaut: string
  taille: number | undefined
  surCouleur: (hex: string) => void
  surTaille: (pourcent: number) => void
}) {
  return (
    <div className="apparence__couleur">
      <span className="champ__libelle">{libelle}</span>
      <RoueCouleur valeur={couleur ?? couleurDefaut} surChangement={surCouleur} />
      <label className="perso__glissiere">
        <span>Taille : {taille ?? 100} %</span>
        <input
          type="range"
          min={TAILLE_TEXTE_MIN}
          max={TAILLE_TEXTE_MAX}
          step={5}
          value={taille ?? 100}
          onChange={(evenement) => surTaille(Number(evenement.target.value))}
        />
      </label>
    </div>
  )
}

export function Admin({
  surFermeture,
  pageInitiale,
}: {
  /**
   * Retour à la borne. La page en cours de modification est passée : on
   * atterrit dessus côté visiteur, et non sur l'accueil — on va voir ce qu'on
   * vient de corriger, c'est le chemin inverse de `pageInitiale`.
   */
  surFermeture: (pageOuverte: string | null) => void
  /**
   * Page à ouvrir d'emblée, quand on entre dans l'administration depuis une
   * page de la borne. Absente (entrée depuis l'accueil) : la liste des pages,
   * comme avant.
   */
  pageInitiale?: string | null
}) {
  const [manifeste, setManifeste] = useState<Manifeste | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [pageOuverte, setPageOuverte] = useState<string | null>(pageInitiale ?? null)
  const [choixModele, setChoixModele] = useState(false)
  const [apparenceOuverte, setApparenceOuverte] = useState(false)
  const [accueilOuvert, setAccueilOuvert] = useState(false)
  const [reglagesOuverts, setReglagesOuverts] = useState(false)
  /**
   * Ce qu'on est en train de taper comme code d'accès, tant qu'il ne fait pas
   * quatre chiffres. Il vit à part du contenu : un code incomplet écrit dans le
   * manifeste serait **refusé par le schéma à l'enregistrement**, et plus rien
   * ne s'enregistrerait tant qu'il n'aurait pas été corrigé. Même précaution
   * que la case de la taille du texte dans l'éditeur.
   */
  const [pinSaisi, setPinSaisi] = useState<string | null>(null)
  const [suppression, setSuppression] = useState<string | null>(null)
  /** Page en cours de glissement dans la liste, s'il y en a une. */
  const [glissee, setGlissee] = useState<string | null>(null)
  const [etat, setEtat] = useState<EtatEnregistrement>('repos')
  // Compte rendu du dernier import ou export. Une opération sur une clé USB est
  // la seule action de cet écran dont le résultat ne se voit pas tout seul.
  const [transfert, setTransfert] = useState<string | null>(null)
  const sale = useRef(false)

  // Historique : les états d'avant, et ceux qu'on vient d'annuler (voir
  // « HISTORIQUE », gardé hors du composant). Le contenu d'un musée tient
  // largement en mémoire — pas besoin de ruser.
  const derniereEtape = useRef(0)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let annule = false

    chargerContenu()
      .then((charge) => {
        if (!annule) setManifeste(charge)
      })
      .catch((cause: unknown) => {
        if (!annule) {
          setErreur(cause instanceof Error ? cause.message : 'Contenu illisible.')
        }
      })

    return () => {
      annule = true
    }
  }, [])

  const modifier = useCallback((transformation: (manifeste: Manifeste) => Manifeste) => {
    sale.current = true
    setEtat('modifications')
    setManifeste((precedent) => {
      if (!precedent) return precedent
      const suivant = transformation(precedent)
      // Une transformation qui ne change rien ne fait pas un pas d'historique :
      // sinon « Annuler » ne ferait rien de visible.
      if (suivant === precedent) return precedent

      // Frappe au kilomètre : on ne garde que l'état d'**avant** la rafale.
      // Sans cela, annuler une phrase demanderait autant d'appuis que de
      // lettres tapées.
      const maintenant = Date.now()
      const dejaEmpile = HISTORIQUE.passe[HISTORIQUE.passe.length - 1] === precedent
      if (!dejaEmpile && maintenant - derniereEtape.current >= REGROUPEMENT_MS) {
        HISTORIQUE.passe = [...HISTORIQUE.passe, precedent].slice(-PAS_MAX)
      }
      derniereEtape.current = maintenant
      // Repartir d'une modification efface le futur : on ne rétablit que ce
      // qu'on vient d'annuler, jamais une branche abandonnée.
      HISTORIQUE.futur = []
      return suivant
    })
  }, [])

  /**
   * Revient à l'état précédent (ou repart en avant). Le contenu est tenu en un
   * seul exemplaire : un pas d'historique est donc simplement le manifeste
   * entier, tel qu'il était. Simple, et sûr — rien ne peut se désynchroniser.
   */
  const parcourir = (sens: 'arriere' | 'avant') => {
    const source = sens === 'arriere' ? 'passe' : 'futur'
    const destination = sens === 'arriere' ? 'futur' : 'passe'
    const etape = HISTORIQUE[source][HISTORIQUE[source].length - 1]
    if (!etape) return

    HISTORIQUE[source] = HISTORIQUE[source].slice(0, -1)
    if (manifeste) HISTORIQUE[destination] = [...HISTORIQUE[destination], manifeste]
    setManifeste(etape)
    // Le pas suivant ne doit pas être avalé par le regroupement de la frappe.
    derniereEtape.current = 0
    sale.current = true
    setEtat('modifications')
    // Les champs de saisie ne se relisent qu'au montage : ce compteur les
    // remonte à neuf, sinon un texte annulé resterait affiché à l'écran.
    setGeneration((valeur) => valeur + 1)
  }

  const annuler = () => parcourir('arriere')
  const retablir = () => parcourir('avant')

  // Ctrl + Z annule, Ctrl + Y (ou Ctrl + Maj + Z) rétablit — les raccourcis
  // attendus partout ailleurs. Dans un champ de saisie, on laisse la main au
  // navigateur : à l'intérieur d'un texte, on attend d'annuler sa frappe, pas
  // la dernière action de la page.
  useEffect(() => {
    const auClavier = (evenement: KeyboardEvent) => {
      if (!evenement.ctrlKey && !evenement.metaKey) return

      // Ctrl + Maj + A ferme l'application. Le raccourci est posé ici, dans
      // l'écran d'administration : devant un visiteur, il n'existe pas. Il est
      // reconnu même dans un champ de saisie — on vient peut-être de taper, et
      // c'est justement ce qui est enregistré avant de fermer.
      if (evenement.shiftKey && evenement.key.toLowerCase() === 'a') {
        evenement.preventDefault()
        quitter()
        return
      }

      const cible = evenement.target as HTMLElement | null
      if (cible?.closest('input, textarea, [contenteditable="true"]')) return

      const touche = evenement.key.toLowerCase()
      if (touche === 'z' && !evenement.shiftKey) {
        evenement.preventDefault()
        annuler()
      } else if (touche === 'y' || (touche === 'z' && evenement.shiftKey)) {
        evenement.preventDefault()
        retablir()
      }
    }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  })

  // Enregistrement automatique différé : 600 ms après la dernière modification.
  useEffect(() => {
    if (!manifeste || !sale.current) return

    const minuterie = setTimeout(() => {
      sale.current = false
      setEtat('ecriture')
      enregistrerContenu(manifeste)
        .then(() => setEtat(sale.current ? 'modifications' : 'enregistre'))
        .catch(() => {
          sale.current = true
          setEtat('echec')
        })
    }, 600)

    return () => clearTimeout(minuterie)
  }, [manifeste])

  // Une modification peut attendre les 600 ms de l'enregistrement automatique :
  // on l'écrit tout de suite avant de quitter l'écran, sinon la dernière frappe
  // serait perdue.
  const ecrireEnAttente = (): Promise<void> => {
    const fin =
      sale.current && manifeste
        ? enregistrerContenu(manifeste).catch(() => {})
        : Promise.resolve()
    sale.current = false
    return fin
  }

  // Retour à la borne, qui recharge le contenu en revenant.
  const fermer = () => void ecrireEnAttente().then(() => surFermeture(pageOuverte))

  // Fermeture de l'application entière (Ctrl + Maj + A).
  const quitter = () => void ecrireEnAttente().then(() => window.borne.quitter())

  // ── Opérations sur les pages ───────────────────────────────────────────────

  const renumeroter = (pages: PageManifeste[]): PageManifeste[] =>
    pages.map((page, index) => ({ ...page, ordre: index + 1 }))

  const creer = (idModele: IdModele) => {
    const modele = modelePar(idModele)
    if (!modele) return
    const page: PageManifeste = {
      id: `page-${crypto.randomUUID()}`,
      titre: 'Sans titre',
      modele: idModele,
      ordre: 0,
      vignette: null,
      contenu: modele.contenuVide(),
    }
    modifier((m) => ({ ...m, pages: renumeroter([...m.pages, page]) }))
    setChoixModele(false)
    setPageOuverte(page.id)
  }

  const dupliquer = (id: string) => {
    modifier((m) => {
      const index = m.pages.findIndex((page) => page.id === id)
      const original = m.pages[index]
      if (!original) return m
      const copie: PageManifeste = {
        ...structuredClone(original),
        id: `page-${crypto.randomUUID()}`,
        titre: `${original.titre} (copie)`,
      }
      const pages = [...m.pages]
      pages.splice(index + 1, 0, copie)
      return { ...m, pages: renumeroter(pages) }
    })
  }

  const supprimer = (id: string) => {
    modifier((m) => ({ ...m, pages: renumeroter(m.pages.filter((page) => page.id !== id)) }))
    setSuppression(null)
  }

  const deplacer = (id: string, sens: -1 | 1) => {
    modifier((m) => {
      const index = m.pages.findIndex((page) => page.id === id)
      const cible = index + sens
      if (index < 0 || cible < 0 || cible >= m.pages.length) return m
      const pages = [...m.pages]
      const [retiree] = pages.splice(index, 1)
      if (!retiree) return m
      pages.splice(cible, 0, retiree)
      return { ...m, pages: renumeroter(pages) }
    })
  }

  // ── Transport d'une page (clé USB) ─────────────────────────────────────────
  // Préparer une page au bureau, l'apporter en salle. L'export ne touche pas au
  // contenu ; l'import passe par « modifier », donc il s'annule au Ctrl + Z.

  const exporter = (id: string) => {
    if (!manifeste) return
    setTransfert(null)
    exporterPage(manifeste, id)
      .then((dossier) => {
        if (dossier) setTransfert(`Page exportée dans ${dossier}`)
      })
      .catch((cause: unknown) =>
        setTransfert(`⚠ Export impossible : ${cause instanceof Error ? cause.message : cause}`),
      )
  }

  const importer = () => {
    if (!manifeste) return
    setTransfert(null)
    importerPage(manifeste)
      .then((reprise) => {
        if (!reprise) return
        const remplace = manifeste.pages.some((page) => page.id === reprise.idPage)
        modifier(reprise.appliquer)
        setTransfert(
          remplace
            ? `« ${reprise.titre} » a remplacé la page du même nom.`
            : `« ${reprise.titre} » a été ajoutée à la fin de l'accueil.`,
        )
      })
      .catch((cause: unknown) =>
        setTransfert(`⚠ Import impossible : ${cause instanceof Error ? cause.message : cause}`),
      )
  }

  /**
   * Pose une page à la place d'une autre. Appelée pendant le glissement, à
   * chaque fois que le doigt passe sur une autre ligne : la liste se réordonne
   * sous le doigt, on voit le résultat avant de lâcher.
   *
   * Les modifications rapprochées ne font qu'un pas d'historique (voir
   * REGROUPEMENT_MS) : un glissement entier s'annule donc d'un seul Ctrl + Z.
   */
  const deplacerVers = (id: string, cible: string) =>
    modifier((m) => {
      const depart = m.pages.findIndex((page) => page.id === id)
      const arrivee = m.pages.findIndex((page) => page.id === cible)
      if (depart < 0 || arrivee < 0 || depart === arrivee) return m
      const pages = [...m.pages]
      const [retiree] = pages.splice(depart, 1)
      if (!retiree) return m
      pages.splice(arrivee, 0, retiree)
      return { ...m, pages: renumeroter(pages) }
    })

  /**
   * Glissement d'une page dans la liste : on suit le doigt sur la **fenêtre**,
   * pas sur la poignée.
   *
   * La capture du pointeur (`setPointerCapture`, ce qu'emploie l'éditeur de
   * page) ne convient pas ici : la ligne qu'on tient **change de place** pendant
   * le geste, et Chromium relâche alors la capture — le glissement s'arrêtait
   * au premier déplacement, et la ligne restait accrochée au doigt. Défaut
   * constaté à l'essai.
   */
  useEffect(() => {
    if (!glissee) return

    const bouger = (evenement: PointerEvent) => {
      // La ligne réellement sous le doigt donne la place où poser la page.
      const sous = document
        .elementFromPoint(evenement.clientX, evenement.clientY)
        ?.closest('.admin__page')
      const cible = sous?.getAttribute('data-page')
      if (cible && cible !== glissee) deplacerVers(glissee, cible)
    }
    const finir = () => setGlissee(null)

    window.addEventListener('pointermove', bouger)
    window.addEventListener('pointerup', finir)
    window.addEventListener('pointercancel', finir)
    return () => {
      window.removeEventListener('pointermove', bouger)
      window.removeEventListener('pointerup', finir)
      window.removeEventListener('pointercancel', finir)
    }
  })

  const changerCouleur = (
    champ:
      | 'couleurFond'
      | 'couleurTexte'
      | 'hubCouleurFond'
      | 'hubCouleurTexte'
      | 'hubTitreCouleur'
      | 'hubSousTitreCouleur'
      | 'hubNomFond'
      | 'hubNomCouleur',
    hex: string,
  ) =>
    modifier((m) => {
      const reglages = { ...m.reglages, [champ]: hex }

      // « Apparence généralisée » vaut pour **tout** : les pages et l'accueil.
      //
      // Une page ou un accueil qui s'était donné sa propre couleur la reprend
      // ici — c'est la **dernière modification en date** qui l'emporte, et non
      // la page par principe. Sans cela, régler la couleur générale ne changeait
      // rien aux pages déjà personnalisées, et le réglage passait pour cassé.
      // Le geste est annulable comme tous les autres (Ctrl + Z rend le
      // manifeste entier tel qu'il était).
      if (champ !== 'couleurFond' && champ !== 'couleurTexte') {
        return { ...m, reglages }
      }
      return sansCouleursPropres({ ...m, reglages }, [champ])
    })

  /**
   * Efface la couleur que les pages et l'accueil s'étaient donnée, pour les
   * champs indiqués : ils reprennent alors celle de la borne.
   *
   * Le même passage sert au disque de couleur **et** au bouton « Rétablir les
   * couleurs d'origine ». Le bouton ne le faisait pas : sur un contenu dont les
   * pages ont leurs propres couleurs — le cas même pour lequel cette règle
   * existe — il remettait le réglage général et rien ne changeait à l'écran.
   */
  const sansCouleursPropres = (
    m: Manifeste,
    champs: ('couleurFond' | 'couleurTexte')[],
  ): Manifeste => {
    const reglages = { ...m.reglages }
    for (const champ of champs) {
      if (champ === 'couleurFond') reglages.hubCouleurFond = undefined
      else reglages.hubCouleurTexte = undefined
    }
    return {
      ...m,
      reglages,
      pages: m.pages.map((page) => {
        const copie = { ...page }
        for (const champ of champs) delete copie[champ]
        return copie
      }),
    }
  }

  /**
   * Code d'accès à l'administration : quatre chiffres, et rien d'autre.
   *
   * Il n'est écrit dans le contenu **qu'une fois complet** — voir `pinSaisi`.
   * Ce code écarte un visiteur curieux ; ce n'est pas une sécurité, il est
   * lisible en clair dans `contenu.json`, et il ne faut pas le présenter
   * autrement au musée.
   */
  const changerPin = (saisie: string) => {
    const chiffres = saisie.replace(/[^0-9]/g, '').slice(0, 4)
    setPinSaisi(chiffres)
    if (chiffres.length === 4) {
      modifier((m) => ({ ...m, reglages: { ...m.reglages, pinAdmin: chiffres } }))
    }
  }

  /**
   * Les mots affichés sur l'écran d'accueil : le grand titre et le sous-titre.
   *
   * Ils vivaient dans le fichier de contenu sans que personne puisse les
   * changer — même défaut que le délai de retour automatique avant qu'il ne
   * remonte ici. (Le nom « veille » est celui d'origine du champ ; il désigne
   * bien l'écran d'accueil.)
   */
  const changerTexteHub = (champ: 'titreVeille' | 'sousTitreVeille', valeur: string) =>
    modifier((m) => ({ ...m, reglages: { ...m.reglages, [champ]: valeur } }))

  /**
   * Taille d'un des trois textes de l'accueil, en pourcentage.
   *
   * Ramenée à 100, elle **sort du fichier** : un texte remis à sa taille
   * normale ne laisse pas de trace, et l'accueil retrouve exactement son
   * apparence d'origine.
   */
  const changerTailleHub = (
    champ: 'hubTitreTaille' | 'hubSousTitreTaille' | 'hubNomTaille',
    pourcent: number,
  ) =>
    modifier((m) => ({
      ...m,
      reglages: { ...m.reglages, [champ]: pourcent === 100 ? undefined : pourcent },
    }))

  /**
   * Délai avant le retour automatique à l'accueil, en minutes.
   *
   * Borné à la lecture comme le schéma le demande (1 à 60) : une case vidée ou
   * une valeur aberrante tapée à la main ne doit pas produire un contenu que
   * l'enregistrement refuserait ensuite.
   */
  const changerVeille = (saisie: string) =>
    modifier((m) => {
      const minutes = Number.parseInt(saisie, 10)
      if (!Number.isFinite(minutes)) return m
      return {
        ...m,
        reglages: { ...m.reglages, minutesAvantVeille: Math.min(60, Math.max(1, minutes)) },
      }
    })

  // Retire les couleurs propres à l'accueil : il reprend alors celles de la
  // borne. « undefined » disparaît du fichier à l'écriture.
  const retablirCouleursHub = () =>
    modifier((m) => ({
      ...m,
      reglages: {
        ...m.reglages,
        hubCouleurFond: undefined,
        hubCouleurTexte: undefined,
        hubTitreCouleur: undefined,
        hubTitreTaille: undefined,
        hubSousTitreCouleur: undefined,
        hubSousTitreTaille: undefined,
        hubNomFond: undefined,
        hubNomCouleur: undefined,
        hubNomTaille: undefined,
      },
    }))

  // Retour aux couleurs d'origine de la borne. Comme les disques ci-dessus, il
  // reprend les pages et l'accueil qui s'en étaient donné d'autres : sans cela,
  // le bouton ne changeait rien sur un contenu personnalisé.
  const retablirCouleurs = () =>
    modifier((m) =>
      sansCouleursPropres(
        {
          ...m,
          reglages: {
            ...m.reglages,
            couleurFond: REGLAGES_DEFAUT.couleurFond,
            couleurTexte: REGLAGES_DEFAUT.couleurTexte,
          },
        },
        ['couleurFond', 'couleurTexte'],
      ),
    )

  // ── Images de l'accueil ────────────────────────────────────────────────────
  // Le fichier est copié dans la bibliothèque de médias, puis rangé : en fond
  // de l'accueil, ou comme image de présentation d'une page sur sa carte.

  const choisirImageFond = () =>
    void importerMedia('image').then((media) => {
      if (!media) return
      modifier((m) => ({
        ...m,
        medias: [...m.medias, media],
        reglages: { ...m.reglages, hubImage: media.id },
      }))
    })

  const retirerImageFond = () =>
    modifier((m) => ({ ...m, reglages: { ...m.reglages, hubImage: undefined } }))

  const choisirVignette = (id: string) =>
    void importerMedia('image').then((media) => {
      if (!media) return
      modifier((m) => ({
        ...m,
        medias: [...m.medias, media],
        pages: m.pages.map((p) => (p.id === id ? { ...p, vignette: media.id } : p)),
      }))
    })

  /** Revient à l'image automatique : la première image de la page. */
  const retirerVignette = (id: string) =>
    modifier((m) => ({
      ...m,
      pages: m.pages.map((p) => (p.id === id ? { ...p, vignette: null } : p)),
    }))

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const page = manifeste?.pages.find((candidate) => candidate.id === pageOuverte) ?? null

  // Page servant d'aperçu aux couleurs : la première s'il y en a une, sinon une
  // page vide du premier modèle — pour toujours montrer un vrai rendu.
  const pageApercu = manifeste?.pages[0]?.contenu ?? LISTE_MODELES[0]?.contenuVide()
  const apercuMedia: ResoudreMedia = manifeste ? resolveurMedias(manifeste) : () => null
  const imageFond = apercuMedia(manifeste?.reglages.hubImage ?? null)

  return (
    <div className="admin">
      <header className="admin__barre">
        {page ? (
          <button type="button" className="admin__retour" onClick={() => setPageOuverte(null)}>
            ← Pages
          </button>
        ) : (
          <h1 className="admin__titre">Administration</h1>
        )}

        {page ? <span className="admin__page-courante">{page.titre}</span> : null}

        <span
          className={`admin__etat${etat === 'echec' ? ' admin__etat--echec' : ''}`}
          role="status"
          aria-live="polite"
        >
          {TEXTES_ETAT[etat]}
        </span>

        {/* Le raccourci clavier ne doit jamais être le seul moyen : l'écran de
            la salle n'a pas de clavier. */}
        <button
          type="button"
          className="admin__histoire"
          aria-label="Annuler la dernière modification (Ctrl + Z)"
          title="Annuler (Ctrl + Z)"
          disabled={HISTORIQUE.passe.length === 0}
          onClick={annuler}
        >
          ↶ Annuler
        </button>
        <button
          type="button"
          className="admin__histoire"
          aria-label="Rétablir la modification annulée (Ctrl + Y)"
          title="Rétablir (Ctrl + Y)"
          disabled={HISTORIQUE.futur.length === 0}
          onClick={retablir}
        >
          ↷ Rétablir
        </button>

        <button type="button" className="admin__fermer" onClick={fermer}>
          Fermer
        </button>
      </header>

      {erreur ? (
        <div className="admin__corps">
          <p className="admin__message" role="alert">
            {erreur}
          </p>
        </div>
      ) : !manifeste ? (
        <div className="admin__corps">
          <p className="admin__message">Chargement…</p>
        </div>
      ) : page ? (
        <EditeurPage
          key={page.id}
          generation={generation}
          manifeste={manifeste}
          page={page}
          surModification={(transformation) =>
            modifier((m) => ({
              ...m,
              pages: m.pages.map((candidate) =>
                candidate.id === page.id ? transformation(candidate) : candidate,
              ),
            }))
          }
          surAjoutMedia={(media) => modifier((m) => ({ ...m, medias: [...m.medias, media] }))}
          surRetraitMedia={(id) =>
            modifier((m) => ({ ...m, medias: m.medias.filter((media) => media.id !== id) }))
          }
        />
      ) : (
        <div className="admin__corps">
          <div className="admin__entete-liste">
            <p className="admin__message">
              {manifeste.pages.length === 0
                ? 'Aucune page pour le moment.'
                : `${manifeste.pages.length} page${manifeste.pages.length > 1 ? 's' : ''} — cet ordre est celui de l'écran d'accueil, de gauche à droite. Glissez une page par sa poignée ⠿, ou servez-vous des flèches.`}
            </p>
            <div className="admin__entete-boutons">
              <button
                type="button"
                className="abtn"
                title="Reprendre une page préparée sur un autre ordinateur"
                onClick={importer}
              >
                Importer une page
              </button>
              <button type="button" className="abtn" onClick={() => setAccueilOuvert(true)}>
                Écran d'accueil
              </button>
              <button type="button" className="abtn" onClick={() => setApparenceOuverte(true)}>
                Apparence
              </button>
              <button
                type="button"
                className="abtn"
                title="Code d'accès, fermeture de l'application"
                onClick={() => setReglagesOuverts(true)}
              >
                Réglages
              </button>
              <button
                type="button"
                className="abtn abtn--principal"
                onClick={() => setChoixModele(true)}
              >
                + Nouvelle page
              </button>
            </div>
          </div>

          {transfert ? (
            <p className="admin__message" role="status" aria-live="polite">
              {transfert}
            </p>
          ) : null}

          <ul className="admin__pages">
            {manifeste.pages.map((candidate, rang) => (
              <li
                key={candidate.id}
                data-page={candidate.id}
                className={`admin__page${glissee === candidate.id ? ' admin__page--glisse' : ''}`}
              >
                {suppression === candidate.id ? (
                  <>
                    <span className="admin__page-titre">
                      Supprimer «&nbsp;{candidate.titre}&nbsp;» ? Cette action est définitive.
                    </span>
                    <span className="admin__page-actions">
                      <button
                        type="button"
                        className="abtn abtn--danger"
                        onClick={() => supprimer(candidate.id)}
                      >
                        Supprimer
                      </button>
                      <button
                        type="button"
                        className="abtn abtn--discret"
                        onClick={() => setSuppression(null)}
                      >
                        Annuler
                      </button>
                    </span>
                  </>
                ) : (
                  <>
                    {/* Poignée de déplacement. Événements pointeur, jamais le
                        « drag and drop » du navigateur : celui-ci ne répond pas
                        au doigt. Même choix que dans l'éditeur de page. */}
                    <span
                      className="admin__poignee"
                      role="presentation"
                      title="Glisser pour changer l'ordre"
                      onPointerDown={(evenement) => {
                        evenement.preventDefault()
                        setGlissee(candidate.id)
                      }}
                    >
                      ⠿
                    </span>
                    <span className="admin__rang">{rang + 1}</span>
                    <button
                      type="button"
                      className="admin__page-titre admin__page-titre--lien"
                      onClick={() => setPageOuverte(candidate.id)}
                    >
                      {candidate.titre}
                    </button>
                    <span className="admin__page-modele">
                      {modelePar(candidate.modele)?.nom ?? candidate.modele}
                    </span>
                    <span className="admin__page-actions">
                      <button
                        type="button"
                        className="abtn abtn--icone"
                        aria-label="Monter cette page dans la liste"
                        title="Monter — la page avance dans l'accueil"
                        disabled={rang === 0}
                        onClick={() => deplacer(candidate.id, -1)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="abtn abtn--icone"
                        aria-label="Descendre cette page dans la liste"
                        title="Descendre — la page recule dans l'accueil"
                        disabled={rang === manifeste.pages.length - 1}
                        onClick={() => deplacer(candidate.id, 1)}
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="abtn"
                        onClick={() => setPageOuverte(candidate.id)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="abtn abtn--discret"
                        onClick={() => dupliquer(candidate.id)}
                      >
                        Dupliquer
                      </button>
                      <button
                        type="button"
                        className="abtn abtn--discret"
                        title="Déposer cette page sur une clé USB, pour un autre ordinateur"
                        onClick={() => exporter(candidate.id)}
                      >
                        Exporter
                      </button>
                      <button
                        type="button"
                        className="abtn abtn--discret"
                        onClick={() => setSuppression(candidate.id)}
                      >
                        Supprimer
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {choixModele ? (
        <div className="voile" role="dialog" aria-modal="true" aria-label="Choisir un modèle">
          <div className="voile__boite">
            <BoutonFermer surFermeture={() => setChoixModele(false)} libelle="Fermer" />
            <h2 className="voile__titre">Quel modèle pour la nouvelle page ?</h2>
            <ul className="modeles">
              {LISTE_MODELES.map((modele) => (
                <li key={modele.id}>
                  <button type="button" className="modele-carte" onClick={() => creer(modele.id)}>
                    {/* Aperçu de la mise en page : le modèle rendu « à vide »,
                        avec ses emplacements en attente. Même moteur que la
                        borne — la vignette montre exactement la structure. */}
                    <span className="modele-carte__apercu" aria-hidden="true">
                      <ToileBorne>
                        <RenduPage contenu={modele.contenuVide()} media={() => null} />
                      </ToileBorne>
                    </span>
                    <span className="modele-carte__nom">{modele.nom}</span>
                    <span className="modele-carte__description">{modele.description}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="pan__actions">
              <button
                type="button"
                className="abtn abtn--discret"
                onClick={() => setChoixModele(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {apparenceOuverte && manifeste ? (
        <div className="voile" role="dialog" aria-modal="true" aria-label="Apparence généralisée">
          <div className="voile__boite voile__boite--large">
            <BoutonFermer surFermeture={() => setApparenceOuverte(false)} libelle="Fermer" />
            <h2 className="voile__titre">Apparence généralisée</h2>
            <p className="voile__note">
              Les couleurs du fond et du texte de <strong>toutes</strong> les pages, écran
              d’accueil compris. Une page ou un accueil qui avait ses propres couleurs
              reprend celles-ci : c’est la dernière modification qui l’emporte. Pour n’en
              changer qu’une, ouvrez la page et servez-vous de « Apparence de la page ».
            </p>

            <div className="apparence">
              <div className="apparence__reglages">
                <div className="apparence__couleur">
                  <span className="champ__libelle">Couleur du fond</span>
                  <RoueCouleur
                    valeur={manifeste.reglages.couleurFond}
                    surChangement={(hex) => changerCouleur('couleurFond', hex)}
                  />
                </div>
                <div className="apparence__couleur">
                  <span className="champ__libelle">Couleur du texte</span>
                  <RoueCouleur
                    valeur={manifeste.reglages.couleurTexte}
                    surChangement={(hex) => changerCouleur('couleurTexte', hex)}
                  />
                </div>
                <p className="apparence__encart-note">
                  L'écran d'accueil peut ensuite recevoir des couleurs à lui, par son propre
                  bouton — elles resteront jusqu'à la prochaine apparence généralisée.
                </p>
              </div>

              {/* Aperçu vivant : il suit chaque réglage au fur et à mesure. */}
              {pageApercu ? (
                <div className="apparence__apercu">
                  <span className="apparence__etiquette">Aperçu d'une page</span>
                  <div className="apparence__toile" style={stylesCouleurs(manifeste.reglages)}>
                    <ToileBorne>
                      <RenduPage contenu={pageApercu as ContenuPage} media={apercuMedia} />
                    </ToileBorne>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pan__actions">
              <button type="button" className="abtn abtn--discret" onClick={retablirCouleurs}>
                Rétablir les couleurs d'origine
              </button>
              <button
                type="button"
                className="abtn abtn--principal"
                onClick={() => setApparenceOuverte(false)}
              >
                Terminé
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* L'écran d'accueil a son propre panneau : c'est le seul écran que tout
          visiteur voit, et il ne se règle pas comme une page — couleurs, image
          de fond, et image de présentation de chaque carte. Son aperçu est le
          composant de la borne lui-même, mis à l'échelle : il ne peut donc pas
          montrer autre chose que ce que verra le visiteur. */}
      {accueilOuvert && manifeste ? (
        <div className="voile" role="dialog" aria-modal="true" aria-label="Écran d'accueil">
          <div className="voile__boite voile__boite--large">
            <BoutonFermer surFermeture={() => setAccueilOuvert(false)} libelle="Fermer" />
            <h2 className="voile__titre">Écran d'accueil</h2>
            <p className="voile__note">
              Ce que voit le visiteur en arrivant, et ce qu'il retrouve après un moment sans
              contact : les mots, leur apparence, l'image de fond et l'image de chaque page.
              Ces réglages ne touchent que l'accueil.
            </p>

            <div className="apparence">
              <div className="apparence__reglages">
                <p className="apparence__encart-note">
                  {manifeste.reglages.hubCouleurFond || manifeste.reglages.hubCouleurTexte
                    ? "Couleurs propres à l'accueil. Les pages ne changent pas."
                    : "L'accueil suit les couleurs de la borne. Touchez une roue pour lui en donner d'autres."}
                </p>
                <div className="apparence__couleur">
                  <span className="champ__libelle">Couleur du fond</span>
                  <RoueCouleur
                    valeur={manifeste.reglages.hubCouleurFond ?? manifeste.reglages.couleurFond}
                    surChangement={(hex) => changerCouleur('hubCouleurFond', hex)}
                  />
                </div>
                <div className="apparence__couleur">
                  <span className="champ__libelle">Couleur du texte</span>
                  <RoueCouleur
                    valeur={manifeste.reglages.hubCouleurTexte ?? manifeste.reglages.couleurTexte}
                    surChangement={(hex) => changerCouleur('hubCouleurTexte', hex)}
                  />
                </div>
                {/* Ce qui est écrit sur l'accueil, avant l'apparence : on
                    change les mots, puis on les habille. */}
                <div className="apparence__couleur apparence__champ">
                  <label className="champ__libelle" htmlFor="hub-titre">
                    Grand titre — texte
                  </label>
                  <input
                    id="hub-titre"
                    value={manifeste.reglages.titreVeille}
                    maxLength={80}
                    onChange={(evenement) => changerTexteHub('titreVeille', evenement.target.value)}
                  />
                </div>
                <div className="apparence__couleur apparence__champ">
                  <label className="champ__libelle" htmlFor="hub-sous-titre">
                    Sous-titre — texte
                  </label>
                  <input
                    id="hub-sous-titre"
                    value={manifeste.reglages.sousTitreVeille}
                    maxLength={140}
                    onChange={(evenement) =>
                      changerTexteHub('sousTitreVeille', evenement.target.value)
                    }
                  />
                </div>

                {/* Les trois textes de l'accueil. Rien n'est écrit tant qu'on
                    n'y touche pas : l'accueil garde son apparence d'origine. */}
                <ReglageTexteHub
                  libelle="Grand titre"
                  couleur={manifeste.reglages.hubTitreCouleur}
                  couleurDefaut={couleursHub(manifeste.reglages).couleurTexte}
                  taille={manifeste.reglages.hubTitreTaille}
                  surCouleur={(hex) => changerCouleur('hubTitreCouleur', hex)}
                  surTaille={(pourcent) => changerTailleHub('hubTitreTaille', pourcent)}
                />
                <ReglageTexteHub
                  libelle="Sous-titre"
                  couleur={manifeste.reglages.hubSousTitreCouleur}
                  couleurDefaut={ACCENT_ORIGINE}
                  taille={manifeste.reglages.hubSousTitreTaille}
                  surCouleur={(hex) => changerCouleur('hubSousTitreCouleur', hex)}
                  surTaille={(pourcent) => changerTailleHub('hubSousTitreTaille', pourcent)}
                />

                {/* La barre de titre au bas de chaque carte : elle a en plus un
                    fond, celui de la carte tant qu'on ne lui en donne pas. */}
                <div className="apparence__couleur">
                  <span className="champ__libelle">Barre de titre des cartes — fond</span>
                  <RoueCouleur
                    valeur={manifeste.reglages.hubNomFond ?? couleursHub(manifeste.reglages).couleurFond}
                    surChangement={(hex) => changerCouleur('hubNomFond', hex)}
                  />
                </div>
                <ReglageTexteHub
                  libelle="Barre de titre des cartes — texte"
                  couleur={manifeste.reglages.hubNomCouleur}
                  couleurDefaut={couleursHub(manifeste.reglages).couleurTexte}
                  taille={manifeste.reglages.hubNomTaille}
                  surCouleur={(hex) => changerCouleur('hubNomCouleur', hex)}
                  surTaille={(pourcent) => changerTailleHub('hubNomTaille', pourcent)}
                />

                <button type="button" className="abtn abtn--discret" onClick={retablirCouleursHub}>
                  Remettre l’apparence d’origine
                </button>

                {/* Retour automatique. Le réglage vivait dans le fichier de
                    contenu sans que personne puisse le voir : il se règle ici. */}
                <div className="apparence__couleur">
                  <label className="champ__libelle" htmlFor="veille">
                    Revenir à l'accueil après
                  </label>
                  <div className="apparence__veille">
                    <input
                      id="veille"
                      type="number"
                      min={1}
                      max={60}
                      value={manifeste.reglages.minutesAvantVeille}
                      onChange={(evenement) => changerVeille(evenement.target.value)}
                    />
                    <span>minutes</span>
                  </div>
                  <p className="apparence__encart-note">
                    Sans que personne ne touche l'écran, la page ouverte se referme sur
                    l'accueil : le visiteur suivant ne tombe pas au milieu de la lecture d'un
                    autre. Une vidéo en cours de lecture repousse le retour.
                  </p>
                </div>

                {/* Image de fond de tout l'écran d'accueil. */}
                <div className="apparence__couleur">
                  <span className="champ__libelle">Image de fond</span>
                  <div className="apparence__image">
                    <span className="apparence__miniature">
                      {imageFond ? (
                        <img src={imageFond.url('moyen')} alt="" />
                      ) : (
                        <span aria-hidden="true">◈</span>
                      )}
                    </span>
                    <button type="button" className="abtn" onClick={choisirImageFond}>
                      {imageFond ? "Changer l'image" : 'Choisir une image'}
                    </button>
                    {imageFond ? (
                      <button type="button" className="abtn abtn--discret" onClick={retirerImageFond}>
                        Retirer
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Image de présentation de chaque page sur sa carte. Sans
                    choix, c'est la première image de la page qui sert. */}
                <div className="apparence__couleur">
                  <span className="champ__libelle">Image de chaque page</span>
                  <ul className="apparence__vignettes">
                    {manifeste.pages.map((candidate) => (
                      <li key={candidate.id} className="apparence__image">
                        <span className="apparence__miniature">
                          <ApercuPage page={candidate} media={apercuMedia} />
                        </span>
                        <span className="apparence__image-nom">{candidate.titre}</span>
                        <button
                          type="button"
                          className="abtn"
                          onClick={() => choisirVignette(candidate.id)}
                        >
                          {candidate.vignette ? 'Changer' : 'Choisir'}
                        </button>
                        {candidate.vignette ? (
                          <button
                            type="button"
                            className="abtn abtn--discret"
                            onClick={() => retirerVignette(candidate.id)}
                          >
                            Automatique
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="apparence__apercu">
                <span className="apparence__etiquette">Aperçu de l'accueil</span>
                <div
                  className="apparence__toile apparence__toile--accueil"
                  style={stylesCouleurs(couleursHub(manifeste.reglages))}
                >
                  {/* Même classe que la borne : l'aperçu doit montrer l'accueil
                      tel qu'il sera, gouttières comprises. */}
                  <ToileBorne className="toile--accueil">
                    <Accueil manifeste={manifeste} media={apercuMedia} />
                  </ToileBorne>
                </div>
              </div>
            </div>

            <div className="pan__actions">
              <button
                type="button"
                className="abtn abtn--principal"
                onClick={() => setAccueilOuvert(false)}
              >
                Terminé
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Réglages de la borne : ce qui ne se voit pas à l'écran d'accueil.
          La fermeture de l'application y est **à part**, dans son propre
          encart : dans la barre du haut, elle voisinait « Fermer », qui ne fait
          que revenir à la borne — on fermait l'application en croyant fermer le
          menu. */}
      {reglagesOuverts && manifeste ? (
        <div className="voile" role="dialog" aria-modal="true" aria-label="Réglages">
          <div className="voile__boite">
            <BoutonFermer
              surFermeture={() => {
                setReglagesOuverts(false)
                setPinSaisi(null)
              }}
              libelle="Fermer"
            />
            <h2 className="voile__titre">Réglages</h2>
            <p className="voile__note">
              Ce qui ne se voit pas à l'écran : le code qui ouvre l'administration, et la
              fermeture de la borne.
            </p>

            <div className="apparence__reglages">
              <div className="apparence__couleur apparence__champ apparence__champ--court">
                <label className="champ__libelle" htmlFor="pin-admin">
                  Code d’accès à l’administration
                </label>
                <input
                  id="pin-admin"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pinSaisi ?? manifeste.reglages.pinAdmin}
                  onChange={(evenement) => changerPin(evenement.target.value)}
                />
                <p className="apparence__encart-note">
                  {(pinSaisi ?? manifeste.reglages.pinAdmin).length === 4
                    ? 'Quatre chiffres, demandés après l’appui de 5 secondes dans le coin de l’écran. Notez-le : sans lui, on n’entre plus dans l’administration.'
                    : 'Il manque des chiffres : le code n’est pas encore enregistré. Tant qu’il n’en compte pas quatre, l’ancien reste en vigueur.'}
                </p>
                <p className="apparence__encart-note">
                  Ce code écarte un visiteur curieux, ce n’est pas une sécurité :
                  il est écrit en clair dans le fichier de contenu.
                </p>
              </div>

              <div className="reglages__sortie">
                <span className="champ__libelle">Fermer l’application</span>
                <p className="apparence__encart-note">
                  Enregistre les modifications, puis ferme la borne. Il faudra la relancer
                  depuis le bureau de Windows. Pour seulement revenir à l’affichage visiteur,
                  utilisez « Fermer » en haut de l’écran.
                </p>
                <button type="button" className="abtn abtn--danger" onClick={quitter}>
                  Enregistrer et fermer l’application
                </button>
              </div>
            </div>

            <div className="pan__actions">
              <button
                type="button"
                className="abtn abtn--principal"
                onClick={() => {
                  setReglagesOuverts(false)
                  setPinSaisi(null)
                }}
              >
                Terminé
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Clavier à l'écran : la salle n'a pas de clavier physique. Monté une
          seule fois ici, il sert tous les champs de l'administration — liste
          des pages, éditeur, panneaux — sans que chacun ait à s'en occuper. */}
      <ClavierTactile />
    </div>
  )
}
