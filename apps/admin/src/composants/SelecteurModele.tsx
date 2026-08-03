import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LISTE_MODELES, type IdModele } from '@borne/contenu'
import { RenduPage, ToileBorne } from '@borne/contenu/rendu'
import { Bandeau, Bouton, Champ, Modale, useNotifications } from '@borne/ui'
import { clientApi, ErreurApi } from '../api.js'

/**
 * Choix du modèle à la création (§5.4).
 * Les vignettes sont des rendus réels réduits des composants de modèle, pas des
 * dessins : elles ne peuvent pas mentir sur ce que l'utilisateur obtiendra.
 */
export function SelecteurModele({ surFermeture }: { surFermeture: () => void }) {
  const naviguer = useNavigate()
  const { montrer } = useNotifications()
  const [choisi, setChoisi] = useState<IdModele | null>(null)
  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const creer = async () => {
    if (!choisi) return
    const propre = titre.trim()
    if (propre === '') {
      setErreur('Il manque le titre de la page.')
      return
    }

    setEnCours(true)
    try {
      const page = await clientApi.creerPage(propre, choisi)
      montrer({ message: `« ${propre} » a été créée.`, variante: 'succes' })
      naviguer(`/pages/${page.id}`)
    } catch (cause) {
      setErreur(cause instanceof ErreurApi ? cause.message : 'La création a échoué.')
      setEnCours(false)
    }
  }

  if (choisi) {
    const modele = LISTE_MODELES.find((m) => m.id === choisi)
    return (
      <Modale
        titre="Comment s'appelle cette page ?"
        surFermeture={surFermeture}
        pied={
          <>
            <Bouton variante="discret" onClick={() => setChoisi(null)} disabled={enCours}>
              Changer de modèle
            </Bouton>
            <Bouton variante="primaire" onClick={() => void creer()} chargement={enCours}>
              Créer la page
            </Bouton>
          </>
        }
      >
        <div className="creation">
          <Bandeau variante="info">
            Modèle choisi : <strong>{modele?.nom}</strong>. Ce titre sera affiché en haut de la
            page sur la borne ; vous pourrez le modifier ensuite.
          </Bandeau>
          <Champ
            libelle="Titre de la page"
            value={titre}
            onChange={(evenement) => setTitre(evenement.target.value)}
            erreur={erreur}
            autoFocus
            maxLength={70}
            onKeyDown={(evenement) => {
              if (evenement.key === 'Enter') void creer()
            }}
          />
        </div>
      </Modale>
    )
  }

  return (
    <Modale titre="Quel type de page voulez-vous créer ?" taille="plein" surFermeture={surFermeture}>
      <div className="modeles">
        {LISTE_MODELES.map((modele) => (
          <div key={modele.id} className="modele-carte">
            <div className="modele-carte__apercu" aria-hidden="true">
              <ToileBorne>
                <RenduPage contenu={modele.contenuVide()} media={() => null} />
              </ToileBorne>
            </div>
            <div className="modele-carte__texte">
              <h3>{modele.nom}</h3>
              <p>{modele.description}</p>
            </div>
            <Bouton variante="primaire" onClick={() => setChoisi(modele.id)}>
              Choisir
            </Bouton>
          </div>
        ))}
      </div>

      <p className="modeles__note">
        ℹ Le modèle ne pourra plus être changé ensuite. Vous pourrez toujours créer une nouvelle
        page si vous changez d'avis.
      </p>
    </Modale>
  )
}
