import { useState, type FormEvent } from 'react'
import { Bandeau, Bouton, Champ } from '@borne/ui'
import { ErreurApi } from '../api.js'
import { useSession } from '../session.jsx'

/** Écran volontairement nu : une seule action possible (§5.1). */
export function Connexion() {
  const { connexion } = useSession()
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [visible, setVisible] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const envoyer = async (evenement: FormEvent) => {
    evenement.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      await connexion(identifiant.trim(), motDePasse)
    } catch (cause) {
      setErreur(
        cause instanceof ErreurApi
          ? cause.message
          : "Le serveur n'a pas répondu. Vérifiez votre connexion.",
      )
      setEnCours(false)
    }
  }

  return (
    <div className="connexion">
      <form className="connexion__boite" onSubmit={envoyer}>
        <div className="connexion__marque">
          <span className="connexion__logo" aria-hidden="true">
            ◈
          </span>
          <h1 className="connexion__titre">Musée des Transmissions</h1>
          <p className="connexion__sous-titre">Gestion de la borne</p>
        </div>

        {erreur ? <Bandeau variante="erreur">{erreur}</Bandeau> : null}

        <Champ
          libelle="Identifiant"
          value={identifiant}
          onChange={(evenement) => setIdentifiant(evenement.target.value)}
          autoComplete="username"
          autoFocus
          required
        />

        <div className="connexion__mdp">
          <Champ
            libelle="Mot de passe"
            type={visible ? 'text' : 'password'}
            value={motDePasse}
            onChange={(evenement) => setMotDePasse(evenement.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="connexion__oeil"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {visible ? '🙈' : '👁'}
          </button>
        </div>

        <Bouton type="submit" variante="primaire" taille="l" chargement={enCours}>
          Se connecter
        </Bouton>

        <p className="connexion__aide">
          Mot de passe oublié ? Contactez la personne responsable des collections.
        </p>
      </form>
    </div>
  )
}
