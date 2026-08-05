import { Fragment, useMemo, useState, type ReactNode } from 'react'
import {
  COLONNES_GRILLE,
  COLONNES_MIN,
  HAUTEUR_MAX,
  HAUTEUR_MIN,
  colonnesDe,
  controlerContenu,
  DEFS_BLOCS_LIBRES,
  lireSuite,
  modelePar,
  positionBloc,
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

  const ajouterBloc = (type: TypeBlocLibre) => {
    const bloc: BlocLibre = {
      id: crypto.randomUUID(),
      // Un nouveau bloc naît en bas de page ; les flèches le remontent ensuite,
      // y compris entre les blocs du modèle.
      apres: modele?.sections[modele.sections.length - 1]?.nom,
      valeur: valeurNeuve(type),
    }
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage
      return {
        ...precedente,
        contenu: { ...contenuPage, suite: [...lireSuite(contenuPage), bloc] },
      }
    })
    setAjoutOuvert(false)
    setSelection(`suite:${bloc.id}`)
  }

  const retirerBloc = (id: string) => {
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage
      return {
        ...precedente,
        contenu: {
          ...contenuPage,
          suite: lireSuite(contenuPage).filter((bloc) => bloc.id !== id),
        },
      }
    })
    setRetraitEnCours(null)
    if (selection === `suite:${id}`) setSelection(null)
  }

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

  /** Hauteur d'une image ou d'une galerie, en pixels de toile. */
  const redimensionnerHauteur = (cle: string, hauteur: number) => {
    const borne = Math.min(HAUTEUR_MAX, Math.max(HAUTEUR_MIN, Math.round(hauteur)))
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage

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
   * Déplace un bloc dans l'ordre réel de la page : d'abord au sein de son
   * groupe, puis — arrivé au bord — il saute dans la section voisine,
   * par-dessus le bloc du modèle. Les groupes sont ensuite remis à plat, avec
   * l'ancre « apres » de chaque bloc normalisée.
   */
  const deplacerBloc = (id: string, sens: -1 | 1) => {
    surModification((precedente) => {
      const contenuPage = precedente.contenu as ContenuPage
      const noms = (modele?.sections ?? []).map((section) => section.nom)
      const groupes = noms.map((nom) => ({ nom, blocs: [] as BlocLibre[] }))
      const dernier = groupes[groupes.length - 1]
      if (!dernier) return precedente

      for (const bloc of lireSuite(contenuPage)) {
        const position = positionBloc(bloc, noms)
        ;(groupes.find((groupe) => groupe.nom === position) ?? dernier).blocs.push(bloc)
      }

      const indexGroupe = groupes.findIndex((groupe) =>
        groupe.blocs.some((bloc) => bloc.id === id),
      )
      const groupe = groupes[indexGroupe]
      if (!groupe) return precedente
      const indexBloc = groupe.blocs.findIndex((bloc) => bloc.id === id)
      const [bloc] = groupe.blocs.splice(indexBloc, 1)
      if (!bloc) return precedente

      if (sens === -1) {
        if (indexBloc > 0) groupe.blocs.splice(indexBloc - 1, 0, bloc)
        else if (indexGroupe > 0) groupes[indexGroupe - 1]?.blocs.push(bloc)
        else groupe.blocs.splice(indexBloc, 0, bloc)
      } else {
        if (indexBloc < groupe.blocs.length) groupe.blocs.splice(indexBloc + 1, 0, bloc)
        else if (indexGroupe < groupes.length - 1) groupes[indexGroupe + 1]?.blocs.unshift(bloc)
        else groupe.blocs.push(bloc)
      }

      const suite = groupes.flatMap((g) => g.blocs.map((b) => ({ ...b, apres: g.nom })))
      return { ...precedente, contenu: { ...contenuPage, suite } }
    })
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

  // Enveloppe des blocs dans l'aperçu : un liseré au survol, une étiquette avec
  // le nom du bloc, et un clic qui le sélectionne dans le panneau de droite.
  const enveloppe: EnveloppeEmplacement = (info, defaut) => {
    const def = defPour(info.nom)
    if (!def) return defaut

    const actif = selection === info.nom
    const enProbleme = problemes.some(
      (probleme) => probleme.emplacement === info.nom && probleme.gravite === 'bloquant',
    )

    return (
      <div
        className={`emp${actif ? ' emp--actif' : ''}${enProbleme ? ' emp--probleme' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={`Modifier : ${def.libelle}`}
        onClick={(evenement) => {
          evenement.stopPropagation()
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
  const nomsSections = modele.sections.map((section) => section.nom)
  const groupes = modele.sections.map((section) => ({
    section,
    blocs: suite.filter((bloc) => positionBloc(bloc, nomsSections) === section.nom),
  }))

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
          {groupes.map(({ section, blocs }, indexGroupe) => (
            <Fragment key={section.nom}>
              {section.emplacements.map((nom) => {
                const def = modele.emplacements[nom]
                if (!def) return null
                return (
                  <li key={nom}>
                    <button
                      type="button"
                      className={`pan__bloc${selection === nom ? ' pan__bloc--actif' : ''}`}
                      onClick={() => setSelection(selection === nom ? null : nom)}
                    >
                      <span className="pan__bloc-libelle">{def.libelle}</span>
                      <span className="pan__bloc-resume">
                        {resumeBloc(contenu.emplacements[nom])}
                      </span>
                    </button>
                  </li>
                )
              })}
              {blocs.map((bloc, indexBloc) => {
                const nom = `suite:${bloc.id}`
                return (
                  <li key={bloc.id} className="pan__ligne pan__ligne--ajoutee">
                    {retraitEnCours === bloc.id ? (
                      <>
                        <span className="pan__retrait">Retirer ce bloc ?</span>
                        <button
                          type="button"
                          className="abtn abtn--danger"
                          onClick={() => retirerBloc(bloc.id)}
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
                        <button
                          type="button"
                          className={`pan__bloc${selection === nom ? ' pan__bloc--actif' : ''}`}
                          onClick={() => setSelection(selection === nom ? null : nom)}
                        >
                          <span className="pan__bloc-libelle">
                            {DEFS_BLOCS_LIBRES[bloc.valeur.type].libelle}
                          </span>
                          <span className="pan__bloc-resume">{resumeBloc(bloc.valeur)}</span>
                        </button>
                        <button
                          type="button"
                          className="abtn abtn--mini"
                          aria-label="Monter ce bloc"
                          disabled={indexGroupe === 0 && indexBloc === 0}
                          onClick={() => deplacerBloc(bloc.id, -1)}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="abtn abtn--mini"
                          aria-label="Descendre ce bloc"
                          disabled={
                            indexGroupe === groupes.length - 1 &&
                            indexBloc === blocs.length - 1
                          }
                          onClick={() => deplacerBloc(bloc.id, 1)}
                        >
                          ▼
                        </button>
                        {/* Équivalent au clavier de la poignée de l'aperçu :
                            passe d'une largeur courante à la suivante. Le
                            glissement ne doit jamais être le seul moyen. */}
                        <button
                          type="button"
                          className={`abtn abtn--mini${
                            colonnesDe(bloc) < COLONNES_GRILLE ? ' abtn--actif' : ''
                          }`}
                          aria-label={`Largeur : ${libelleLargeur(colonnesDe(bloc))}. Changer.`}
                          title={`Largeur : ${libelleLargeur(colonnesDe(bloc))}`}
                          onClick={() => {
                            const actuelle = colonnesDe(bloc)
                            const rang = PALIERS.indexOf(actuelle)
                            const suivante =
                              PALIERS[(rang === -1 ? 0 : rang + 1) % PALIERS.length]!
                            // Même clé que la poignée de l'aperçu : sans le
                            // préfixe, la largeur partirait dans « largeurs »
                            // (réservé aux emplacements) au lieu du bloc.
                            redimensionnerBloc(`suite:${bloc.id}`, suivante)
                          }}
                        >
                          {colonnesDe(bloc) === COLONNES_GRILLE ? '▭' : '◧'}
                        </button>
                        <button
                          type="button"
                          className="abtn abtn--mini abtn--danger"
                          aria-label="Retirer ce bloc"
                          onClick={() => setRetraitEnCours(bloc.id)}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </Fragment>
          ))}
        </ul>

        {suite.length === 0 ? (
          <p className="pan__aide">
            Ajoutez du texte, une photo ou une galerie : le bloc se place en bas de page, puis
            les flèches ▲▼ le déplacent — y compris entre les blocs du modèle.
          </p>
        ) : null}

        {ajoutOuvert ? (
          <div className="pan__actions" role="group" aria-label="Type de bloc à ajouter">
            <button type="button" className="abtn" onClick={() => ajouterBloc('texte')}>
              Texte
            </button>
            <button type="button" className="abtn" onClick={() => ajouterBloc('image')}>
              Photo
            </button>
            <button type="button" className="abtn" onClick={() => ajouterBloc('galerie')}>
              Galerie
            </button>
            <button type="button" className="abtn" onClick={() => ajouterBloc('video')}>
              Vidéo
            </button>
            <button type="button" className="abtn" onClick={() => ajouterBloc('quiz')}>
              Quiz
            </button>
            <button type="button" className="abtn" onClick={() => ajouterBloc('frise')}>
              Frise
            </button>
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
