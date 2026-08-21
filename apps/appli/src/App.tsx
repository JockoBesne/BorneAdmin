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
   *
   * Elle sert aussi au retour : l'administration la renvoie en se fermant, et
   * la borne rouvre la page qu'on venait de modifier. Aller et retour par le
   * même fil.
   */
  const [pageVisitee, setPageVisitee] = useState<string | null>(null)

  if (mode === 'admin') {
    return (
      <Admin
        pageInitiale={pageVisitee}
        // Et le chemin inverse : on revient à la borne **sur la page qu'on
        // était en train de modifier**. Fermer depuis la liste des pages ramène
        // à l'accueil, comme avant.
        surFermeture={(page) => {
          setPageVisitee(page)
          setMode('visiteur')
        }}
      />
    )
  }

  return (
    <>
      <Visiteur pageInitiale={pageVisitee} surPageOuverte={setPageVisitee} />
      <AccesAdmin surReussite={() => setMode('admin')} />
    </>
  )
}
