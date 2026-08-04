import { useMemo, useRef, useState } from 'react'
import type { EvenementFrise, ValeurFrise, ValeurQuiz } from '../types.js'

/**
 * Ateliers interactifs affichés au visiteur.
 *
 * Deux règles valables pour les deux ateliers :
 *
 * 1. **Tout se joue au doigt, sans glisser-déposer.** On touche un élément, puis
 *    on touche sa destination. Le glisser-déposer est peu fiable sur une dalle
 *    tactile de 65 pouces (le doigt masque la cible, le geste part de travers) —
 *    deux appuis, eux, ne ratent jamais.
 * 2. **Aucun minuteur JavaScript.** Tout le mouvement est fait en CSS, sur
 *    `transform` et `opacity` (composés par la carte graphique). Rien à nettoyer
 *    au démontage, et l'animation reste fluide même si la borne tourne depuis
 *    des semaines.
 *
 * L'état d'un atelier vit dans le composant : changer de page le remonte, donc
 * chaque visiteur retrouve l'atelier vierge sans qu'on ait à le réinitialiser.
 */

// ── Quiz ─────────────────────────────────────────────────────────────────────

export function AtelierQuiz({ valeur, jouable }: { valeur: ValeurQuiz; jouable: boolean }) {
  // On coche d'abord, on valide ensuite — comme la frise. C'est ce qui rend
  // possible une question à plusieurs bonnes réponses : avec une correction au
  // premier toucher, le visiteur n'aurait jamais l'occasion d'en cocher deux.
  const [choisies, setChoisies] = useState<ReadonlySet<string>>(() => new Set())
  const [corrige, setCorrige] = useState(false)

  const reponses = valeur.reponses.filter((reponse) => reponse.texte.trim() !== '')
  const correctes = new Set(reponses.filter((reponse) => reponse.correcte).map((r) => r.id))
  const plusieursBonnes = correctes.size > 1

  const basculer = (id: string) => {
    if (!jouable || corrige) return
    // Forme fonctionnelle : deux appuis rapprochés ne peuvent pas se marcher
    // dessus en lisant la même valeur d'état.
    setChoisies((precedent) => {
      const suivant = new Set(precedent)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  const oublies = [...correctes].filter((id) => !choisies.has(id))
  const enTrop = [...choisies].filter((id) => !correctes.has(id))
  const exact = oublies.length === 0 && enTrop.length === 0

  const verdict = exact
    ? plusieursBonnes
      ? 'Toutes les bonnes réponses'
      : 'Bonne réponse'
    : enTrop.length === 0
      ? oublies.length > 1
        ? 'Il manquait plusieurs réponses'
        : 'Il manquait une réponse'
      : 'Ce n’est pas tout à fait ça'

  return (
    <section className={`atl atl--quiz${jouable ? '' : ' atl--apercu'}`}>
      <header className="atl__entete">
        <span className="atl__etiquette">Quiz</span>
        <h3 className="atl__question">{valeur.question}</h3>
      </header>

      <ul className="atl__reponses">
        {reponses.map((reponse) => {
          const cochee = choisies.has(reponse.id)

          // Avant validation : seul l'état « coché » se voit, jamais la
          // solution. Après : le vert et le rouge, et les réponses ni cochées
          // ni justes s'effacent pour ne pas encombrer la lecture.
          const etat = !corrige
            ? cochee
              ? ' atl__reponse--choisie'
              : ''
            : reponse.correcte
              ? ' atl__reponse--juste'
              : cochee
                ? ' atl__reponse--faux'
                : ' atl__reponse--eteinte'

          // L'explication n'a d'intérêt que sur les bonnes réponses (ce qu'il
          // fallait retenir) et sur celles cochées à tort (pourquoi c'est faux).
          const montrerExplication =
            corrige && (reponse.correcte || cochee) && reponse.explication.trim() !== ''

          return (
            <li key={reponse.id}>
              <button
                type="button"
                className={`atl__reponse${etat}`}
                disabled={!jouable || corrige}
                aria-pressed={cochee}
                onClick={() => basculer(reponse.id)}
              >
                <span className="atl__puce" aria-hidden="true">
                  {corrige ? (reponse.correcte ? '✓' : cochee ? '✕' : '') : cochee ? '✓' : ''}
                </span>
                <span className="atl__reponse-texte">{reponse.texte}</span>
              </button>
              {montrerExplication ? (
                <p className="atl__explication atl__explication--ligne">{reponse.explication}</p>
              ) : null}
            </li>
          )
        })}
      </ul>

      {!corrige ? (
        <>
          <p className="frz__aide">
            {plusieursBonnes
              ? 'Plusieurs réponses sont possibles. Touchez-les, puis validez.'
              : 'Touchez votre réponse, puis validez.'}
          </p>
          <button
            type="button"
            className="atl__valider"
            disabled={!jouable || choisies.size === 0}
            onClick={() => setCorrige(true)}
          >
            Vérifier
          </button>
        </>
      ) : (
        <div className="atl__retour" role="status">
          <p className="atl__verdict">{verdict}</p>
          <button
            type="button"
            className="atl__rejouer"
            onClick={() => {
              setChoisies(new Set())
              setCorrige(false)
            }}
          >
            Recommencer
          </button>
        </div>
      )}
    </section>
  )
}

// ── Frise à remettre dans l'ordre ────────────────────────────────────────────

/** Mélange une copie du tableau (Fisher-Yates). */
function melanger<T>(elements: T[]): T[] {
  const copie = [...elements]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j]!, copie[i]!]
  }
  return copie
}

export function AtelierFrise({ valeur, jouable }: { valeur: ValeurFrise; jouable: boolean }) {
  const evenements = useMemo(
    () => valeur.evenements.filter((evenement) => evenement.libelle.trim() !== ''),
    [valeur.evenements],
  )

  /** L'ordre attendu : les années croissantes. Rien n'est numéroté à la main. */
  const attendu = useMemo(
    () => [...evenements].sort((a, b) => a.annee - b.annee),
    [evenements],
  )

  // Mélange fixé au montage : il ne doit pas changer à chaque rendu, sinon les
  // cartes sauteraient sous le doigt du visiteur.
  const melange = useMemo(() => melanger(evenements), [evenements])

  // Une case par position ; « null » = case encore vide.
  const [cases, setCases] = useState<(string | null)[]>(() => evenements.map(() => null))
  const [corrige, setCorrige] = useState(false)

  // La carte tenue en main est gardée dans une référence *en plus* de l'état :
  // deux appuis rapprochés (prendre une carte, poser aussitôt) tombent dans le
  // même cycle de rendu, et la fonction de pose lirait alors une valeur
  // périmée — la carte resterait dans la réserve. L'état ne sert qu'à
  // l'affichage, la référence fait foi.
  const [prise, setPriseEtat] = useState<string | null>(null)
  const priseRef = useRef<string | null>(null)
  const changerPrise = (id: string | null) => {
    priseRef.current = id
    setPriseEtat(id)
  }

  const placees = new Set(cases.filter((id): id is string => id !== null))
  const restantes = melange.filter((evenement) => !placees.has(evenement.id))
  const complet = cases.every((id) => id !== null)

  const parId = (id: string | null): EvenementFrise | undefined =>
    id === null ? undefined : evenements.find((evenement) => evenement.id === id)

  /** Une case est juste si l'année posée est celle attendue à cette position.
   *  Comparer les années (et non les identifiants) accepte naturellement deux
   *  événements de la même année dans n'importe quel ordre. */
  const caseJuste = (index: number): boolean => {
    const pose = parId(cases[index] ?? null)
    return pose !== undefined && pose.annee === attendu[index]?.annee
  }

  const toucherCase = (index: number) => {
    if (!jouable || corrige) return
    const tenue = priseRef.current
    setCases((precedent) => {
      const suivant = [...precedent]
      const occupant = suivant[index] ?? null

      if (tenue !== null) {
        // On pose la carte tenue ; si la case était occupée, son occupant
        // retourne dans la réserve.
        const depuis = suivant.indexOf(tenue)
        if (depuis !== -1) suivant[depuis] = occupant
        suivant[index] = tenue
      } else if (occupant !== null) {
        // Case pleine touchée à main vide : on reprend la carte.
        suivant[index] = null
      }
      return suivant
    })
    changerPrise(null)
  }

  const recommencer = () => {
    setCases(evenements.map(() => null))
    changerPrise(null)
    setCorrige(false)
  }

  const justes = cases.filter((_, index) => caseJuste(index)).length

  return (
    <section className={`atl atl--frise${jouable ? '' : ' atl--apercu'}`}>
      <header className="atl__entete">
        <span className="atl__etiquette">Frise</span>
        <h3 className="atl__question">
          {valeur.consigne.trim() !== ''
            ? valeur.consigne
            : 'Replacez ces événements du plus ancien au plus récent.'}
        </h3>
      </header>

      <ol className="frz__ligne">
        {cases.map((id, index) => {
          const evenement = parId(id)
          const etat = !corrige ? '' : caseJuste(index) ? ' frz__case--juste' : ' frz__case--faux'
          return (
            <li key={index} className="frz__poste">
              <button
                type="button"
                className={`frz__case${evenement ? ' frz__case--pleine' : ''}${etat}`}
                disabled={!jouable || corrige}
                onClick={() => toucherCase(index)}
                aria-label={
                  evenement ? `Position ${index + 1} : ${evenement.libelle}` : `Position ${index + 1}, vide`
                }
              >
                <span className="frz__rang" aria-hidden="true">
                  {index + 1}
                </span>
                {evenement ? (
                  <span className="frz__libelle">{evenement.libelle}</span>
                ) : (
                  <span className="frz__attente">à placer</span>
                )}
                {corrige && evenement ? (
                  <span className="frz__annee">{evenement.annee}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>

      {!corrige ? (
        <>
          <ul className="frz__reserve">
            {restantes.map((evenement) => (
              <li key={evenement.id}>
                <button
                  type="button"
                  className={`frz__carte${prise === evenement.id ? ' frz__carte--prise' : ''}`}
                  disabled={!jouable}
                  aria-pressed={prise === evenement.id}
                  onClick={() => changerPrise(priseRef.current === evenement.id ? null : evenement.id)}
                >
                  {evenement.libelle}
                </button>
              </li>
            ))}
          </ul>

          {restantes.length > 0 ? (
            <p className="frz__aide">
              {prise === null
                ? 'Touchez un événement, puis la case où le placer.'
                : 'Touchez maintenant la case où le placer.'}
            </p>
          ) : null}

          <button
            type="button"
            className="atl__valider"
            disabled={!jouable || !complet}
            onClick={() => setCorrige(true)}
          >
            Vérifier
          </button>
        </>
      ) : (
        <div className="atl__retour" role="status">
          <p className="atl__verdict">
            {justes === cases.length
              ? 'Tout est bien placé'
              : `${justes} sur ${cases.length} bien placés`}
          </p>
          <ul className="frz__corrige">
            {attendu.map((evenement) => (
              <li key={evenement.id}>
                <strong>{evenement.annee}</strong> — {evenement.libelle}
                {evenement.detail.trim() !== '' ? <span> · {evenement.detail}</span> : null}
              </li>
            ))}
          </ul>
          <button type="button" className="atl__rejouer" onClick={recommencer}>
            Recommencer
          </button>
        </div>
      )}
    </section>
  )
}
