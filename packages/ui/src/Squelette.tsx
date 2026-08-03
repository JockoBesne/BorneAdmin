/** Affiché pendant les chargements de plus de 300 ms (§6.5). */
export function Squelette({
  hauteur = 20,
  largeur = '100%',
  rayon,
}: {
  hauteur?: number | string
  largeur?: number | string
  rayon?: number
}) {
  return (
    <div
      className="ui-squelette"
      style={{ height: hauteur, width: largeur, borderRadius: rayon }}
      aria-hidden="true"
    />
  )
}
