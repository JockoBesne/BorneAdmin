import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Modele1, Modele2, Modele3 } from './Modeles.jsx'
import type { PropsModele } from './types.js'

/** Aiguillage vers le composant du modèle. Un modèle inconnu n'affiche rien
 *  plutôt que de faire tomber l'écran (§14.6). */
export function RenduPage(props: PropsModele) {
  switch (props.contenu.modele) {
    case 't1':
      return <Modele1 {...props} />
    case 't2':
      return <Modele2 {...props} />
    case 't3':
      return <Modele3 {...props} />
    default:
      return null
  }
}

export const LARGEUR_BORNE = 1920
export const HAUTEUR_BORNE = 1080

/**
 * Toile de la borne : un conteneur large de 1920 pixels ramené à l'échelle de
 * son parent. L'administration et la borne l'utilisent toutes les deux, donc
 * les proportions de l'aperçu sont exactes — une simple mise à l'échelle CSS,
 * sans iframe (§12.4).
 *
 * L'échelle ne tient compte que de la largeur : une page fait au moins un écran
 * de haut, mais peut être plus longue et défiler. Sans cela, tout ce qui dépasse
 * de 1080 pixels serait coupé — ce qui obligeait à rogner les images pour faire
 * tenir le texte.
 */
export function ToileBorne({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const cadre = useRef<HTMLDivElement>(null)
  const [echelle, setEchelle] = useState(1)
  const [hauteurMini, setHauteurMini] = useState(HAUTEUR_BORNE)

  useEffect(() => {
    const element = cadre.current
    if (!element) return

    const mesurer = () => {
      // « clientWidth » et non la boîte englobante : il exclut la barre de
      // défilement. Associé à « scrollbar-gutter: stable », la largeur mesurée
      // ne change pas selon que la barre est là ou non — sinon son apparition
      // modifierait l'échelle, qui modifierait la hauteur, qui ferait
      // apparaître ou disparaître la barre, sans fin.
      const largeur = element.clientWidth
      if (largeur === 0) return
      const facteur = largeur / LARGEUR_BORNE
      setEchelle(facteur)
      // Hauteur minimale exprimée dans l'échelle de la page : une page courte
      // remplit exactement la zone visible, sans un pixel de plus. Un plancher
      // fixe de 1080 la ferait défiler de la hauteur de la barre de navigation
      // même quand son contenu tient — un tressautement à chaque page.
      setHauteurMini(element.clientHeight / facteur)
    }

    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(element)
    // Nettoyage indispensable : la borne tourne des semaines sans redémarrage.
    return () => observateur.disconnect()
  }, [])

  return (
    <div ref={cadre} className={`toile ${className}`.trim()}>
      <div
        className="toile__ecran"
        style={{
          width: LARGEUR_BORNE,
          minHeight: hauteurMini,
          // « zoom » plutôt que « transform: scale » : zoom recalcule la mise en
          // page, donc la hauteur de défilement du parent est juste d'elle-même.
          // transform ne fait que déformer le rendu final, et il faudrait
          // recalculer cette hauteur à la main.
          // ponytail: zoom n'est bien pris en charge que par Chromium ; c'est
          // sans risque tant que l'application ne tourne que dans Electron. Pour
          // un rendu navigateur, repasser à transform + hauteur mesurée.
          zoom: echelle,
        }}
      >
        {children}
      </div>
    </div>
  )
}
