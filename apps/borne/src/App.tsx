import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ContenuPage, Manifeste } from '@borne/contenu'
import { RenduPage, ToileBorne } from '@borne/contenu/rendu'
import { AccesAdmin } from './AccesAdmin.jsx'
import { chargerManifeste, resolveurMedias, versionDistante } from './contenu.js'
import { NavigationPage, Sommaire, Veille, Visionneuse } from './ecrans.jsx'

type Ecran = 'veille' | 'sommaire' | 'page'

const INTERVALLE_SONDAGE_MS = 60_000

export function App() {
  const [manifeste, setManifeste] = useState<Manifeste | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [ecran, setEcran] = useState<Ecran>('veille')
  const [index, setIndex] = useState(0)
  const [visionneuse, setVisionneuse] = useState<string | null>(null)

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    let annule = false
    chargerManifeste()
      .then(({ manifeste: charge }) => {
        if (!annule) setManifeste(charge)
      })
      .catch((cause: unknown) => {
        if (!annule) setErreur(cause instanceof Error ? cause.message : 'Contenu indisponible.')
      })
    return () => {
      annule = true
    }
  }, [])

  // ── Sondage : une nouvelle publication est reprise sans redémarrage ────────
  useEffect(() => {
    const minuteur = setInterval(() => {
      void versionDistante().then((version) => {
        if (version !== null && manifeste !== null && version > manifeste.version) {
          void chargerManifeste().then(({ manifeste: nouveau }) => setManifeste(nouveau))
        }
      })
    }, INTERVALLE_SONDAGE_MS)
    return () => clearInterval(minuteur)
  }, [manifeste])

  // ── Retour automatique à la veille ─────────────────────────────────────────
  const retourVeille = useCallback(() => {
    setEcran('veille')
    setVisionneuse(null)
    setIndex(0)
  }, [])

  const minutes = manifeste?.reglages.minutesAvantVeille ?? 3

  useEffect(() => {
    if (ecran === 'veille') return

    let minuteur: ReturnType<typeof setTimeout>
    const relancer = () => {
      clearTimeout(minuteur)
      minuteur = setTimeout(retourVeille, minutes * 60_000)
    }
    relancer()

    const evenements: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    for (const evenement of evenements) {
      window.addEventListener(evenement, relancer, { passive: true })
    }

    // Nettoyage systématique : la borne tourne en continu (§14.6).
    return () => {
      clearTimeout(minuteur)
      for (const evenement of evenements) window.removeEventListener(evenement, relancer)
    }
  }, [ecran, minutes, retourVeille])

  const media = useMemo(
    () => (manifeste ? resolveurMedias(manifeste) : () => null),
    [manifeste],
  )

  if (erreur) {
    return (
      <div className="etat-vide">
        <p className="etat-vide__titre">Contenu indisponible</p>
        <p className="etat-vide__texte">{erreur}</p>
      </div>
    )
  }

  if (!manifeste) {
    return (
      <div className="etat-vide">
        <p className="etat-vide__texte">Chargement…</p>
      </div>
    )
  }

  if (manifeste.pages.length === 0) {
    return (
      <>
        <div className="etat-vide">
          <p className="etat-vide__titre">{manifeste.reglages.titreVeille}</p>
          <p className="etat-vide__texte">
            Aucune page n'est encore en ligne. Les pages publiées depuis
            l'administration apparaîtront ici.
          </p>
        </div>
        <AccesAdmin />
      </>
    )
  }

  const page = manifeste.pages[Math.min(index, manifeste.pages.length - 1)]

  return (
    <>
      {ecran === 'veille' ? (
        <Veille manifeste={manifeste} surSortie={() => setEcran('sommaire')} />
      ) : null}

      {ecran === 'sommaire' ? (
        <Sommaire
          manifeste={manifeste}
          surChoix={(choisi) => {
            setIndex(choisi)
            setEcran('page')
          }}
        />
      ) : null}

      {ecran === 'page' && page ? (
        <div className="page-borne">
          <ToileBorne>
            <RenduPage
              contenu={page.contenu as ContenuPage}
              media={media}
              surImage={(mediaId) => setVisionneuse(mediaId)}
              lecteurVideo
            />
          </ToileBorne>

          <NavigationPage
            page={page}
            index={index}
            total={manifeste.pages.length}
            surSommaire={() => setEcran('sommaire')}
            surPrecedent={() => setIndex((valeur) => Math.max(0, valeur - 1))}
            surSuivant={() =>
              setIndex((valeur) => Math.min(manifeste.pages.length - 1, valeur + 1))
            }
          />
        </div>
      ) : null}

      {visionneuse ? (
        <Visionneuse
          mediaId={visionneuse}
          media={media}
          surFermeture={() => setVisionneuse(null)}
        />
      ) : null}

      <AccesAdmin />
    </>
  )
}
