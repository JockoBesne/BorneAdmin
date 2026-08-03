import { useRef, useState } from 'react'
import type { ElementGalerie, ProfilImage, ValeurImage, ValeurVideo } from '../types.js'
import type { MediaResolu, ResoudreMedia } from './types.js'

/** Emplacement média vide — jamais une zone blanche muette (§5.5). */
export function BlocVide({ libelle }: { libelle: string }) {
  return (
    <div className="b-vide">
      <span className="b-vide__icone" aria-hidden="true">
        ⊹
      </span>
      <span className="b-vide__texte">{libelle}</span>
    </div>
  )
}

export function BlocImage({
  valeur,
  media,
  profil,
  libelleVide,
  surImage,
}: {
  valeur: ValeurImage
  media: ResoudreMedia
  profil: ProfilImage
  libelleVide: string
  surImage?: (mediaId: string) => void
}) {
  const resolu = media(valeur.mediaId)
  if (!resolu || resolu.type !== 'image') return <BlocVide libelle={libelleVide} />

  const legende = valeur.legende || resolu.legende
  const image = (
    <img
      className="b-image__fichier"
      src={resolu.url(profil)}
      alt={legende}
      style={{
        objectPosition: `${resolu.pointFocal.x * 100}% ${resolu.pointFocal.y * 100}%`,
      }}
      draggable={false}
    />
  )

  return (
    <figure className="b-image">
      {surImage ? (
        <button
          type="button"
          className="b-image__zone b-image__zone--tactile"
          onClick={() => surImage(resolu.id)}
          aria-label={legende ? `Agrandir : ${legende}` : 'Agrandir la photo'}
        >
          {image}
        </button>
      ) : (
        <span className="b-image__zone">{image}</span>
      )}
      {legende ? <figcaption className="b-legende">{legende}</figcaption> : null}
    </figure>
  )
}

export function BlocGalerie({
  elements,
  media,
  libelleVide,
  surImage,
}: {
  elements: ElementGalerie[]
  media: ResoudreMedia
  libelleVide: string
  surImage?: (mediaId: string) => void
}) {
  if (elements.length === 0) return <BlocVide libelle={libelleVide} />

  return (
    <ul className="b-galerie">
      {elements.map((element, i) => {
        const resolu = media(element.mediaId)
        if (!resolu) return null
        const legende = element.legende || resolu.legende
        const image = (
          <img
            className="b-galerie__image"
            src={resolu.url('moyen')}
            alt={legende}
            style={{
              objectPosition: `${resolu.pointFocal.x * 100}% ${resolu.pointFocal.y * 100}%`,
            }}
            draggable={false}
          />
        )
        return (
          <li key={`${element.mediaId}-${i}`} className="b-galerie__element">
            {surImage ? (
              <button
                type="button"
                className="b-galerie__zone"
                onClick={() => surImage(resolu.id)}
                aria-label={legende ? `Agrandir : ${legende}` : 'Agrandir la photo'}
              >
                {image}
              </button>
            ) : (
              <span className="b-galerie__zone">{image}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function BlocVideo({
  valeur,
  media,
  libelleVide,
  lisible,
  surLecture,
}: {
  valeur: ValeurVideo
  media: ResoudreMedia
  libelleVide: string
  /** Faux dans l'éditeur : on affiche l'image de couverture, pas le lecteur. */
  lisible: boolean
  /** Prévient quand la vidéo passe en lecture / à l'arrêt (modèle 3 : cache le
   *  texte superposé pendant la lecture). Absent = personne n'écoute. */
  surLecture?: (enLecture: boolean) => void
}) {
  const resolu = media(valeur.mediaId)
  if (!resolu || resolu.type !== 'video') return <BlocVide libelle={libelleVide} />

  if (!lisible) {
    return (
      <div className="b-video b-video--apercu">
        {resolu.poster ? (
          <img className="b-video__poster" src={resolu.poster} alt="" draggable={false} />
        ) : (
          <div className="b-video__poster b-video__poster--absent" />
        )}
        <span className="b-video__marque" aria-hidden="true">
          ▶
        </span>
      </div>
    )
  }

  return <LecteurVideo resolu={resolu} surLecture={surLecture} />
}

/**
 * Lecteur pensé pour l'écran tactile : toute la vidéo est une cible. On touche,
 * elle démarre ; on retouche, elle se met en pause. Un grand ▶ marque l'arrêt.
 *
 * Pas de commandes natives : sur une borne, leur petit bouton de lecture et
 * leur barre de progression sont difficiles à viser au doigt — et sur le modèle
 * « Vidéo en avant » cette barre passe même sous la navigation.
 */
function LecteurVideo({
  resolu,
  surLecture,
}: {
  resolu: MediaResolu
  surLecture?: (enLecture: boolean) => void
}) {
  const lecteur = useRef<HTMLVideoElement>(null)
  const [enPause, setEnPause] = useState(true)

  const basculer = () => {
    const video = lecteur.current
    if (!video) return
    // « play » peut échouer (fenêtre en arrière-plan, économie d'énergie) : on
    // ignore le rejet, l'état « en pause » reste juste, aucune exception ne
    // remonte jusqu'à faire tomber l'affichage.
    if (video.paused) void video.play().catch(() => undefined)
    else video.pause()
  }

  const arret = () => {
    setEnPause(true)
    surLecture?.(false)
  }

  return (
    <button
      type="button"
      className="b-video b-video__bouton"
      onClick={basculer}
      aria-label={enPause ? 'Lire la vidéo' : 'Mettre la vidéo en pause'}
    >
      <video
        ref={lecteur}
        className="b-video__lecteur"
        src={resolu.url('origine')}
        poster={resolu.poster ?? undefined}
        playsInline
        preload="none"
        onPlay={() => {
          setEnPause(false)
          surLecture?.(true)
        }}
        onPause={arret}
        onEnded={arret}
      />
      {enPause ? (
        <span className="b-video__marque" aria-hidden="true">
          ▶
        </span>
      ) : null}
    </button>
  )
}
