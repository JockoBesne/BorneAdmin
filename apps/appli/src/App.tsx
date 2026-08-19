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
  /**
   * Page que le visiteur a sous les yeux, ou « null » sur l'accueil.
   *
   * Elle sert au passage en administration : on entre alors directement dans la
   * modification de **cette** page. C'est le geste attendu — on répare ce qu'on
   * est en train de regarder, on ne le recherche pas dans une liste de douze.
   */
  const [pageVisitee, setPageVisitee] = useState<string | null>(null)

  if (mode === 'admin') {
    return <Admin surFermeture={() => setMode('visiteur')} pageInitiale={pageVisitee} />
  }

  return (
    <>
      <Visiteur surPageOuverte={setPageVisitee} />
      <AccesAdmin surReussite={() => setMode('admin')} />
    </>
  )
}
