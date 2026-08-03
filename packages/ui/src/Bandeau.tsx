import type { ReactNode } from 'react'

const ICONES = { info: 'ℹ', succes: '✓', alerte: '⚠', erreur: '✕' } as const

export function Bandeau({
  variante = 'info',
  children,
}: {
  variante?: keyof typeof ICONES
  children: ReactNode
}) {
  return (
    <div className={`ui-bandeau ui-bandeau--${variante}`} role={variante === 'erreur' ? 'alert' : undefined}>
      <span className="ui-bandeau__icone" aria-hidden="true">
        {ICONES[variante]}
      </span>
      <div>{children}</div>
    </div>
  )
}
