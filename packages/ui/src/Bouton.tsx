import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface ProprietesBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primaire' | 'secondaire' | 'discret' | 'danger'
  taille?: 'm' | 'l'
  chargement?: boolean
  icone?: ReactNode
}

/** Un seul bouton primaire visible par écran (§6.5). */
export function Bouton({
  variante = 'secondaire',
  taille = 'm',
  chargement = false,
  icone,
  children,
  className = '',
  disabled,
  ...reste
}: ProprietesBouton) {
  const classes = [
    'ui-bouton',
    `ui-bouton--${variante}`,
    taille === 'l' ? 'ui-bouton--l' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      {...reste}
    >
      {chargement ? <span className="ui-bouton__sablier" aria-hidden="true" /> : icone}
      {children}
    </button>
  )
}
