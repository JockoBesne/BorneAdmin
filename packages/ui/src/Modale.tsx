import { useEffect, useRef, type ReactNode } from 'react'
import { Bouton } from './Bouton.jsx'

/** Modale accessible : focus piégé à l'ouverture, fermeture par Échap ou par
 *  clic extérieur, focus rendu à l'élément déclencheur (§6.5). */
export function Modale({
  titre,
  taille = 'm',
  surFermeture,
  pied,
  children,
}: {
  titre: string
  taille?: 'm' | 'l' | 'plein'
  surFermeture: () => void
  pied?: ReactNode
  children: ReactNode
}) {
  const boite = useRef<HTMLDivElement>(null)
  const declencheur = useRef<Element | null>(null)

  useEffect(() => {
    declencheur.current = document.activeElement
    boite.current?.focus()

    const auClavier = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') {
        evenement.stopPropagation()
        surFermeture()
      }
    }
    document.addEventListener('keydown', auClavier)

    const debordement = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', auClavier)
      document.body.style.overflow = debordement
      if (declencheur.current instanceof HTMLElement) declencheur.current.focus()
    }
  }, [surFermeture])

  return (
    <div
      className="ui-voile"
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) surFermeture()
      }}
    >
      <div
        ref={boite}
        className={`ui-modale${taille === 'm' ? '' : ` ui-modale--${taille}`}`}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        tabIndex={-1}
      >
        <div className="ui-modale__entete">
          <h2>{titre}</h2>
          <button type="button" className="ui-fermer" onClick={surFermeture} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="ui-modale__corps">{children}</div>
        {pied ? <div className="ui-modale__pied">{pied}</div> : null}
      </div>
    </div>
  )
}

/**
 * Confirmation. Le texte « conséquence » est obligatoire : il est impossible
 * de créer dans cette application une confirmation vague du type
 * « Êtes-vous sûr ? » (§12.2).
 */
export function Confirmation({
  titre,
  consequence,
  libelleConfirmation,
  destructive = false,
  enCours = false,
  surConfirmation,
  surAnnulation,
}: {
  titre: string
  consequence: string
  libelleConfirmation: string
  destructive?: boolean
  enCours?: boolean
  surConfirmation: () => void
  surAnnulation: () => void
}) {
  return (
    <Modale
      titre={titre}
      surFermeture={surAnnulation}
      pied={
        <>
          <Bouton variante="discret" onClick={surAnnulation} disabled={enCours}>
            Annuler
          </Bouton>
          <Bouton
            variante={destructive ? 'danger' : 'primaire'}
            onClick={surConfirmation}
            chargement={enCours}
          >
            {libelleConfirmation}
          </Bouton>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--c-texte-doux)', lineHeight: '23px' }}>{consequence}</p>
    </Modale>
  )
}
