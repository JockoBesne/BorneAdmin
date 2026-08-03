import { useEffect, useRef } from 'react'

/**
 * Édition de texte directement dans l'aperçu.
 *
 * Choix d'implémentation : une zone de texte native superposée à l'emplacement,
 * plutôt qu'un « contentEditable ». La saisie, la sélection, le collage et la
 * limite de signes sont alors gérés nativement par le navigateur — donc
 * correctement — et **aucun HTML ne peut entrer dans le contenu** (§7.5.3).
 *
 * Au repos, l'emplacement affiche le texte mis en forme (aperçu exact) ;
 * pendant l'édition, il affiche le marquage brut (**gras**, _italique_, « - »).
 */
export function ChampEnPlace({
  valeur,
  classe,
  max,
  multiligne,
  avecBarreOutils,
  surChangement,
  surFin,
}: {
  valeur: string
  classe: string
  max: number
  multiligne: boolean
  avecBarreOutils: boolean
  surChangement: (valeur: string) => void
  surFin: () => void
}) {
  const zone = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = zone.current
    if (!element) return
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  }, [])

  // Hauteur ajustée au contenu : le texte occupe exactement sa place réelle.
  useEffect(() => {
    const element = zone.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [valeur])

  /** Entoure la sélection d'un marquage, ou l'insère au curseur. */
  const entourer = (marque: string) => {
    const element = zone.current
    if (!element) return
    const debut = element.selectionStart
    const fin = element.selectionEnd
    const nouveau =
      valeur.slice(0, debut) + marque + valeur.slice(debut, fin) + marque + valeur.slice(fin)
    if (nouveau.length > max) return
    surChangement(nouveau)
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(debut + marque.length, fin + marque.length)
    })
  }

  const ajouterPuce = () => {
    const element = zone.current
    if (!element) return
    const debut = element.selectionStart
    const debutLigne = valeur.lastIndexOf('\n', Math.max(0, debut - 1)) + 1
    const nouveau = `${valeur.slice(0, debutLigne)}- ${valeur.slice(debutLigne)}`
    if (nouveau.length > max) return
    surChangement(nouveau)
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(debut + 2, debut + 2)
    })
  }

  return (
    <div className="champ-place">
      {avecBarreOutils ? (
        <div className="champ-place__outils">
          <button
            type="button"
            onMouseDown={(evenement) => evenement.preventDefault()}
            onClick={() => entourer('**')}
            title="Gras"
          >
            <strong>G</strong>
          </button>
          <button
            type="button"
            onMouseDown={(evenement) => evenement.preventDefault()}
            onClick={() => entourer('_')}
            title="Italique"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onMouseDown={(evenement) => evenement.preventDefault()}
            onClick={ajouterPuce}
            title="Liste à puces"
          >
            ≡
          </button>
        </div>
      ) : null}

      <textarea
        ref={zone}
        className={`champ-place__zone ${classe}`}
        value={valeur}
        maxLength={max}
        rows={1}
        spellCheck
        onChange={(evenement) => surChangement(evenement.target.value)}
        onBlur={surFin}
        onKeyDown={(evenement) => {
          if (evenement.key === 'Escape') {
            evenement.currentTarget.blur()
          }
          if (!multiligne && evenement.key === 'Enter') {
            evenement.preventDefault()
            evenement.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}
