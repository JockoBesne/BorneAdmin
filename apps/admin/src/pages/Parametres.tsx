import { useEffect, useState } from 'react'
import type { Reglages } from '@borne/contenu'
import { Bandeau, Bouton, Champ, useNotifications } from '@borne/ui'
import { clientApi, ErreurApi } from '../api.js'
import { dateRelative } from '../formats.js'
import { useSession } from '../session.jsx'

export function Parametres() {
  const { utilisateur } = useSession()
  const { montrer } = useNotifications()
  const estAdmin = utilisateur?.role === 'administrateur'

  const [valeurs, setValeurs] = useState<(Reglages & { pinBorne: string | null }) | null>(null)
  const [journal, setJournal] = useState<{ horodatage: string; resume: string }[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    void clientApi.parametres().then(setValeurs)
    if (estAdmin) void clientApi.journal().then(setJournal).catch(() => undefined)
  }, [estAdmin])

  if (!valeurs) return <div className="ecran" />

  const enregistrer = async () => {
    setEnCours(true)
    setErreur(null)
    try {
      await clientApi.enregistrerParametres({
        titreVeille: valeurs.titreVeille,
        sousTitreVeille: valeurs.sousTitreVeille,
        minutesAvantVeille: valeurs.minutesAvantVeille,
        ...(estAdmin && valeurs.pinBorne ? { pinBorne: valeurs.pinBorne } : {}),
      })
      montrer({ message: 'Réglages enregistrés.', variante: 'succes' })
    } catch (cause) {
      setErreur(cause instanceof ErreurApi ? cause.message : "L'enregistrement a échoué.")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="ecran">
      <div className="ecran__entete">
        <h1>Paramètres</h1>
        <Bouton variante="primaire" onClick={() => void enregistrer()} chargement={enCours}>
          Enregistrer
        </Bouton>
      </div>

      {erreur ? <Bandeau variante="erreur">{erreur}</Bandeau> : null}

      <section className="bloc">
        <div className="bloc__entete">
          <h2>Borne</h2>
        </div>
        <div className="formulaire">
          <Champ
            libelle="Titre affiché en veille"
            value={valeurs.titreVeille}
            maxLength={80}
            onChange={(evenement) => setValeurs({ ...valeurs, titreVeille: evenement.target.value })}
          />
          <Champ
            libelle="Phrase d'invitation"
            aide="Affichée sous le titre, sur l'écran de veille."
            value={valeurs.sousTitreVeille}
            maxLength={120}
            onChange={(evenement) =>
              setValeurs({ ...valeurs, sousTitreVeille: evenement.target.value })
            }
          />
          <Champ
            libelle="Retour à l'accueil après (minutes sans interaction)"
            type="number"
            min={1}
            max={60}
            value={valeurs.minutesAvantVeille}
            onChange={(evenement) =>
              setValeurs({
                ...valeurs,
                minutesAvantVeille: Number(evenement.target.value) || 3,
              })
            }
          />
        </div>
      </section>

      {estAdmin ? (
        <section className="bloc">
          <div className="bloc__entete">
            <h2>Accès depuis la borne</h2>
          </div>
          <div className="formulaire">
            <Bandeau variante="info">
              Sur la borne, un appui maintenu <strong>5 secondes</strong> dans le coin supérieur
              droit de l'écran ouvre le pavé numérique. Ce code déverrouille l'accès à
              l'administration ; chacun se connecte ensuite avec son propre compte.
            </Bandeau>
            <Champ
              libelle="Code d'accès de la borne"
              aide="4 à 8 chiffres."
              inputMode="numeric"
              pattern="\d*"
              value={valeurs.pinBorne ?? ''}
              maxLength={8}
              onChange={(evenement) =>
                setValeurs({ ...valeurs, pinBorne: evenement.target.value.replace(/\D/g, '') })
              }
            />
          </div>
        </section>
      ) : null}

      {estAdmin ? (
        <section className="bloc">
          <div className="bloc__entete">
            <h2>Journal des actions</h2>
          </div>
          <ul className="journal">
            {journal.slice(0, 20).map((entree, index) => (
              <li key={index}>
                <span className="journal__date">{dateRelative(entree.horodatage)}</span>
                <span>{entree.resume}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
