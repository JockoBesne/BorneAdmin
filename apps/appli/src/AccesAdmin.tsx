import { useCallback, useEffect, useRef, useState } from 'react'
import { REGLAGES_DEFAUT, schemaReglages } from '@borne/contenu'

const DUREE_APPUI_MS = 5000

/**
 * Lit le code d'accès sans dépendre de la validité du reste du contenu : un
 * contenu.json abîmé ne doit pas verrouiller l'administration, c'est justement
 * le moment où on en a besoin. En dernier recours, le code par défaut.
 */
async function lireCodeAcces(): Promise<string> {
  try {
    const brut = (await window.borne.lireContenu()) as { reglages?: unknown }
    const reglages = schemaReglages.safeParse(brut?.reglages)
    if (reglages.success) return reglages.data.pinAdmin
  } catch {
    /* contenu illisible : on retombe sur le code par défaut */
  }
  return REGLAGES_DEFAUT.pinAdmin
}

/**
 * Accès caché à l'administration.
 *
 * Une zone invisible dans le coin supérieur droit : un appui maintenu de 5
 * secondes ouvre le pavé numérique. Un visiteur ne peut pas le déclencher par
 * hasard (il faudrait maintenir le doigt immobile 5 s dans un coin), et rien
 * ne signale sa présence.
 *
 * Le code est comparé sur place, sans serveur. Il empêche un visiteur d'entrer
 * par curiosité — ce n'est pas une sécurité, et il ne faut pas le présenter
 * comme telle : il est lisible en clair dans contenu.json.
 */
export function AccesAdmin({ surReussite }: { surReussite: () => void }) {
  const [appui, setAppui] = useState(false)
  const [paveOuvert, setPaveOuvert] = useState(false)
  const [pin, setPin] = useState(REGLAGES_DEFAUT.pinAdmin)
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let annule = false
    void lireCodeAcces().then((code) => {
      if (!annule) setPin(code)
    })
    return () => {
      annule = true
    }
  }, [])

  const arreter = useCallback(() => {
    if (minuteur.current !== null) {
      clearTimeout(minuteur.current)
      minuteur.current = null
    }
    setAppui(false)
  }, [])

  /**
   * Le déclenchement repose sur un minuteur, pas sur une boucle d'animation :
   * requestAnimationFrame est suspendu dès que la page ne produit plus d'images
   * (fenêtre masquée, économie d'énergie, veille de l'écran), ce qui rendrait
   * l'accès inutilisable au pire moment. La jauge, elle, est purement visuelle
   * et animée en CSS.
   */
  const commencer = useCallback(() => {
    setAppui(true)
    minuteur.current = setTimeout(() => {
      minuteur.current = null
      setAppui(false)
      setPaveOuvert(true)
    }, DUREE_APPUI_MS)
  }, [])

  // La borne tourne des semaines : tout minuteur doit être libéré (§14.6).
  useEffect(() => arreter, [arreter])

  return (
    <>
      <div
        className={`acces-admin${appui ? ' acces-admin--appui' : ''}`}
        onPointerDown={commencer}
        onPointerUp={arreter}
        onPointerLeave={arreter}
        onPointerCancel={arreter}
        aria-hidden="true"
      >
        <span className="acces-admin__jauge" />
      </div>

      {paveOuvert ? (
        <PavePin pin={pin} surReussite={surReussite} surFermeture={() => setPaveOuvert(false)} />
      ) : null}
    </>
  )
}

function PavePin({
  pin,
  surReussite,
  surFermeture,
}: {
  pin: string
  surReussite: () => void
  surFermeture: () => void
}) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  // Le code courant est aussi tenu dans une référence : deux appuis rapprochés
  // liraient sinon la même valeur d'état, et un chiffre serait perdu.
  const codeCourant = useRef('')

  const taper = (chiffre: string) => {
    const suivant = (codeCourant.current + chiffre).slice(0, pin.length)
    codeCourant.current = suivant
    setCode(suivant)
    setErreur(null)

    if (suivant.length < pin.length) return

    if (suivant === pin) {
      surReussite()
      return
    }

    codeCourant.current = ''
    setCode('')
    setErreur('Code incorrect.')
  }

  const effacer = () => {
    codeCourant.current = codeCourant.current.slice(0, -1)
    setCode(codeCourant.current)
  }

  return (
    <div className="pin" role="dialog" aria-modal="true" aria-label="Accès à l'administration">
      <div className="pin__boite">
        <h2 className="pin__titre">Administration</h2>
        <p className="pin__aide">Saisissez le code d'accès</p>

        <div className="pin__points" aria-hidden="true">
          {Array.from({ length: pin.length }, (_, index) => (
            <span
              key={index}
              className={`pin__point${index < code.length ? ' pin__point--plein' : ''}`}
            />
          ))}
        </div>

        {erreur ? (
          <p className="pin__erreur" role="alert">
            {erreur}
          </p>
        ) : null}

        <div className="pin__clavier">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((chiffre) => (
            <button
              key={chiffre}
              type="button"
              className="pin__touche"
              onClick={() => taper(chiffre)}
            >
              {chiffre}
            </button>
          ))}
          <button type="button" className="pin__touche pin__touche--discret" onClick={surFermeture}>
            Annuler
          </button>
          <button type="button" className="pin__touche" onClick={() => taper('0')}>
            0
          </button>
          <button type="button" className="pin__touche pin__touche--discret" onClick={effacer}>
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}
