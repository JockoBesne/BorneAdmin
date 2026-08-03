import type { ElementGalerie, ProfilImage, ValeurImage, ValeurVideo } from '../types.js'
import type { ResoudreMedia } from './types.js'

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
}: {
  valeur: ValeurVideo
  media: ResoudreMedia
  libelleVide: string
  /** Faux dans l'éditeur : on affiche l'image de couverture, pas le lecteur. */
  lisible: boolean
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

  return (
    <div className="b-video">
      <video
        className="b-video__lecteur"
        src={resolu.url('origine')}
        poster={resolu.poster ?? undefined}
        controls
        playsInline
        preload="none"
      />
    </div>
  )
}
