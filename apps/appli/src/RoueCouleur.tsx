import { useEffect, useRef, useState } from 'react'
import { hexVersRvb, rvbVersHex, rvbVersTsv, tsvVersRvb } from './couleurs.js'

const TAILLE = 176

/**
 * Disque de couleur.
 *
 * La roue montre toutes les teintes (autour) à toutes les saturations (centre
 * → bord), à la luminosité courante. On touche la roue pour choisir teinte et
 * saturation ; le curseur en dessous règle la luminosité. Le code hexadécimal
 * reste modifiable à la main pour une valeur précise.
 *
 * Composant contrôlé : la couleur vient de « valeur », chaque changement repart
 * par « surChangement ». Aucune couleur n'est gardée en interne.
 */
export function RoueCouleur({
  valeur,
  surChangement,
}: {
  valeur: string
  surChangement: (hex: string) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [teinte, saturation, luminosite] = rvbVersTsv(...hexVersRvb(valeur))

  // Saisie du champ hexadécimal en état local : on affiche ce que l'utilisateur
  // tape, même incomplet, et on ne répercute la couleur que lorsque le code est
  // complet et valide. Sans cet état local, le champ contrôlé resterait bloqué
  // sur l'ancienne valeur tant que la saisie n'est pas un code entier — on ne
  // pourrait donc pas écrire caractère par caractère.
  const [texteHex, setTexteHex] = useState(valeur.toUpperCase())

  // La couleur peut aussi changer par la roue ou le curseur : on resynchronise
  // alors le champ. (Ne se déclenche pas pendant une saisie incomplète, puisque
  // « valeur » ne change pas tant que le code n'est pas valide.)
  useEffect(() => {
    setTexteHex(valeur.toUpperCase())
  }, [valeur])

  // La roue n'est redessinée que quand la luminosité change : teinte et
  // saturation ne bougent que le curseur, superposé en CSS.
  useEffect(() => {
    const surface = canvas.current
    if (!surface) return
    const ctx = surface.getContext('2d')
    if (!ctx) return

    const image = ctx.createImageData(TAILLE, TAILLE)
    const donnees = image.data
    const rayon = TAILLE / 2

    for (let y = 0; y < TAILLE; y += 1) {
      for (let x = 0; x < TAILLE; x += 1) {
        const dx = x - rayon
        const dy = y - rayon
        const distance = Math.hypot(dx, dy)
        const i = (y * TAILLE + x) * 4
        if (distance <= rayon) {
          let h = (Math.atan2(dy, dx) * 180) / Math.PI
          if (h < 0) h += 360
          const [r, g, b] = tsvVersRvb(h, distance / rayon, luminosite)
          donnees[i] = r
          donnees[i + 1] = g
          donnees[i + 2] = b
          donnees[i + 3] = 255
        } else {
          donnees[i + 3] = 0
        }
      }
    }
    ctx.putImageData(image, 0, 0)
  }, [luminosite])

  const choisirDepuisPosition = (evenement: React.PointerEvent<HTMLCanvasElement>) => {
    const cadre = canvas.current?.getBoundingClientRect()
    if (!cadre) return
    const rayon = TAILLE / 2
    const dx = ((evenement.clientX - cadre.left) / cadre.width) * TAILLE - rayon
    const dy = ((evenement.clientY - cadre.top) / cadre.height) * TAILLE - rayon
    let h = (Math.atan2(dy, dx) * 180) / Math.PI
    if (h < 0) h += 360
    const s = Math.min(1, Math.hypot(dx, dy) / rayon)
    surChangement(rvbVersHex(...tsvVersRvb(h, s, luminosite)))
  }

  // Position du curseur sur la roue, en pourcentage du diamètre.
  const angle = (teinte * Math.PI) / 180
  const gauche = 50 + Math.cos(angle) * saturation * 50
  const haut = 50 + Math.sin(angle) * saturation * 50

  return (
    <div className="roue">
      <div className="roue__disque">
        <canvas
          ref={canvas}
          width={TAILLE}
          height={TAILLE}
          className="roue__canvas"
          onPointerDown={(evenement) => {
            evenement.currentTarget.setPointerCapture(evenement.pointerId)
            choisirDepuisPosition(evenement)
          }}
          onPointerMove={(evenement) => {
            if (evenement.buttons === 0) return
            choisirDepuisPosition(evenement)
          }}
        />
        <span
          className="roue__curseur"
          style={{ left: `${gauche}%`, top: `${haut}%` }}
          aria-hidden="true"
        />
      </div>

      <label className="roue__luminosite">
        <span className="champ__libelle">Luminosité</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(luminosite * 100)}
          onChange={(evenement) =>
            surChangement(
              rvbVersHex(...tsvVersRvb(teinte, saturation, Number(evenement.target.value) / 100)),
            )
          }
        />
      </label>

      <div className="roue__valeur">
        <span className="roue__pastille" style={{ background: valeur }} aria-hidden="true" />
        <input
          className="roue__hex"
          value={texteHex}
          spellCheck={false}
          maxLength={7}
          onChange={(evenement) => {
            const saisie = evenement.target.value
            setTexteHex(saisie)
            // Accepté avec ou sans « # » ; on ne répercute qu'un code complet.
            const complet = saisie.trim().replace(/^#?/, '#')
            if (/^#[0-9a-fA-F]{6}$/.test(complet)) surChangement(complet.toLowerCase())
          }}
          // À la sortie du champ, une saisie incomplète revient à la couleur
          // réelle : le champ ne reste jamais bloqué sur un code invalide.
          onBlur={() => setTexteHex(valeur.toUpperCase())}
        />
      </div>
    </div>
  )
}
