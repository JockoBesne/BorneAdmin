export type EtatPublication = 'brouillon' | 'en_ligne' | 'retiree' | 'corbeille'

const LIBELLES: Record<EtatPublication, string> = {
  brouillon: 'Brouillon',
  en_ligne: 'En ligne',
  retiree: 'Retirée',
  corbeille: 'Corbeille',
}

/**
 * Grammaire visuelle des états (§6.6). L'information n'est jamais portée par
 * la couleur seule : point coloré ET libellé écrit.
 */
export function Pastille({
  etat,
  modifications = false,
}: {
  etat: EtatPublication
  /** Page en ligne dont le brouillon diffère de la version publiée. */
  modifications?: boolean
}) {
  return (
    <span className={`ui-pastille ui-pastille--${etat}`}>
      <span className="ui-pastille__point" aria-hidden="true" />
      {LIBELLES[etat]}
      {modifications ? (
        <span className="ui-pastille__note">· modifications non publiées</span>
      ) : null}
    </span>
  )
}
