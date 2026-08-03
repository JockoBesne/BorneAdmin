import { Fragment, type ReactNode } from 'react'

/**
 * Rendu du sous-ensemble de texte enrichi (§7.5.3) :
 *   **gras**, _italique_, et lignes commençant par « - » pour une liste.
 *
 * Aucun HTML n'est stocké, donc aucun HTML n'est rendu : l'injection de script
 * et les styles collés depuis Word sont impossibles par construction.
 */

const MARQUAGE = /(\*\*[^*]+\*\*|_[^_]+_)/g

function enrichirLigne(ligne: string): ReactNode[] {
  return ligne
    .split(MARQUAGE)
    .filter((part) => part !== '')
    .map((part, i) => {
      if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) {
        return <em key={i}>{part.slice(1, -1)}</em>
      }
      return <Fragment key={i}>{part}</Fragment>
    })
}

type Bloc = { type: 'paragraphe'; lignes: string[] } | { type: 'liste'; lignes: string[] }

function decouper(texte: string): Bloc[] {
  const blocs: Bloc[] = []
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim()
    if (ligne === '') continue

    const estPuce = ligne.startsWith('- ')
    const contenu = estPuce ? ligne.slice(2) : ligne
    const dernier = blocs[blocs.length - 1]

    if (estPuce) {
      if (dernier?.type === 'liste') dernier.lignes.push(contenu)
      else blocs.push({ type: 'liste', lignes: [contenu] })
    } else {
      blocs.push({ type: 'paragraphe', lignes: [contenu] })
    }
  }
  return blocs
}

export function TexteEnrichi({ texte }: { texte: string }) {
  const blocs = decouper(texte)
  return (
    <>
      {blocs.map((bloc, i) =>
        bloc.type === 'liste' ? (
          <ul key={i} className="b-liste">
            {bloc.lignes.map((ligne, j) => (
              <li key={j}>{enrichirLigne(ligne)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="b-paragraphe">
            {enrichirLigne(bloc.lignes[0] ?? '')}
          </p>
        ),
      )}
    </>
  )
}
