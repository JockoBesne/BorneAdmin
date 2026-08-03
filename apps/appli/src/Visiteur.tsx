import { useEffect, useMemo, useState } from 'react'
import { REGLAGES_DEFAUT, type ContenuPage, type Manifeste } from '@borne/contenu'
import { RenduPage, ToileBorne } from '@borne/contenu/rendu'
import { chargerContenu, resolveurMedias } from './contenu.js'
import { couleursEffectives, stylesCouleurs } from './couleurs.js'

/**
 * Mode visiteur — version d'étape 1.
 *
 * Volontairement réduit à l'essentiel : charger le contenu, l'afficher, passer
 * d'une page à l'autre. Ni écran de veille, ni sommaire, ni visionneuse : ils
 * viendront quand cette base aura été vue tourner sur le vrai écran.
 */
export function Visiteur() {
  const [manifeste, setManifeste] = useState<Manifeste | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let annule = false

    chargerContenu()
      .then((charge) => {
        if (!annule) setManifeste(charge)
      })
      .catch((cause: unknown) => {
        if (!annule) {
          setErreur(cause instanceof Error ? cause.message : 'Contenu illisible.')
        }
      })

    return () => {
      annule = true
    }
  }, [])

  const media = useMemo(
    () => (manifeste ? resolveurMedias(manifeste) : () => null),
    [manifeste],
  )

  const total = manifeste?.pages.length ?? 0
  const page = manifeste?.pages[Math.min(index, Math.max(0, total - 1))]

  // Couleurs de la borne : celles de la page courante si elle en a, sinon le
  // thème global, sinon les valeurs par défaut tant que rien n'est chargé.
  const reglages = manifeste?.reglages ?? REGLAGES_DEFAUT
  const style = stylesCouleurs(page ? couleursEffectives(reglages, page) : reglages)

  let contenu
  if (erreur) {
    contenu = (
      <div className="etat-vide">
        <p className="etat-vide__titre">Contenu indisponible</p>
        <p className="etat-vide__texte">{erreur}</p>
      </div>
    )
  } else if (!manifeste) {
    contenu = (
      <div className="etat-vide">
        <p className="etat-vide__texte">Chargement…</p>
      </div>
    )
  } else if (!page) {
    contenu = (
      <div className="etat-vide">
        <p className="etat-vide__titre">{manifeste.reglages.titreVeille}</p>
        <p className="etat-vide__texte">Aucune page n'est encore en ligne.</p>
      </div>
    )
  } else {
    contenu = (
      <div className="page-borne">
        {/* La clé force un remontage de la toile à chaque changement de page :
            le défilement repart du haut, au lieu de conserver la position de la
            page précédente. */}
        <ToileBorne key={page.id}>
          <RenduPage contenu={page.contenu as ContenuPage} media={media} lecteurVideo />
        </ToileBorne>

        <nav className="nav" aria-label="Navigation entre les pages">
          <button
            type="button"
            className="nav__bouton"
            onClick={() => setIndex((valeur) => Math.max(0, valeur - 1))}
            disabled={index === 0}
          >
            ← Précédent
          </button>

          <span className="nav__position">
            {page.titre} · {index + 1} sur {total}
          </span>

          <button
            type="button"
            className="nav__bouton"
            onClick={() => setIndex((valeur) => Math.min(total - 1, valeur + 1))}
            disabled={index >= total - 1}
          >
            Suivant →
          </button>
        </nav>
      </div>
    )
  }

  return (
    <div className="visiteur-hote" style={style}>
      {contenu}
    </div>
  )
}
