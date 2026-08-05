import {
  Fragment,
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
  HAUTEUR_MAX,
  HAUTEUR_MIN,
  colonnesDe,
  controlerContenu,
  DEFS_BLOCS_LIBRES,
  estStyleVide,
  lignesDeTexte,
  lireStyle,
  lireSuite,
  modelePar,
  positionBloc,
  sansMiseEnForme,
  texteBrut,
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
import { importerMedia, resolveurMedias } from './contenu.js'
import { couleursEffectives, stylesCouleurs, type Couleurs } from './couleurs.js'
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
        contenu: sansStylesVides({
          ...contenuPage,
          suite: lireSuite(contenuPage).filter((bloc) => bloc.id !== id),
          // L'habillage du bloc part avec lui : sans cela il resterait dans le
          // fichier sans plus rien à habiller.
          styles: sansEntree(contenuPage.styles, `suite:${id}`),
        }),
      }
    })
    setRetraitEnCours(null)
    if (selection === `suite:${id}`) setSelection(null)
  }

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

  // La page dans son ordre réel : chaque section du modèle, puis les blocs
  // ajoutés qui la suivent. C'est ce plan que le panneau affiche.
  const nomsSections = modele.sections.map((section) => section.nom)
  const groupes = modele.sections.map((section) => ({
    section,
    blocs: suite.filter((bloc) => positionBloc(bloc, nomsSections) === section.nom),
  }))

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
        def={def}
        valeur={valeur}
        style={lireStyle(contenu, nom) ?? {}}
        couleursPage={couleursPage}
        resoudre={resoudre}
        surContenu={(transformation) => modifierEmplacement(nom, transformation)}
        surStyle={(transformation) => modifierStyle(nom, transformation)}
        surChoisirMedia={(type) => setSelecteur({ nom, type })}
        surFermeture={() => setSelection(null)}
      />
    )
  }

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
                    {editionDuBloc(nom)}
                  </li>
                )
              })}
              {blocs.map((bloc, indexBloc) => {
                const nom = `suite:${bloc.id}`
                return (
                  <li key={bloc.id} className="pan__ligne--ajoutee">
                    <div className="pan__ligne">
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
                    </div>
                    {editionDuBloc(nom)}
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

/** Retire une entrée du rangement des habillages, sans toucher à l'original. */
function sansEntree(
  styles: Record<string, StyleBloc> | undefined,
  nom: string,
): Record<string, StyleBloc> {
  const copie = { ...(styles ?? {}) }
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
 * La barre de mise en forme n'est pas posée ici : elle est confiée au
 * formulaire, qui la remet à « ChampMisEnForme » — le composant qui réunit un
 * champ texte et sa barre. Un bloc sans champ texte n'a donc pas de barre.
 */
function PanneauBloc({
  def,
  valeur,
  style,
  couleursPage,
  resoudre,
  surContenu,
  surStyle,
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

      <FormulaireBloc
        def={def}
        valeur={valeur}
        resoudre={resoudre}
        commandesTexte={commandesTexte}
        barre={
          <BarreMiseEnForme
            style={style}
            couleursPage={couleursPage}
            texteRiche={texteRiche}
            commandesTexte={commandesTexte}
            surStyle={surStyle}
          />
        }
        surChangement={surContenu}
        surChoisirMedia={surChoisirMedia}
      />
    </div>
  )
}

/**
 * La barre de mise en forme d'un bloc, faite pour être posée **juste au-dessus
 * d'un champ texte** : gras, italique, souligné | alignement | couleur du texte,
 * couleur du fond du bloc.
 *
 * Les réglages portent sur le bloc entier — c'est pourquoi le fond s'appelle
 * « couleur du fond du bloc ». Seuls G / I / S font exception sur un bloc de
 * texte, où ils s'appliquent au morceau sélectionné.
 *
 * Les deux disques de couleur ne sont pas montrés d'emblée : côte à côte ils
 * feraient plus de cinq cents pixels de haut, et le champ serait rejeté hors de
 * l'écran. On ouvre celui dont on a besoin.
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
      return copie
    })

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
              style={{ backgroundColor: style.fond ?? 'transparent' }}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {roue ? (
        <div className="perso__roue">
          <RoueCouleur valeur={couleurRoue} surChangement={(hex) => changerCouleur(roue, hex)} />
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
 * Un champ texte et sa barre de mise en forme, réunis en un seul composant.
 *
 * La barre ne s'obtient qu'en passant par ici : là où il n'y a pas de champ
 * texte — une galerie, un quiz, une frise, une photo pas encore choisie — il n'y
 * a donc pas de barre, sans qu'on ait à y penser.
 *
 * Un « div » et non un « label » : un libellé désigne son premier élément de
 * formulaire, qui serait ici un bouton de la barre — cliquer le libellé
 * enfoncerait une commande de mise en forme. Les saisies portent donc leur
 * libellé par « aria-label ».
 */
function ChampMisEnForme({
  libelle,
  barre,
  compte,
  children,
}: {
  libelle: string
  barre: ReactNode
  /** Compteur de signes, sous le champ. Absent quand il n'y a rien à compter. */
  compte?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="champ">
      <span className="champ__libelle">{libelle}</span>
      {barre}
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
  resoudre,
  commandesTexte,
  barre,
  surChangement,
  surChoisirMedia,
}: {
  def: DefEmplacement
  valeur: ValeurEmplacement
  resoudre: ResoudreMedia
  /** Boîte par laquelle les boutons G I S atteignent le texte sélectionné. */
  commandesTexte: RefObject<CommandesTexteRiche | null>
  /**
   * La barre de mise en forme. Elle ne se pose pas à la main : on la confie à
   * « ChampMisEnForme », qui la place contre son champ. Les formulaires sans
   * champ texte (galerie, quiz, frise) ne s'en servent tout simplement pas.
   */
  barre: ReactNode
  surChangement: (transformation: (valeur: ValeurEmplacement) => ValeurEmplacement) => void
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
          barre={barre}
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
          barre={barre}
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
          <ChampMisEnForme libelle="Légende" barre={barre}>
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
