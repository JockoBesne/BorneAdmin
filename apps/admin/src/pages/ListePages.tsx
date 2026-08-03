import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MODELES } from '@borne/contenu'
import { Bouton, Confirmation, EtatVide, Pastille, Squelette, useNotifications } from '@borne/ui'
import { clientApi, ErreurApi, type ResumePage } from '../api.js'
import { SelecteurModele } from '../composants/SelecteurModele.jsx'
import { dateRelative } from '../formats.js'

export function ListePages() {
  const naviguer = useNavigate()
  const { montrer } = useNotifications()

  const [pages, setPages] = useState<ResumePage[] | null>(null)
  const [corbeille, setCorbeille] = useState<ResumePage[]>([])
  const [recherche, setRecherche] = useState('')
  const [creation, setCreation] = useState(false)
  const [aSupprimer, setASupprimer] = useState<ResumePage | null>(null)
  const [enCours, setEnCours] = useState(false)
  const glisse = useRef<number | null>(null)

  const recharger = useCallback(async () => {
    const [liste, poubelle] = await Promise.all([clientApi.pages(), clientApi.pages(true)])
    setPages(liste)
    setCorbeille(poubelle)
  }, [])

  useEffect(() => {
    void recharger()
  }, [recharger])

  const echouer = (cause: unknown, secours: string) =>
    montrer({
      message: cause instanceof ErreurApi ? cause.message : secours,
      variante: 'erreur',
    })

  /** Réordonnancement optimiste : l'affichage bouge tout de suite, le serveur suit. */
  const appliquerOrdre = async (nouvelOrdre: ResumePage[], precedent: ResumePage[]) => {
    setPages(nouvelOrdre)
    try {
      await clientApi.reordonner(nouvelOrdre.map((page) => page.id))
      montrer({
        message: 'Ordre enregistré.',
        variante: 'neutre',
        action: {
          libelle: 'Annuler',
          surClic: () => {
            setPages(precedent)
            void clientApi.reordonner(precedent.map((page) => page.id)).catch(() => undefined)
          },
        },
      })
    } catch (cause) {
      setPages(precedent)
      echouer(cause, "L'ordre n'a pas pu être enregistré.")
    }
  }

  const deplacer = (depuis: number, vers: number) => {
    if (!pages || vers < 0 || vers >= pages.length || depuis === vers) return
    const precedent = pages
    const copie = [...pages]
    const [element] = copie.splice(depuis, 1)
    if (!element) return
    copie.splice(vers, 0, element)
    void appliquerOrdre(copie, precedent)
  }

  const basculerPublication = async (page: ResumePage) => {
    try {
      if (page.etat === 'en_ligne') {
        await clientApi.retirer(page.id)
        montrer({ message: `« ${page.titre} » a été retirée de la borne.`, variante: 'succes' })
      } else {
        await clientApi.mettreEnLigne(page.id)
        montrer({ message: `« ${page.titre} » est en ligne.`, variante: 'succes' })
      }
      await recharger()
    } catch (cause) {
      if (cause instanceof ErreurApi && cause.code === 'CONTENU_INCOMPLET') {
        montrer({
          message: `« ${page.titre} » est incomplète. Ouvrez-la pour voir ce qu'il manque.`,
          variante: 'erreur',
        })
        return
      }
      echouer(cause, "L'opération a échoué.")
    }
  }

  const supprimer = async () => {
    if (!aSupprimer) return
    setEnCours(true)
    try {
      await clientApi.supprimerPage(aSupprimer.id)
      montrer({ message: `« ${aSupprimer.titre} » est dans la corbeille.`, variante: 'neutre' })
      setASupprimer(null)
      await recharger()
    } catch (cause) {
      echouer(cause, 'La suppression a échoué.')
    } finally {
      setEnCours(false)
    }
  }

  const restaurer = async (page: ResumePage) => {
    try {
      await clientApi.restaurerPage(page.id)
      montrer({ message: `« ${page.titre} » a été restaurée.`, variante: 'succes' })
      await recharger()
    } catch (cause) {
      echouer(cause, 'La restauration a échoué.')
    }
  }

  const filtrees = (pages ?? []).filter((page) =>
    page.titre.toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr')),
  )

  return (
    <div className="ecran">
      <div className="ecran__entete">
        <h1>Pages</h1>
        <Bouton variante="primaire" taille="l" onClick={() => setCreation(true)}>
          + Créer une page
        </Bouton>
      </div>

      <div className="barre-outils">
        <input
          type="search"
          className="recherche"
          placeholder="Rechercher une page…"
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          aria-label="Rechercher une page"
        />
      </div>

      <p className="liste__consigne">
        Ordre d'affichage sur la borne — glissez une ligne, ou utilisez les flèches.
      </p>

      {pages === null ? (
        <div className="liste">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="liste__ligne">
              <Squelette hauteur={44} />
            </div>
          ))}
        </div>
      ) : filtrees.length === 0 ? (
        <EtatVide
          titre={recherche ? 'Aucune page ne correspond' : 'Aucune page pour le moment'}
          description={
            recherche
              ? 'Essayez un autre mot.'
              : 'Créez votre première page : choisissez un modèle, remplissez-le, publiez.'
          }
          action={
            recherche ? null : (
              <Bouton variante="primaire" onClick={() => setCreation(true)}>
                + Créer une page
              </Bouton>
            )
          }
        />
      ) : (
        <ul className="liste liste--triable">
          {filtrees.map((page, index) => (
            <li
              key={page.id}
              className="liste__ligne liste__ligne--triable"
              draggable
              onDragStart={() => {
                glisse.current = index
              }}
              onDragOver={(evenement) => evenement.preventDefault()}
              onDrop={() => {
                if (glisse.current !== null) deplacer(glisse.current, index)
                glisse.current = null
              }}
            >
              <span className="liste__rang" aria-hidden="true">
                {index + 1}
              </span>

              {/* Alternative clavier obligatoire au glisser-déposer (§6.9). */}
              <span className="liste__fleches">
                <button
                  type="button"
                  className="liste__fleche"
                  onClick={() => deplacer(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Monter « ${page.titre} »`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="liste__fleche"
                  onClick={() => deplacer(index, index + 1)}
                  disabled={index === filtrees.length - 1}
                  aria-label={`Descendre « ${page.titre} »`}
                >
                  ▼
                </button>
              </span>

              <button
                type="button"
                className="liste__principal"
                onClick={() => naviguer(`/pages/${page.id}`)}
              >
                <span className="liste__titre">{page.titre}</span>
                <span className="liste__modele">{MODELES[page.modele].nom}</span>
                <Pastille etat={page.etat} modifications={page.aDesModifications} />
              </button>

              <span className="liste__meta">{dateRelative(page.modifieeLe)}</span>

              <span className="liste__actions">
                <Bouton variante="discret" onClick={() => void basculerPublication(page)}>
                  {page.etat === 'en_ligne' ? 'Retirer de la borne' : 'Mettre en ligne'}
                </Bouton>
                <Bouton
                  variante="discret"
                  onClick={() => setASupprimer(page)}
                  aria-label={`Supprimer « ${page.titre} »`}
                >
                  Supprimer
                </Bouton>
              </span>
            </li>
          ))}
        </ul>
      )}

      {corbeille.length > 0 ? (
        <section className="bloc">
          <div className="bloc__entete">
            <h2>Corbeille ({corbeille.length})</h2>
          </div>
          <ul className="liste">
            {corbeille.map((page) => (
              <li key={page.id} className="liste__ligne">
                <span className="liste__titre liste__titre--eteint">{page.titre}</span>
                <span className="liste__meta">
                  supprimée {page.supprimeeLe ? dateRelative(page.supprimeeLe) : ''} — restaurable
                  30 jours
                </span>
                <Bouton variante="secondaire" onClick={() => void restaurer(page)}>
                  Restaurer
                </Bouton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {creation ? <SelecteurModele surFermeture={() => setCreation(false)} /> : null}

      {aSupprimer ? (
        <Confirmation
          titre={`Supprimer « ${aSupprimer.titre} » ?`}
          consequence="La page sera placée dans la corbeille. Vous pourrez la récupérer pendant 30 jours."
          libelleConfirmation="Supprimer"
          destructive
          enCours={enCours}
          surConfirmation={() => void supprimer()}
          surAnnulation={() => setASupprimer(null)}
        />
      ) : null}
    </div>
  )
}
