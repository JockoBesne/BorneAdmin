import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clientApi, definirJetonCsrf, type Utilisateur } from './api.js'

interface Session {
  utilisateur: Utilisateur | null
  chargement: boolean
  connexion: (identifiant: string, motDePasse: string) => Promise<void>
  deconnexion: () => Promise<void>
}

const ContexteSession = createContext<Session | null>(null)

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  const [chargement, setChargement] = useState(true)

  // Une session ouverte dans un autre onglet (ou avant un rechargement) est
  // reprise sans redemander le mot de passe.
  useEffect(() => {
    let annule = false
    clientApi
      .moi()
      .then(({ utilisateur: courant, jetonCsrf }) => {
        if (annule) return
        definirJetonCsrf(jetonCsrf)
        setUtilisateur(courant)
      })
      .catch(() => {
        if (!annule) setUtilisateur(null)
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [])

  const connexion = useCallback(async (identifiant: string, motDePasse: string) => {
    const { utilisateur: connecte, jetonCsrf } = await clientApi.connexion(identifiant, motDePasse)
    definirJetonCsrf(jetonCsrf)
    setUtilisateur(connecte)
  }, [])

  const deconnexion = useCallback(async () => {
    await clientApi.deconnexion().catch(() => undefined)
    definirJetonCsrf(null)
    setUtilisateur(null)
  }, [])

  const valeur = useMemo(
    () => ({ utilisateur, chargement, connexion, deconnexion }),
    [utilisateur, chargement, connexion, deconnexion],
  )

  return <ContexteSession.Provider value={valeur}>{children}</ContexteSession.Provider>
}

export function useSession(): Session {
  const contexte = useContext(ContexteSession)
  if (!contexte) throw new Error('useSession doit être utilisé dans FournisseurSession')
  return contexte
}
