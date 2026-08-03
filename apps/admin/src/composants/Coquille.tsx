import { NavLink, Outlet } from 'react-router-dom'
import { Bouton } from '@borne/ui'
import { useSession } from '../session.jsx'

const LIENS = [
  { vers: '/', libelle: 'Tableau de bord', exact: true },
  { vers: '/pages', libelle: 'Pages', exact: false },
  { vers: '/photos-et-videos', libelle: 'Photos et vidéos', exact: false },
  { vers: '/parametres', libelle: 'Paramètres', exact: false },
]

export function Coquille() {
  const { utilisateur, deconnexion } = useSession()

  const initiales = (utilisateur?.nomAffiche ?? '')
    .split(' ')
    .map((mot) => mot.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="coquille">
      <header className="entete">
        <div className="entete__marque">
          <span className="entete__logo" aria-hidden="true">
            ◈
          </span>
          Borne du musée
        </div>

        <nav className="entete__nav" aria-label="Navigation principale">
          {LIENS.map((lien) => (
            <NavLink
              key={lien.vers}
              to={lien.vers}
              end={lien.exact}
              className={({ isActive }) => `entete__lien${isActive ? ' entete__lien--actif' : ''}`}
            >
              {lien.libelle}
            </NavLink>
          ))}
        </nav>

        <div className="entete__compte">
          <span className="entete__initiales" title={utilisateur?.nomAffiche}>
            {initiales}
          </span>
          <Bouton variante="discret" onClick={() => void deconnexion()}>
            Se déconnecter
          </Bouton>
        </div>
      </header>

      <main className="contenu">
        <Outlet />
      </main>
    </div>
  )
}
