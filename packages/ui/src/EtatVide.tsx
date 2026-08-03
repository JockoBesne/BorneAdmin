import type { ReactNode } from 'react'

/** Jamais de zone vide muette : une explication et une action (§6.5). */
export function EtatVide({
  icone = '⊹',
  titre,
  description,
  action,
}: {
  icone?: ReactNode
  titre: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="ui-vide">
      <span className="ui-vide__icone" aria-hidden="true">
        {icone}
      </span>
      <span className="ui-vide__titre">{titre}</span>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  )
}
