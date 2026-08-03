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
 * Toile de la borne : un conteneur de 1920 × 1080 pixels ramené à l'échelle de
 * son parent. L'administration et la borne l'utilisent toutes les deux, donc
 * les proportions de l'aperçu sont exactes — une simple mise à l'échelle CSS,
 * sans iframe (§12.4).
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

  useEffect(() => {
    const element = cadre.current
    if (!element) return

    const mesurer = () => {
      const { width, height } = element.getBoundingClientRect()
      if (width === 0 || height === 0) return
      setEchelle(Math.min(width / LARGEUR_BORNE, height / HAUTEUR_BORNE))
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
          height: HAUTEUR_BORNE,
          transform: `scale(${echelle})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
