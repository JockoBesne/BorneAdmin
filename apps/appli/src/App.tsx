import { useState } from 'react'
import { AccesAdmin } from './AccesAdmin.jsx'
import { Admin } from './Admin.jsx'
import { Visiteur } from './Visiteur.jsx'

/**
 * Application unique : le même programme sert la borne et l'administration.
 *
 * Le passage de l'un à l'autre est un simple changement d'état, sans
 * rechargement ni seconde fenêtre. L'accès caché n'est monté qu'en mode
 * visiteur — il n'a rien à faire par-dessus l'administration.
 */
export function App() {
  const [mode, setMode] = useState<'visiteur' | 'admin'>('visiteur')

  if (mode === 'admin') {
    return <Admin surFermeture={() => setMode('visiteur')} />
  }

  return (
    <>
      <Visiteur />
      <AccesAdmin surReussite={() => setMode('admin')} />
    </>
  )
}
