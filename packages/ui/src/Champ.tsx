import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface Commun {
  libelle: string
  aide?: string
  erreur?: string | null
  requis?: boolean
}

/** Le lien libellé ↔ champ et la description sont générés : impossible de les
 *  oublier, donc l'accessibilité ne dépend pas de la vigilance (§12.2). */
function enveloppe(
  id: string,
  { libelle, aide, erreur, requis }: Commun,
  saisie: React.ReactNode,
) {
  return (
    <div className={`ui-champ${erreur ? ' ui-champ--erreur' : ''}`}>
      <label className="ui-champ__libelle" htmlFor={id}>
        {libelle}
        {requis ? (
          <span className="ui-champ__requis" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {saisie}
      {aide ? (
        <span className="ui-champ__aide" id={`${id}-aide`}>
          {aide}
        </span>
      ) : null}
      {erreur ? (
        <span className="ui-champ__erreur" id={`${id}-erreur`} role="alert">
          <span aria-hidden="true">⚠</span> {erreur}
        </span>
      ) : null}
    </div>
  )
}

export function Champ({
  libelle,
  aide,
  erreur,
  requis,
  ...reste
}: Commun & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return enveloppe(
    id,
    { libelle, aide, erreur, requis },
    <input
      id={id}
      className="ui-champ__saisie"
      aria-describedby={[aide && `${id}-aide`, erreur && `${id}-erreur`].filter(Boolean).join(' ') || undefined}
      aria-invalid={erreur ? true : undefined}
      {...reste}
    />,
  )
}

export function ZoneTexte({
  libelle,
  aide,
  erreur,
  requis,
  ...reste
}: Commun & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return enveloppe(
    id,
    { libelle, aide, erreur, requis },
    <textarea
      id={id}
      className="ui-champ__saisie"
      aria-describedby={[aide && `${id}-aide`, erreur && `${id}-erreur`].filter(Boolean).join(' ') || undefined}
      aria-invalid={erreur ? true : undefined}
      {...reste}
    />,
  )
}
