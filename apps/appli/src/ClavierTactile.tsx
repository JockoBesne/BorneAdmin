import { useEffect, useState } from 'react'

/**
 * Clavier à l'écran de l'administration.
 *
 * La borne est en salle d'exposition, sans clavier physique : sans cela, le
 * personnel ne peut écrire ni un titre, ni un texte, ni une question de quiz.
 * Il s'ouvre dès qu'on touche un champ, se referme à la croix — ou tout seul
 * quand on touche autre chose qu'un champ.
 *
 * Il écrit **dans le champ qui a le curseur**, par les commandes du navigateur
 * (`execCommand`) et non en posant une valeur : c'est ce qui fait qu'une frappe
 * arrive exactement comme au clavier physique — l'événement « input » part,
 * l'interface se met à jour, l'enregistrement automatique se déclenche, et le
 * champ de texte enrichi garde sa mise en forme. La même commande sert déjà au
 * collage dans « ChampTexteRiche ».
 *
 * Disposition AZERTY, avec les lettres accentuées françaises, une bascule vers
 * les caractères spéciaux et une touche Maj.
 */

const LETTRES = [
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
  ['w', 'x', 'c', 'v', 'b', 'n', 'é', 'è', 'ê', 'à', 'ç', 'ù'],
]

const SYMBOLES = [
  ['.', ',', ';', ':', '!', '?', '’', "'", '«', '»', '"'],
  ['(', ')', '[', ']', '{', '}', '<', '>', '/', '\\', '|'],
  ['@', '#', '€', '$', '%', '&', '*', '+', '-', '=', '_', '°', '~'],
]

/** Les chiffres sont à part, sur le pavé de droite, dans l'ordre du téléphone —
 *  ils restent donc accessibles quelle que soit la page de touches affichée. */
const CHIFFRES = ['7', '8', '9', '4', '5', '6', '1', '2', '3']

/** Champs où le clavier a un sens. Un bouton, une case à cocher : non. */
function estChampTexte(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  // Les touches du clavier lui-même ne doivent pas le rouvrir.
  if (element.closest('.clavier')) return false
  if (element.isContentEditable) return true
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) {
    return ['text', 'search', 'tel', 'url', 'email', 'number'].includes(element.type)
  }
  return false
}

/**
 * Écrit dans un champ « nombre ».
 *
 * Détour obligé : un champ de type « number » n'a ni sélection ni curseur
 * manipulable, et les commandes du navigateur n'y font rien. On repasse donc
 * par le mutateur natif de « value » — sans lui, React ne verrait pas le
 * changement — puis on émet l'événement à la main.
 *
 * ponytail: on écrit toujours à la fin du champ, le curseur n'est pas suivi.
 * Ces champs ne contiennent qu'une année ou un nombre de secondes ; si un jour
 * il faut corriger un chiffre au milieu, passer par un champ texte contrôlé.
 */
function ecrireDansNombre(champ: HTMLInputElement, ajout: string | null) {
  const valeur = ajout === null ? champ.value.slice(0, -1) : champ.value + ajout
  const mutateur = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  mutateur?.call(champ, valeur)
  champ.dispatchEvent(new Event('input', { bubbles: true }))
}

export function ClavierTactile() {
  const [cible, setCible] = useState<HTMLElement | null>(null)
  const [majuscule, setMajuscule] = useState(false)
  const [symboles, setSymboles] = useState(false)

  useEffect(() => {
    const auFocus = (evenement: FocusEvent) => {
      const element = evenement.target
      if (!estChampTexte(element as Element)) return
      setCible(element as HTMLElement)
      // Le champ ne doit pas rester caché derrière le clavier.
      ;(element as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })
    }

    // Le clavier se referme quand le curseur quitte les champs. Le report à la
    // fin du tour est nécessaire : au moment du « focusout », le champ suivant
    // n'a pas encore reçu le curseur.
    const auDefocus = () => {
      setTimeout(() => {
        if (!estChampTexte(document.activeElement)) setCible(null)
      }, 0)
    }

    document.addEventListener('focusin', auFocus)
    document.addEventListener('focusout', auDefocus)
    return () => {
      document.removeEventListener('focusin', auFocus)
      document.removeEventListener('focusout', auDefocus)
    }
  }, [])

  if (!cible) return null

  const taper = (touche: string) => {
    cible.focus()
    if (cible instanceof HTMLInputElement && cible.type === 'number') {
      ecrireDansNombre(cible, touche)
      return
    }
    document.execCommand('insertText', false, touche)
    // La majuscule ne vaut que pour la lettre suivante, comme sur un téléphone.
    setMajuscule(false)
  }

  const effacer = () => {
    cible.focus()
    if (cible instanceof HTMLInputElement && cible.type === 'number') {
      ecrireDansNombre(cible, null)
      return
    }
    document.execCommand('delete')
  }

  const retourLigne = () => {
    cible.focus()
    if (cible.isContentEditable) document.execCommand('insertLineBreak')
    else if (cible instanceof HTMLTextAreaElement) document.execCommand('insertText', false, '\n')
    // Dans un champ d'une seule ligne, la touche n'a rien à faire.
  }

  const rangees = symboles ? SYMBOLES : LETTRES

  return (
    // Le geste est arrêté ici : sans cela, toucher une touche retirerait le
    // curseur du champ, et il n'y aurait plus rien où écrire.
    <div className="clavier" onPointerDown={(evenement) => evenement.preventDefault()}>
      <div className="clavier__lettres">
        {rangees.map((rangee, index) => (
          <div className="clavier__rangee" key={index}>
            {rangee.map((touche) => {
              const affichee = majuscule ? touche.toUpperCase() : touche
              return (
                <button
                  type="button"
                  className="clavier__touche"
                  key={touche}
                  onClick={() => taper(affichee)}
                >
                  {affichee}
                </button>
              )
            })}
          </div>
        ))}

        <div className="clavier__rangee">
          <button
            type="button"
            className={`clavier__touche clavier__touche--large${majuscule ? ' clavier__touche--active' : ''}`}
            onClick={() => setMajuscule((valeur) => !valeur)}
          >
            ⇧ Maj
          </button>
          <button
            type="button"
            className="clavier__touche clavier__touche--large"
            onClick={() => setSymboles((valeur) => !valeur)}
          >
            {symboles ? 'ABC' : '&?!'}
          </button>
          <button
            type="button"
            className="clavier__touche clavier__touche--espace"
            aria-label="Espace"
            onClick={() => taper(' ')}
          >
            Espace
          </button>
          <button
            type="button"
            className="clavier__touche clavier__touche--large"
            aria-label="Effacer"
            onClick={effacer}
          >
            ⌫
          </button>
          <button
            type="button"
            className="clavier__touche clavier__touche--large"
            aria-label="Retour à la ligne"
            onClick={retourLigne}
          >
            ↵
          </button>
        </div>
      </div>

      {/* Pavé des chiffres, à droite : il occupe la place laissée libre par les
          rangées de lettres, au lieu d'ajouter une rangée en hauteur. La croix
          de fermeture prend le coin resté vide, à côté du zéro. */}
      <div className="clavier__pave">
        {CHIFFRES.map((chiffre) => (
          <button
            type="button"
            className="clavier__touche"
            key={chiffre}
            onClick={() => taper(chiffre)}
          >
            {chiffre}
          </button>
        ))}
        <button
          type="button"
          className="clavier__touche clavier__touche--zero"
          onClick={() => taper('0')}
        >
          0
        </button>
        <button
          type="button"
          className="clavier__touche clavier__fermer"
          aria-label="Fermer le clavier"
          title="Fermer le clavier"
          onClick={() => setCible(null)}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
