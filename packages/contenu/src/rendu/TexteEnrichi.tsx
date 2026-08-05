import { Fragment, type ReactNode } from 'react'
import { texteBrut } from '../texte.js'
import type { LigneTexte, MorceauTexte } from '../types.js'

/**
 * Rendu d'un texte mis en forme : gras, italique, souligné, et lignes en liste.
 *
 * Le texte est stocké en morceaux portant leurs marques, jamais en HTML : ni
 * script ni style ne peut donc arriver par un texte collé depuis un traitement
 * de texte — c'est vrai par construction, pas par nettoyage.
 */

function Morceaux({ morceaux }: { morceaux: MorceauTexte[] }) {
  return (
    <>
      {morceaux.map((morceau, i) => {
        let noeud: ReactNode = morceau.texte
        if (morceau.souligne) noeud = <u>{noeud}</u>
        if (morceau.italique) noeud = <em>{noeud}</em>
        if (morceau.gras) noeud = <strong>{noeud}</strong>
        return <Fragment key={i}>{noeud}</Fragment>
      })}
    </>
  )
}

type Bloc = { type: 'paragraphe' | 'liste'; lignes: LigneTexte[] }

/** Les lignes en puces qui se suivent forment une seule liste. */
function regrouper(lignes: LigneTexte[]): Bloc[] {
  const blocs: Bloc[] = []
  for (const ligne of lignes) {
    // Une ligne vide sépare les paragraphes, elle ne s'affiche pas.
    if (texteBrut([ligne]).trim() === '') continue

    const dernier = blocs[blocs.length - 1]
    if (ligne.puce && dernier?.type === 'liste') dernier.lignes.push(ligne)
    else blocs.push({ type: ligne.puce ? 'liste' : 'paragraphe', lignes: [ligne] })
  }
  return blocs
}

export function TexteEnrichi({ lignes }: { lignes: LigneTexte[] }) {
  return (
    <>
      {regrouper(lignes).map((bloc, i) =>
        bloc.type === 'liste' ? (
          <ul key={i} className="b-liste">
            {bloc.lignes.map((ligne, j) => (
              <li key={j}>
                <Morceaux morceaux={ligne.morceaux} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="b-paragraphe">
            <Morceaux morceaux={bloc.lignes[0]?.morceaux ?? []} />
          </p>
        ),
      )}
    </>
  )
}
