import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContenuPage, Probleme } from '@borne/contenu'
import { clientApi, ErreurApi } from '../api.js'

export type EtatEnregistrement =
  | 'repos'
  | 'modifications'
  | 'enregistrement'
  | 'enregistre'
  | 'echec'

const DELAI_MS = 800

/**
 * Enregistrement automatique du brouillon (§7.4.3, exigence N07).
 *
 * Le contenu existe à trois endroits : la mémoire de l'onglet, le stockage
 * local du navigateur et le serveur. Il n'est donc jamais perdu, même si
 * l'onglet est fermé brutalement ou si le réseau tombe.
 */
export function useBrouillon(pageId: string | undefined) {
  const [etat, setEtat] = useState<EtatEnregistrement>('repos')
  const [horodatage, setHorodatage] = useState<string | null>(null)
  const [problemes, setProblemes] = useState<Probleme[]>([])
  const [conflit, setConflit] = useState<string | null>(null)

  const modifieeLe = useRef<string | null>(null)
  const premierRendu = useRef(true)

  const cle = pageId ? `borne.brouillon.${pageId}` : null

  /** Appelé une fois la page chargée : fixe la référence de concurrence. */
  const initialiser = useCallback((iso: string, problemesInitiaux: Probleme[]) => {
    modifieeLe.current = iso
    setHorodatage(iso)
    setProblemes(problemesInitiaux)
    premierRendu.current = true
    setEtat('repos')
  }, [])

  const enregistrer = useCallback(
    async (titre: string, contenu: ContenuPage) => {
      if (!pageId) return
      setEtat('enregistrement')
      try {
        const resultat = await clientApi.enregistrerBrouillon(pageId, {
          titre,
          contenu,
          modifieeLe: modifieeLe.current,
        })
        modifieeLe.current = resultat.modifieeLe
        setHorodatage(resultat.modifieeLe)
        setProblemes(resultat.problemes)
        setEtat('enregistre')
        setConflit(null)
        if (cle) localStorage.removeItem(cle)
      } catch (cause) {
        // Le travail est mis à l'abri localement avant toute autre chose.
        if (cle) {
          try {
            localStorage.setItem(cle, JSON.stringify({ titre, contenu }))
          } catch {
            /* quota atteint : le contenu reste en mémoire de l'onglet */
          }
        }
        if (cause instanceof ErreurApi && cause.code === 'CONFLIT_EDITION') {
          setConflit(cause.message)
        }
        setEtat('echec')
      }
    },
    [pageId, cle],
  )

  /** Programme un enregistrement 800 ms après la dernière frappe. */
  const planifier = useCallback(
    (titre: string, contenu: ContenuPage) => {
      if (premierRendu.current) {
        premierRendu.current = false
        return () => undefined
      }
      setEtat('modifications')
      const minuteur = setTimeout(() => void enregistrer(titre, contenu), DELAI_MS)
      return () => clearTimeout(minuteur)
    },
    [enregistrer],
  )

  // Empêche la fermeture de l'onglet tant qu'un enregistrement est en attente.
  useEffect(() => {
    if (etat !== 'modifications' && etat !== 'enregistrement' && etat !== 'echec') return
    const avertir = (evenement: BeforeUnloadEvent) => {
      evenement.preventDefault()
      evenement.returnValue = ''
    }
    window.addEventListener('beforeunload', avertir)
    return () => window.removeEventListener('beforeunload', avertir)
  }, [etat])

  /** Brouillon local plus récent que le serveur (échec réseau précédent). */
  const brouillonLocal = useCallback((): { titre: string; contenu: ContenuPage } | null => {
    if (!cle) return null
    try {
      const brut = localStorage.getItem(cle)
      return brut ? (JSON.parse(brut) as { titre: string; contenu: ContenuPage }) : null
    } catch {
      return null
    }
  }, [cle])

  return {
    etat,
    horodatage,
    problemes,
    conflit,
    initialiser,
    planifier,
    enregistrer,
    brouillonLocal,
    setProblemes,
  }
}
