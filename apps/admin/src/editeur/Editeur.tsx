import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  estPubliable,
  modelePar,
  type ContenuPage,
  type Probleme,
  type ValeurEmplacement,
} from '@borne/contenu'
import { RenduPage, ToileBorne, type EnveloppeEmplacement, type ResoudreMedia } from '@borne/contenu/rendu'
import { Bandeau, Bouton, Confirmation, useNotifications } from '@borne/ui'
import { clientApi, ErreurApi, type Media, type PageComplete } from '../api.js'
import { heure } from '../formats.js'
import { ChampEnPlace } from './ChampEnPlace.jsx'
import { PanneauBloc } from './PanneauBloc.jsx'
import { SelecteurMedia } from './SelecteurMedia.jsx'
import { useBrouillon } from './useBrouillon.js'

export function Editeur() {
  const { id } = useParams<{ id: string }>()
  const naviguer = useNavigate()
  const { montrer } = useNotifications()

  const [page, setPage] = useState<PageComplete | null>(null)
  const [contenu, setContenu] = useState<ContenuPage | null>(null)
  const [medias, setMedias] = useState<Media[]>([])
  const [selection, setSelection] = useState<string | null>(null)
  const [edition, setEdition] = useState(false)
  const [apercu, setApercu] = useState(false)
  const [selecteur, setSelecteur] = useState<{ nom: string; type: 'image' | 'video' } | null>(null)
  const [aPublier, setAPublier] = useState(false)
  const [publication, setPublication] = useState(false)
  const [erreurChargement, setErreurChargement] = useState<string | null>(null)

  const brouillon = useBrouillon(id)
  const { initialiser, planifier, problemes } = brouillon

  // ── Chargement ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    let annule = false

    Promise.all([clientApi.page(id), clientApi.medias()])
      .then(([chargee, listeMedias]) => {
        if (annule) return
        setPage(chargee)
        setContenu(chargee.contenuBrouillon)
        setMedias(listeMedias)
        initialiser(chargee.modifieeLe, chargee.problemes)
      })
      .catch((cause: unknown) => {
        if (!annule) {
          setErreurChargement(
            cause instanceof ErreurApi ? cause.message : "Cette page n'a pas pu être ouverte.",
          )
        }
      })

    return () => {
      annule = true
    }
  }, [id, initialiser])

  // ── Enregistrement automatique ─────────────────────────────────────────────
  const titre = useMemo(() => {
    if (!contenu) return ''
    const valeur = contenu.emplacements['titre']
    return valeur && valeur.type === 'titre' && valeur.valeur.trim() !== ''
      ? valeur.valeur
      : (page?.titre ?? 'Sans titre')
  }, [contenu, page])

  useEffect(() => {
    if (!contenu) return
    return planifier(titre, contenu)
  }, [contenu, titre, planifier])

  // ── Modification du contenu ────────────────────────────────────────────────
  const modifier = useCallback(
    (nom: string, transformation: (valeur: ValeurEmplacement) => ValeurEmplacement) => {
      setContenu((precedent) => {
        if (!precedent) return precedent
        const valeur = precedent.emplacements[nom]
        if (!valeur) return precedent
        return {
          ...precedent,
          emplacements: { ...precedent.emplacements, [nom]: transformation(valeur) },
        }
      })
    },
    [],
  )

  const changerTexte = useCallback(
    (nom: string, texte: string) =>
      modifier(nom, (valeur) =>
        valeur.type === 'titre' || valeur.type === 'texte' ? { ...valeur, valeur: texte } : valeur,
      ),
    [modifier],
  )

  const changerLegende = useCallback(
    (nom: string, legende: string, index?: number) =>
      modifier(nom, (valeur) => {
        if (valeur.type === 'galerie' && index !== undefined) {
          const elements = valeur.elements.map((element, position) =>
            position === index ? { ...element, legende } : element,
          )
          return { ...valeur, elements }
        }
        if (valeur.type === 'image' || valeur.type === 'video') return { ...valeur, legende }
        return valeur
      }),
    [modifier],
  )

  const choisirMedia = useCallback(
    (nom: string, media: Media) => {
      modifier(nom, (valeur) => {
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
      setMedias((precedent) =>
        precedent.some((element) => element.id === media.id) ? precedent : [media, ...precedent],
      )
      setSelecteur(null)
    },
    [modifier],
  )

  const retirerMedia = useCallback(
    (nom: string) =>
      modifier(nom, (valeur) =>
        valeur.type === 'image' || valeur.type === 'video'
          ? { ...valeur, mediaId: null, legende: '' }
          : valeur,
      ),
    [modifier],
  )

  const retirerGalerie = useCallback(
    (nom: string, index: number) =>
      modifier(nom, (valeur) =>
        valeur.type === 'galerie'
          ? { ...valeur, elements: valeur.elements.filter((_, position) => position !== index) }
          : valeur,
      ),
    [modifier],
  )

  // ── Résolution des médias pour le rendu ────────────────────────────────────
  const parId = useMemo(() => new Map(medias.map((media) => [media.id, media])), [medias])

  const resoudre = useCallback<ResoudreMedia>(
    (mediaId) => {
      if (!mediaId) return null
      const media = parId.get(mediaId)
      if (!media) return null
      return {
        id: media.id,
        type: media.type,
        legende: media.legende,
        url: (profil) => media.urls[profil],
        poster: media.urls.poster,
        pointFocal: media.pointFocal,
        largeur: media.largeur,
        hauteur: media.hauteur,
      }
    },
    [parId],
  )

  // ── Publication ────────────────────────────────────────────────────────────
  const publier = async () => {
    if (!id || !contenu) return
    setPublication(true)
    try {
      // On force l'enregistrement du brouillon avant de publier : ce qui part
      // sur la borne est exactement ce que l'utilisateur voit à l'écran.
      await brouillon.enregistrer(titre, contenu)
      await clientApi.mettreEnLigne(id)
      const rafraichie = await clientApi.page(id)
      setPage(rafraichie)
      setAPublier(false)
      montrer({
        message: 'Publié. La borne se mettra à jour d’ici une minute.',
        variante: 'succes',
      })
    } catch (cause) {
      if (cause instanceof ErreurApi && cause.code === 'CONTENU_INCOMPLET') {
        setAPublier(false)
        setApercu(true)
        montrer({ message: cause.message, variante: 'erreur' })
      } else {
        montrer({
          message: cause instanceof ErreurApi ? cause.message : 'La publication a échoué.',
          variante: 'erreur',
        })
      }
    } finally {
      setPublication(false)
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  if (erreurChargement) {
    return (
      <div className="plein-centre">
        <Bandeau variante="erreur">{erreurChargement}</Bandeau>
        <Bouton variante="secondaire" onClick={() => naviguer('/pages')}>
          Retour aux pages
        </Bouton>
      </div>
    )
  }

  if (!page || !contenu) {
    return (
      <div className="plein-centre">
        <p className="plein-centre__texte">Ouverture de la page…</p>
      </div>
    )
  }

  const modele = modelePar(contenu.modele)
  if (!modele) {
    return (
      <div className="plein-centre">
        <Bandeau variante="erreur">Le modèle de cette page est inconnu.</Bandeau>
      </div>
    )
  }

  const bloquants = problemes.filter((probleme) => probleme.gravite === 'bloquant')

  const enveloppe: EnveloppeEmplacement = (info, defaut) => {
    if (apercu) return defaut

    const valeur = contenu.emplacements[info.nom]
    const def = modele.emplacements[info.nom]
    if (!def) return defaut

    const actif = selection === info.nom
    const enEdition = actif && edition && (info.type === 'titre' || info.type === 'texte')

    if (enEdition && valeur && (valeur.type === 'titre' || valeur.type === 'texte')) {
      const max = def.type === 'titre' || def.type === 'texte' ? def.maxSignes : 200
      return (
        <div className="emp emp--actif emp--edition">
          <ChampEnPlace
            valeur={valeur.valeur}
            classe={info.classe}
            max={max}
            multiligne={info.type === 'texte'}
            avecBarreOutils={info.type === 'texte'}
            surChangement={(texte) => changerTexte(info.nom, texte)}
            surFin={() => setEdition(false)}
          />
        </div>
      )
    }

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
          setEdition(info.type === 'titre' || info.type === 'texte')
        }}
        onKeyDown={(evenement) => {
          if (evenement.key === 'Enter' || evenement.key === ' ') {
            evenement.preventDefault()
            setSelection(info.nom)
            setEdition(info.type === 'titre' || info.type === 'texte')
          }
        }}
      >
        {defaut}
        <span className="emp__etiquette" aria-hidden="true">
          {def.libelle}
        </span>
        {actif && (info.type === 'image' || info.type === 'video') ? (
          <span className="emp__actions">
            <button
              type="button"
              onClick={(evenement) => {
                evenement.stopPropagation()
                setSelecteur({ nom: info.nom, type: info.type as 'image' | 'video' })
              }}
            >
              Remplacer
            </button>
            <button
              type="button"
              onClick={(evenement) => {
                evenement.stopPropagation()
                retirerMedia(info.nom)
              }}
            >
              Retirer
            </button>
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="editeur">
      <header className="editeur__barre">
        <button type="button" className="editeur__retour" onClick={() => naviguer('/pages')}>
          ← Pages
        </button>

        <span className="editeur__titre">{titre}</span>

        <IndicateurEnregistrement etat={brouillon.etat} horodatage={brouillon.horodatage} />

        <div className="editeur__actions">
          <Bouton variante="secondaire" onClick={() => setApercu(!apercu)}>
            {apercu ? "Revenir à l'édition" : 'Aperçu'}
          </Bouton>
          <Bouton variante="primaire" onClick={() => setAPublier(true)}>
            {page.etat === 'en_ligne' ? 'Publier les modifications' : 'Publier sur la borne'}
          </Bouton>
        </div>
      </header>

      {brouillon.conflit ? (
        <div className="editeur__bandeau">
          <Bandeau variante="alerte">{brouillon.conflit}</Bandeau>
        </div>
      ) : page.etat === 'en_ligne' && page.aDesModifications ? (
        <div className="editeur__bandeau">
          <Bandeau variante="info">
            Cette page est en ligne sur la borne. Vos modifications ne seront visibles par les
            visiteurs qu'après publication.
          </Bandeau>
        </div>
      ) : null}

      <div className="editeur__corps">
        <div
          className="editeur__toile"
          onClick={() => {
            setSelection(null)
            setEdition(false)
          }}
        >
          <ToileBorne>
            <RenduPage contenu={contenu} media={resoudre} emp={enveloppe} />
          </ToileBorne>

          {apercu ? (
            <div className="controles-apercu">
              {problemes.length === 0 ? (
                <span className="controle controle--ok">✓ Cette page est prête à être publiée.</span>
              ) : (
                problemes.map((probleme, index) => (
                  <span key={index} className={`controle controle--${probleme.gravite}`}>
                    {probleme.gravite === 'bloquant' ? '✗' : '⚠'} {probleme.message}
                  </span>
                ))
              )}
            </div>
          ) : null}
        </div>

        {!apercu ? (
          <PanneauBloc
            modele={modele}
            nom={selection}
            valeur={selection ? contenu.emplacements[selection] : undefined}
            medias={parId}
            problemes={problemes}
            surTexte={changerTexte}
            surLegende={changerLegende}
            surChoisirMedia={(nom, type) => setSelecteur({ nom, type })}
            surRetirerMedia={retirerMedia}
            surRetirerGalerie={retirerGalerie}
          />
        ) : null}
      </div>

      {selecteur ? (
        <SelecteurMedia
          type={selecteur.type}
          surChoix={(media) => choisirMedia(selecteur.nom, media)}
          surFermeture={() => setSelecteur(null)}
        />
      ) : null}

      {aPublier ? (
        <Confirmation
          titre={page.etat === 'en_ligne' ? 'Publier les modifications ?' : 'Publier sur la borne ?'}
          consequence={
            estPubliable(problemes)
              ? `« ${titre} » sera visible par les visiteurs sur la borne d'exposition. Vous pourrez la retirer à tout moment.`
              : `Il reste ${bloquants.length} point${bloquants.length > 1 ? 's' : ''} à corriger : ${bloquants
                  .map((probleme) => probleme.message)
                  .join(' ')}`
          }
          libelleConfirmation="Publier"
          enCours={publication}
          surConfirmation={() => void publier()}
          surAnnulation={() => setAPublier(false)}
        />
      ) : null}
    </div>
  )
}

function IndicateurEnregistrement({
  etat,
  horodatage,
}: {
  etat: ReturnType<typeof useBrouillon>['etat']
  horodatage: string | null
}) {
  const textes: Record<typeof etat, string> = {
    repos: horodatage ? `Brouillon enregistré à ${heure(horodatage)}` : 'Brouillon',
    modifications: 'Modifications en cours…',
    enregistrement: 'Enregistrement…',
    enregistre: horodatage ? `Brouillon enregistré à ${heure(horodatage)}` : 'Enregistré',
    echec: "Échec de l'enregistrement — nouvelle tentative à la prochaine modification",
  }

  return (
    <span
      className={`enregistrement enregistrement--${etat}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">{etat === 'echec' ? '⚠' : etat === 'enregistre' || etat === 'repos' ? '✓' : '•'}</span>
      {textes[etat]}
    </span>
  )
}

export type { Probleme }
