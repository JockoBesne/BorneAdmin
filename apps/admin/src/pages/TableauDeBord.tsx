import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bouton, Pastille, Squelette, useNotifications } from '@borne/ui'
import { clientApi, ErreurApi, type ResumePage, type Sante } from '../api.js'
import { SelecteurModele } from '../composants/SelecteurModele.jsx'
import { dateRelative, heure } from '../formats.js'
import { useSession } from '../session.jsx'

/**
 * Tableau de bord. Il répond immédiatement à trois questions :
 *   « la borne est-elle à jour ? », « qu'ai-je modifié récemment ? »,
 *   « comment retirer une page tout de suite ? » (§5.2, parcours C).
 */
export function TableauDeBord() {
  const { utilisateur } = useSession()
  const { montrer } = useNotifications()
  const naviguer = useNavigate()

  const [pages, setPages] = useState<ResumePage[] | null>(null)
  const [sante, setSante] = useState<Sante | null>(null)
  const [creation, setCreation] = useState(false)

  const recharger = useCallback(async () => {
    const [listePages, etat] = await Promise.all([
      clientApi.pages(),
      clientApi.sante().catch(() => null),
    ])
    setPages(listePages)
    setSante(etat)
  }, [])

  useEffect(() => {
    void recharger()
  }, [recharger])

  const retirer = async (page: ResumePage) => {
    try {
      await clientApi.retirer(page.id)
      montrer({
        message: `« ${page.titre} » a été retirée de la borne.`,
        variante: 'succes',
      })
      await recharger()
    } catch (cause) {
      montrer({
        message: cause instanceof ErreurApi ? cause.message : 'Le retrait a échoué.',
        variante: 'erreur',
      })
    }
  }

  const enLigne = pages?.filter((page) => page.etat === 'en_ligne') ?? []
  const brouillons = pages?.filter((page) => page.etat === 'brouillon') ?? []
  const recentes = [...(pages ?? [])]
    .sort((a, b) => b.modifieeLe.localeCompare(a.modifieeLe))
    .slice(0, 5)

  return (
    <div className="ecran">
      <div className="ecran__entete">
        <h1>Bonjour {utilisateur?.nomAffiche.split(' ')[0]}</h1>
        <Bouton variante="primaire" taille="l" onClick={() => setCreation(true)}>
          + Créer une page
        </Bouton>
      </div>

      {/* L'état de la borne est en haut, toujours : c'est la question n°1. */}
      <div className="etat-borne">
        <div className="etat-borne__gauche">
          <span className="etat-borne__pastille" aria-hidden="true" />
          <div>
            <p className="etat-borne__titre">
              {sante ? 'La borne est à jour' : "L'état de la borne est inconnu"}
            </p>
            <p className="etat-borne__detail">
              {enLigne.length} page{enLigne.length > 1 ? 's' : ''} en ligne ·{' '}
              {brouillons.length} brouillon{brouillons.length > 1 ? 's' : ''}
              {sante?.genereLe ? ` · dernière publication à ${heure(sante.genereLe)}` : ''}
            </p>
          </div>
        </div>
        <a className="etat-borne__lien" href="/" target="_blank" rel="noreferrer">
          Voir la borne ↗
        </a>
      </div>

      <section className="bloc">
        <div className="bloc__entete">
          <h2>Modifiées récemment</h2>
          <Link className="lien" to="/pages">
            Voir toutes les pages →
          </Link>
        </div>

        {pages === null ? (
          <div className="liste">
            {[0, 1, 2].map((index) => (
              <div key={index} className="liste__ligne">
                <Squelette hauteur={44} />
              </div>
            ))}
          </div>
        ) : recentes.length === 0 ? (
          <p className="vide-doux">Aucune page pour le moment.</p>
        ) : (
          <ul className="liste">
            {recentes.map((page) => (
              <li key={page.id} className="liste__ligne">
                <button
                  type="button"
                  className="liste__principal"
                  onClick={() => naviguer(`/pages/${page.id}`)}
                >
                  <span className="liste__titre">{page.titre}</span>
                  <Pastille etat={page.etat} modifications={page.aDesModifications} />
                </button>
                <span className="liste__meta">modifiée {dateRelative(page.modifieeLe)}</span>
                {page.etat === 'en_ligne' ? (
                  <Bouton variante="discret" onClick={() => void retirer(page)}>
                    Retirer de la borne
                  </Bouton>
                ) : (
                  <Bouton variante="discret" onClick={() => naviguer(`/pages/${page.id}`)}>
                    Reprendre
                  </Bouton>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {creation ? <SelecteurModele surFermeture={() => setCreation(false)} /> : null}
    </div>
  )
}
