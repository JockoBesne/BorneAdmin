import { useEffect } from 'react'
import type { Manifeste, PageManifeste } from '@borne/contenu'
import type { MediaResolu, ResoudreMedia } from '@borne/contenu/rendu'

// ── Veille ───────────────────────────────────────────────────────────────────

export function Veille({
  manifeste,
  surSortie,
}: {
  manifeste: Manifeste
  surSortie: () => void
}) {
  const premiere = manifeste.pages[0]
  return (
    <button type="button" className="veille" onClick={surSortie}>
      {premiere?.vignette ? (
        <img className="veille__fond" src={premiere.vignette} alt="" draggable={false} />
      ) : null}
      <span className="veille__voile" aria-hidden="true" />
      <span className="veille__contenu">
        <span className="veille__titre">{manifeste.reglages.titreVeille}</span>
        <span className="veille__sous-titre">{manifeste.reglages.sousTitreVeille}</span>
        <span className="veille__pastille" aria-hidden="true" />
      </span>
    </button>
  )
}

// ── Sommaire ─────────────────────────────────────────────────────────────────

export function Sommaire({
  manifeste,
  surChoix,
}: {
  manifeste: Manifeste
  surChoix: (index: number) => void
}) {
  return (
    <div className="sommaire">
      <header className="sommaire__entete">
        <h1 className="sommaire__titre">{manifeste.reglages.titreVeille}</h1>
        <p className="sommaire__compte">
          {manifeste.pages.length} page{manifeste.pages.length > 1 ? 's' : ''} à découvrir
        </p>
      </header>

      <ul className="sommaire__grille">
        {manifeste.pages.map((page, index) => (
          <li key={page.id}>
            <button type="button" className="vignette" onClick={() => surChoix(index)}>
              <span className="vignette__image">
                {page.vignette ? (
                  <img src={page.vignette} alt="" draggable={false} />
                ) : (
                  <span className="vignette__absente" aria-hidden="true">
                    ⊹
                  </span>
                )}
              </span>
              <span className="vignette__titre">{page.titre}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Barre de navigation d'une page ───────────────────────────────────────────

export function NavigationPage({
  page,
  index,
  total,
  surSommaire,
  surPrecedent,
  surSuivant,
}: {
  page: PageManifeste
  index: number
  total: number
  surSommaire: () => void
  surPrecedent: () => void
  surSuivant: () => void
}) {
  return (
    <>
      <div className="nav nav--haut">
        <button type="button" className="nav__bouton" onClick={surSommaire}>
          ‹ Sommaire
        </button>
        <span className="nav__position">
          Page {index + 1} sur {total}
        </span>
      </div>

      <div className="nav nav--bas">
        <button
          type="button"
          className="nav__bouton"
          onClick={surPrecedent}
          disabled={index === 0}
        >
          ‹ Précédent
        </button>
        <span className="nav__titre">{page.titre}</span>
        <button
          type="button"
          className="nav__bouton"
          onClick={surSuivant}
          disabled={index >= total - 1}
        >
          Suivant ›
        </button>
      </div>
    </>
  )
}

// ── Visionneuse plein écran ──────────────────────────────────────────────────

export function Visionneuse({
  mediaId,
  media,
  surFermeture,
}: {
  mediaId: string
  media: ResoudreMedia
  surFermeture: () => void
}) {
  const resolu: MediaResolu | null = media(mediaId)

  useEffect(() => {
    const auClavier = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') surFermeture()
    }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  }, [surFermeture])

  if (!resolu) return null

  return (
    <div className="visionneuse" role="dialog" aria-modal="true" aria-label={resolu.legende || 'Photo'}>
      <button type="button" className="visionneuse__fermer" onClick={surFermeture}>
        Fermer ✕
      </button>
      <img className="visionneuse__image" src={resolu.url('grand')} alt={resolu.legende} />
      {resolu.legende ? <p className="visionneuse__legende">{resolu.legende}</p> : null}
      <button
        type="button"
        className="visionneuse__zone"
        onClick={surFermeture}
        aria-label="Fermer"
      />
    </div>
  )
}
