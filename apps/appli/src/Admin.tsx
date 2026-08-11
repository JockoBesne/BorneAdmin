import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LISTE_MODELES,
  modelePar,
  REGLAGES_DEFAUT,
  type ContenuPage,
  type IdModele,
  type Manifeste,
  type PageManifeste,
} from '@borne/contenu'
import { RenduPage, ToileBorne, type ResoudreMedia } from '@borne/contenu/rendu'
import { Accueil, ApercuPage } from './Accueil.jsx'
import { ClavierTactile } from './ClavierTactile.jsx'
import { chargerContenu, enregistrerContenu, importerMedia, resolveurMedias } from './contenu.js'
import { couleursHub, stylesCouleurs } from './couleurs.js'
import { EditeurPage } from './EditeurPage.jsx'
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

const TEXTES_ETAT: Record<EtatEnregistrement, string> = {
  repos: '',
  modifications: 'Modifications…',
  ecriture: 'Enregistrement…',
  enregistre: '✓ Enregistré',
  echec: '⚠ Échec de l’enregistrement — nouvel essai à la prochaine modification',
}

export function Admin({ surFermeture }: { surFermeture: () => void }) {
  const [manifeste, setManifeste] = useState<Manifeste | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [pageOuverte, setPageOuverte] = useState<string | null>(null)
  const [choixModele, setChoixModele] = useState(false)
  const [apparenceOuverte, setApparenceOuverte] = useState(false)
  const [accueilOuvert, setAccueilOuvert] = useState(false)
  const [suppression, setSuppression] = useState<string | null>(null)
  /** Page en cours de glissement dans la liste, s'il y en a une. */
  const [glissee, setGlissee] = useState<string | null>(null)
  const [etat, setEtat] = useState<EtatEnregistrement>('repos')
  const sale = useRef(false)

  // Historique : les états d'avant, et ceux qu'on vient d'annuler. Le contenu
  // d'un musée tient largement en mémoire — pas besoin de ruser.
  const passe = useRef<Manifeste[]>([])
  const futur = useRef<Manifeste[]>([])
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
      const dejaEmpile = passe.current[passe.current.length - 1] === precedent
      if (!dejaEmpile && maintenant - derniereEtape.current >= REGROUPEMENT_MS) {
        passe.current = [...passe.current, precedent].slice(-PAS_MAX)
      }
      derniereEtape.current = maintenant
      // Repartir d'une modification efface le futur : on ne rétablit que ce
      // qu'on vient d'annuler, jamais une branche abandonnée.
      futur.current = []
      return suivant
    })
  }, [])

  /**
   * Revient à l'état précédent (ou repart en avant). Le contenu est tenu en un
   * seul exemplaire : un pas d'historique est donc simplement le manifeste
   * entier, tel qu'il était. Simple, et sûr — rien ne peut se désynchroniser.
   */
  const parcourir = (sens: 'arriere' | 'avant') => {
    const source = sens === 'arriere' ? passe : futur
    const destination = sens === 'arriere' ? futur : passe
    const etape = source.current[source.current.length - 1]
    if (!etape) return

    source.current = source.current.slice(0, -1)
    if (manifeste) destination.current = [...destination.current, manifeste]
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

  // À la fermeture, une modification encore en attente est écrite avant de
  // rendre l'écran au visiteur — qui recharge le contenu en revenant.
  const fermer = () => {
    const fin =
      sale.current && manifeste
        ? enregistrerContenu(manifeste).catch(() => {})
        : Promise.resolve()
    sale.current = false
    void fin.then(surFermeture)
  }

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
    champ: 'couleurFond' | 'couleurTexte' | 'hubCouleurFond' | 'hubCouleurTexte',
    hex: string,
  ) => modifier((m) => ({ ...m, reglages: { ...m.reglages, [champ]: hex } }))

  // Retire les couleurs propres à l'accueil : il reprend alors celles de la
  // borne. « undefined » disparaît du fichier à l'écriture.
  const retablirCouleursHub = () =>
    modifier((m) => ({
      ...m,
      reglages: { ...m.reglages, hubCouleurFond: undefined, hubCouleurTexte: undefined },
    }))

  const retablirCouleurs = () =>
    modifier((m) => ({
      ...m,
      reglages: {
        ...m.reglages,
        couleurFond: REGLAGES_DEFAUT.couleurFond,
        couleurTexte: REGLAGES_DEFAUT.couleurTexte,
      },
    }))

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
          disabled={passe.current.length === 0}
          onClick={annuler}
        >
          ↶ Annuler
        </button>
        <button
          type="button"
          className="admin__histoire"
          aria-label="Rétablir la modification annulée (Ctrl + Y)"
          title="Rétablir (Ctrl + Y)"
          disabled={futur.current.length === 0}
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
              <button type="button" className="abtn" onClick={() => setAccueilOuvert(true)}>
                Écran d'accueil
              </button>
              <button type="button" className="abtn" onClick={() => setApparenceOuverte(true)}>
                Apparence
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
            <h2 className="voile__titre">Apparence généralisée</h2>

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
                  Ces couleurs valent pour les pages. L'écran d'accueil se règle à part, par
                  son propre bouton.
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
            <h2 className="voile__titre">Écran d'accueil</h2>

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
                <button type="button" className="abtn abtn--discret" onClick={retablirCouleursHub}>
                  Remettre les couleurs de la borne
                </button>

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
                  <ToileBorne>
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

      {/* Clavier à l'écran : la salle n'a pas de clavier physique. Monté une
          seule fois ici, il sert tous les champs de l'administration — liste
          des pages, éditeur, panneaux — sans que chacun ait à s'en occuper. */}
      <ClavierTactile />
    </div>
  )
}
