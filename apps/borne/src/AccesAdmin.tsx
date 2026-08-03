import { useCallback, useEffect, useRef, useState } from 'react'

const DUREE_APPUI_MS = 5000
const URL_ADMIN = import.meta.env['VITE_URL_ADMIN'] ?? '/admin/'

/**
 * Bouton secret d'accès à l'administration.
 *
 * Une zone invisible dans le coin supérieur droit : un appui maintenu de 5
 * secondes ouvre le pavé numérique. Un visiteur ne peut pas le déclencher par
 * hasard (il faudrait maintenir le doigt immobile 5 s dans un coin), et rien
 * ne signale sa présence.
 *
 * Le code PIN est vérifié par le serveur (limitation de débit et journalisation
 * incluses) mais **n'ouvre pas de session** : il déverrouille l'accès à l'écran
 * de connexion, qui reste la seule porte d'entrée nominative. La traçabilité
 * « qui a publié quoi » est ainsi préservée.
 */
export function AccesAdmin() {
  const [appui, setAppui] = useState(false)
  const [paveOuvert, setPaveOuvert] = useState(false)
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)

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
   * (onglet masqué, économie d'énergie, veille de l'écran), ce qui rendrait le
   * bouton secret inutilisable au pire moment. La jauge, elle, est purement
   * visuelle et animée en CSS.
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

      {paveOuvert ? <PavePin surFermeture={() => setPaveOuvert(false)} /> : null}
    </>
  )
}

function PavePin({ surFermeture }: { surFermeture: () => void }) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  // Le code courant est aussi tenu dans une référence : deux appuis rapprochés
  // liraient sinon la même valeur d'état, et un chiffre serait perdu.
  const codeCourant = useRef('')

  const reinitialiser = useCallback(() => {
    codeCourant.current = ''
    setCode('')
  }, [])

  const valider = useCallback(
    async (pin: string) => {
      setEnCours(true)
      setErreur(null)
      try {
        const reponse = await fetch('/api/v1/auth/pin-borne', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        })
        if (!reponse.ok) {
          const donnees = (await reponse.json()) as { erreur?: { message?: string } }
          setErreur(donnees.erreur?.message ?? 'Code incorrect.')
          reinitialiser()
          return
        }
        window.location.href = URL_ADMIN
      } catch {
        setErreur("Le serveur d'administration est injoignable.")
        reinitialiser()
      } finally {
        setEnCours(false)
      }
    },
    [],
  )

  const taper = (chiffre: string) => {
    if (enCours) return
    const suivant = (codeCourant.current + chiffre).slice(0, 8)
    codeCourant.current = suivant
    setCode(suivant)
    setErreur(null)
    if (suivant.length === 4) void valider(suivant)
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
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className={`pin__point${index < code.length ? ' pin__point--plein' : ''}`} />
          ))}
        </div>

        {erreur ? (
          <p className="pin__erreur" role="alert">
            {erreur}
          </p>
        ) : null}

        <div className="pin__clavier">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((chiffre) => (
            <button key={chiffre} type="button" className="pin__touche" onClick={() => taper(chiffre)}>
              {chiffre}
            </button>
          ))}
          <button type="button" className="pin__touche pin__touche--discret" onClick={surFermeture}>
            Annuler
          </button>
          <button type="button" className="pin__touche" onClick={() => taper('0')}>
            0
          </button>
          <button
            type="button"
            className="pin__touche pin__touche--discret"
            onClick={effacer}
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}
