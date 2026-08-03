import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface Notification {
  id: number
  message: string
  variante: 'neutre' | 'succes' | 'erreur'
  /** Action « Annuler » proposée pendant quelques secondes (§13.6). */
  action?: { libelle: string; surClic: () => void }
  duree: number
}

interface Contexte {
  montrer: (notification: Omit<Notification, 'id' | 'duree'> & { duree?: number }) => void
}

const ContexteNotifications = createContext<Contexte | null>(null)

export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Notification[]>([])
  const compteur = useRef(0)
  const minuteurs = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const retirer = useCallback((id: number) => {
    setListe((precedente) => precedente.filter((n) => n.id !== id))
    const minuteur = minuteurs.current.get(id)
    if (minuteur) {
      clearTimeout(minuteur)
      minuteurs.current.delete(id)
    }
  }, [])

  const montrer = useCallback<Contexte['montrer']>(
    (entree) => {
      const id = ++compteur.current
      const duree = entree.duree ?? (entree.action ? 10_000 : 6_000)
      setListe((precedente) => [...precedente, { ...entree, id, duree }])
      minuteurs.current.set(
        id,
        setTimeout(() => retirer(id), duree),
      )
    },
    [retirer],
  )

  // La copie de la référence évite de lire une valeur périmée au démontage.
  useEffect(() => {
    const enCours = minuteurs.current
    return () => {
      for (const minuteur of enCours.values()) clearTimeout(minuteur)
      enCours.clear()
    }
  }, [])

  const valeur = useMemo(() => ({ montrer }), [montrer])

  return (
    <ContexteNotifications.Provider value={valeur}>
      {children}
      <div className="ui-notifications" role="status" aria-live="polite">
        {liste.map((notification) => (
          <div
            key={notification.id}
            className={`ui-notification${
              notification.variante === 'neutre' ? '' : ` ui-notification--${notification.variante}`
            }`}
          >
            <span>{notification.message}</span>
            {notification.action ? (
              <button
                type="button"
                className="ui-notification__action"
                onClick={() => {
                  notification.action?.surClic()
                  retirer(notification.id)
                }}
              >
                {notification.action.libelle}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ContexteNotifications.Provider>
  )
}

export function useNotifications(): Contexte {
  const contexte = useContext(ContexteNotifications)
  if (!contexte) {
    throw new Error('useNotifications doit être utilisé dans FournisseurNotifications')
  }
  return contexte
}
