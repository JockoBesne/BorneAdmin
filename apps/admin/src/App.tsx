import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { FournisseurNotifications } from '@borne/ui'
import { Coquille } from './composants/Coquille.jsx'
import { Bibliotheque } from './pages/Bibliotheque.jsx'
import { Connexion } from './pages/Connexion.jsx'
import { Editeur } from './editeur/Editeur.jsx'
import { ListePages } from './pages/ListePages.jsx'
import { Parametres } from './pages/Parametres.jsx'
import { TableauDeBord } from './pages/TableauDeBord.jsx'
import { FournisseurSession, useSession } from './session.jsx'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export function App() {
  return (
    <FournisseurNotifications>
      <FournisseurSession>
        <Routage />
      </FournisseurSession>
    </FournisseurNotifications>
  )
}

function Routage() {
  const { utilisateur, chargement } = useSession()

  if (chargement) {
    return (
      <div className="plein-centre">
        <p className="plein-centre__texte">Chargement…</p>
      </div>
    )
  }

  if (!utilisateur) return <Connexion />

  return (
    <BrowserRouter basename={BASE}>
      <Routes>
        <Route element={<Coquille />}>
          <Route index element={<TableauDeBord />} />
          <Route path="pages" element={<ListePages />} />
          <Route path="photos-et-videos" element={<Bibliotheque />} />
          <Route path="parametres" element={<Parametres />} />
        </Route>
        {/* L'éditeur occupe tout l'écran : il sort de la coquille de navigation. */}
        <Route path="pages/:id" element={<Editeur />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
