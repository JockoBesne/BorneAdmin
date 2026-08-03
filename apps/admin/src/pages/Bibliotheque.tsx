import { useCallback, useEffect, useRef, useState } from 'react'
import { Bandeau, Bouton, Champ, Confirmation, EtatVide, Modale, useNotifications } from '@borne/ui'
import { clientApi, ErreurApi, type Media } from '../api.js'
import { dateRelative, duree, poids, utilisations } from '../formats.js'

export function Bibliotheque() {
  const { montrer } = useNotifications()
  const [medias, setMedias] = useState<Media[] | null>(null)
  const [filtre, setFiltre] = useState<'tout' | 'image' | 'video'>('tout')
  const [inutilises, setInutilises] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [detail, setDetail] = useState<(Media & { pages?: { id: string; titre: string }[] }) | null>(null)
  const [aSupprimer, setASupprimer] = useState<Media | null>(null)
  const [envoi, setEnvoi] = useState<string | null>(null)
  const [survol, setSurvol] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const champFichier = useRef<HTMLInputElement>(null)

  const recharger = useCallback(async () => {
    setMedias(await clientApi.medias())
  }, [])

  useEffect(() => {
    void recharger()
  }, [recharger])

  const envoyer = async (fichiers: FileList | File[]) => {
    setErreur(null)
    for (const fichier of [...fichiers]) {
      setEnvoi(fichier.name)
      try {
        const formulaire = new FormData()
        formulaire.append('fichier', fichier)
        await clientApi.televerser(formulaire)
      } catch (cause) {
        setErreur(cause instanceof ErreurApi ? cause.message : `« ${fichier.name} » n'a pas pu être envoyé.`)
      }
    }
    setEnvoi(null)
    await recharger()
  }

  const supprimer = async () => {
    if (!aSupprimer) return
    try {
      await clientApi.supprimerMedia(aSupprimer.id)
      montrer({ message: `« ${aSupprimer.nomAffiche} » a été supprimé.`, variante: 'neutre' })
      setASupprimer(null)
      setDetail(null)
      await recharger()
    } catch (cause) {
      const details =
        cause instanceof ErreurApi && Array.isArray(cause.details)
          ? (cause.details as { titre: string }[]).map((page) => page.titre).join(', ')
          : ''
      montrer({
        message:
          cause instanceof ErreurApi
            ? `${cause.message}${details ? ` (${details})` : ''}`
            : 'La suppression a échoué.',
        variante: 'erreur',
      })
      setASupprimer(null)
    }
  }

  const ouvrirDetail = async (media: Media) => {
    setDetail(media)
    try {
      setDetail(await clientApi.media(media.id))
    } catch {
      /* le détail enrichi est un confort : on garde ce que l'on a déjà */
    }
  }

  const visibles = (medias ?? [])
    .filter((media) => filtre === 'tout' || media.type === filtre)
    .filter((media) => !inutilises || media.utilisations === 0)
    .filter((media) =>
      media.nomAffiche.toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr')),
    )

  return (
    <div className="ecran">
      <div className="ecran__entete">
        <h1>Photos et vidéos</h1>
        <Bouton variante="primaire" taille="l" onClick={() => champFichier.current?.click()}>
          + Ajouter
        </Bouton>
      </div>

      {erreur ? <Bandeau variante="erreur">{erreur}</Bandeau> : null}

      <div className="barre-outils">
        <input
          type="search"
          className="recherche"
          placeholder="Rechercher…"
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          aria-label="Rechercher un fichier"
        />
        <select
          className="selecteur"
          value={filtre}
          onChange={(evenement) => setFiltre(evenement.target.value as typeof filtre)}
          aria-label="Type de fichier"
        >
          <option value="tout">Tous les fichiers</option>
          <option value="image">Photos</option>
          <option value="video">Vidéos</option>
        </select>
        <label className="case">
          <input
            type="checkbox"
            checked={inutilises}
            onChange={(evenement) => setInutilises(evenement.target.checked)}
          />
          Afficher seulement les fichiers non utilisés
        </label>
      </div>

      <div
        className={`depot${survol ? ' depot--survol' : ''}`}
        onDragOver={(evenement) => {
          evenement.preventDefault()
          setSurvol(true)
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(evenement) => {
          evenement.preventDefault()
          setSurvol(false)
          void envoyer(evenement.dataTransfer.files)
        }}
      >
        <span className="depot__icone" aria-hidden="true">
          ⬆
        </span>
        <span>
          {envoi ? `Envoi de « ${envoi} »…` : 'Glissez vos photos et vidéos ici pour les ajouter'}
        </span>
      </div>

      <input
        ref={champFichier}
        type="file"
        hidden
        multiple
        accept="image/*,video/mp4,video/webm"
        onChange={(evenement) => {
          if (evenement.target.files) void envoyer(evenement.target.files)
          evenement.target.value = ''
        }}
      />

      {medias === null ? null : visibles.length === 0 ? (
        <EtatVide
          titre="Aucun fichier"
          description="Glissez vos photos et vidéos dans la zone ci-dessus pour commencer."
        />
      ) : (
        <ul className="grille-medias">
          {visibles.map((media) => (
            <li key={media.id}>
              <button type="button" className="carte-media" onClick={() => void ouvrirDetail(media)}>
                <span className="carte-media__image">
                  {media.type === 'image' || media.urls.poster ? (
                    <img src={media.urls.poster ?? media.urls.vignette} alt="" />
                  ) : (
                    <span className="carte-media__absente" aria-hidden="true">
                      ▶
                    </span>
                  )}
                  {media.type === 'video' ? (
                    <span className="carte-media__duree">{duree(media.dureeSecondes) ?? 'vidéo'}</span>
                  ) : null}
                </span>
                <span className="carte-media__nom">{media.nomAffiche}</span>
                <span
                  className={`carte-media__meta${media.utilisations === 0 ? ' carte-media__meta--alerte' : ''}`}
                >
                  {media.utilisations === 0 ? '⚠ ' : ''}
                  {utilisations(media.utilisations)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail ? (
        <Modale
          titre={detail.nomAffiche}
          taille="l"
          surFermeture={() => setDetail(null)}
          pied={
            <>
              <Bouton variante="danger" onClick={() => setASupprimer(detail)}>
                Supprimer
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setDetail(null)}>
                Fermer
              </Bouton>
            </>
          }
        >
          <div className="detail-media">
            <div className="detail-media__apercu">
              {detail.type === 'image' ? (
                <img src={detail.urls.moyen} alt={detail.legende} />
              ) : (
                <video src={detail.urls.origine} poster={detail.urls.poster ?? undefined} controls />
              )}
            </div>

            <div className="detail-media__infos">
              <Champ
                libelle="Légende"
                aide="Affichée aux visiteurs et lue par les lecteurs d'écran."
                defaultValue={detail.legende}
                maxLength={200}
                onBlur={(evenement) => {
                  void clientApi
                    .majMedia(detail.id, { legende: evenement.target.value })
                    .then(() => recharger())
                    .catch(() => undefined)
                }}
              />

              <dl className="detail-media__liste">
                {detail.largeur ? (
                  <>
                    <dt>Dimensions</dt>
                    <dd>
                      {detail.largeur} × {detail.hauteur} pixels
                    </dd>
                  </>
                ) : null}
                <dt>Poids d'origine</dt>
                <dd>{poids(detail.poidsOctets)}</dd>
                <dt>Poids après optimisation</dt>
                <dd>{poids(detail.poidsOptimise)}</dd>
                <dt>Ajouté</dt>
                <dd>{dateRelative(detail.creeLe)}</dd>
                <dt>Utilisé par</dt>
                <dd>
                  {detail.pages && detail.pages.length > 0
                    ? detail.pages.map((page) => page.titre).join(', ')
                    : 'aucune page'}
                </dd>
              </dl>
            </div>
          </div>
        </Modale>
      ) : null}

      {aSupprimer ? (
        <Confirmation
          titre={`Supprimer « ${aSupprimer.nomAffiche} » ?`}
          consequence={
            aSupprimer.utilisations > 0
              ? `Ce fichier est utilisé par ${utilisations(aSupprimer.utilisations).toLowerCase()}. La suppression sera refusée tant qu'il est utilisé.`
              : "Le fichier sera définitivement retiré de la bibliothèque."
          }
          libelleConfirmation="Supprimer"
          destructive
          surConfirmation={() => void supprimer()}
          surAnnulation={() => setASupprimer(null)}
        />
      ) : null}
    </div>
  )
}
