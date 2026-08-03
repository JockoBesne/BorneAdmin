import { useCallback, useEffect, useRef, useState } from 'react'
import { Bandeau, Bouton, EtatVide, Modale } from '@borne/ui'
import { clientApi, ErreurApi, type Media } from '../api.js'
import { poids, utilisations } from '../formats.js'

/**
 * Choix d'un média : la bibliothèque existante, ou un envoi immédiat.
 * L'utilisateur ne se voit jamais poser de question sur le format, la taille
 * ou les dimensions (§15.1).
 */
export function SelecteurMedia({
  type,
  surChoix,
  surFermeture,
}: {
  type: 'image' | 'video'
  surChoix: (media: Media) => void
  surFermeture: () => void
}) {
  const [medias, setMedias] = useState<Media[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [survol, setSurvol] = useState(false)
  const champFichier = useRef<HTMLInputElement>(null)

  const recharger = useCallback(async () => {
    setMedias(await clientApi.medias(type))
  }, [type])

  useEffect(() => {
    void recharger()
  }, [recharger])

  const envoyer = useCallback(
    async (fichiers: FileList | File[]) => {
      const liste = [...fichiers]
      if (liste.length === 0) return

      setEnvoiEnCours(true)
      setErreur(null)
      let dernier: Media | null = null

      for (const fichier of liste) {
        try {
          const formulaire = new FormData()
          formulaire.append('fichier', fichier)

          // Image de couverture extraite dans le navigateur : aucune dépendance
          // serveur, et l'utilisateur n'a rien à préparer (§15.4).
          if (fichier.type.startsWith('video/')) {
            const couverture = await extraireCouverture(fichier)
            if (couverture) {
              formulaire.append('poster', couverture.image)
              formulaire.append('dureeSecondes', String(couverture.duree))
            }
          }

          dernier = await clientApi.televerser(formulaire)
        } catch (cause) {
          setErreur(cause instanceof ErreurApi ? cause.message : "L'envoi a échoué.")
        }
      }

      setEnvoiEnCours(false)
      await recharger()
      if (dernier && liste.length === 1) surChoix(dernier)
    },
    [recharger, surChoix],
  )

  return (
    <Modale
      titre={type === 'image' ? 'Choisir une photo' : 'Choisir une vidéo'}
      taille="plein"
      surFermeture={surFermeture}
    >
      {erreur ? <Bandeau variante="erreur">{erreur}</Bandeau> : null}

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
          Glissez {type === 'image' ? 'vos photos' : 'votre vidéo'} ici
          {envoiEnCours ? ' — envoi en cours…' : ''}
        </span>
        <Bouton
          variante="secondaire"
          onClick={() => champFichier.current?.click()}
          chargement={envoiEnCours}
        >
          Parcourir mon ordinateur
        </Bouton>
        <input
          ref={champFichier}
          type="file"
          hidden
          multiple={type === 'image'}
          accept={type === 'image' ? 'image/*' : 'video/mp4,video/webm'}
          onChange={(evenement) => {
            if (evenement.target.files) void envoyer(evenement.target.files)
            evenement.target.value = ''
          }}
        />
      </div>

      {medias === null ? null : medias.length === 0 ? (
        <EtatVide
          titre="La bibliothèque est vide"
          description={`Envoyez ${type === 'image' ? 'une première photo' : 'une première vidéo'} depuis votre ordinateur.`}
        />
      ) : (
        <ul className="grille-medias">
          {medias.map((media) => (
            <li key={media.id}>
              <button type="button" className="carte-media" onClick={() => surChoix(media)}>
                <span className="carte-media__image">
                  {media.type === 'image' || media.urls.poster ? (
                    <img src={media.urls.poster ?? media.urls.vignette} alt="" />
                  ) : (
                    <span className="carte-media__absente" aria-hidden="true">
                      ▶
                    </span>
                  )}
                </span>
                <span className="carte-media__nom">{media.nomAffiche}</span>
                <span className="carte-media__meta">
                  {utilisations(media.utilisations)} · {poids(media.poidsOptimise)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modale>
  )
}

/** Première image lisible de la vidéo, prise à une seconde du début. */
async function extraireCouverture(
  fichier: File,
): Promise<{ image: string; duree: number } | null> {
  return new Promise((resoudre) => {
    const url = URL.createObjectURL(fichier)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const abandonner = () => {
      URL.revokeObjectURL(url)
      resoudre(null)
    }

    video.onerror = abandonner

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2)
    }

    video.onseeked = () => {
      try {
        const toile = document.createElement('canvas')
        toile.width = video.videoWidth
        toile.height = video.videoHeight
        const contexte = toile.getContext('2d')
        if (!contexte) return abandonner()
        contexte.drawImage(video, 0, 0)
        const image = toile.toDataURL('image/jpeg', 0.85)
        const duree = video.duration
        URL.revokeObjectURL(url)
        resoudre({ image, duree: Number.isFinite(duree) ? duree : 0 })
      } catch {
        abandonner()
      }
    }

    video.src = url
  })
}
