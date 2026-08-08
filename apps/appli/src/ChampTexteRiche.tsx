import { useEffect, useRef, type RefObject } from 'react'
import { texteBrut, type LigneTexte, type MorceauTexte } from '@borne/contenu'

/**
 * Champ de saisie d'un texte mis en forme.
 *
 * On tape le texte, on en sélectionne un morceau, on clique G / I / S : le
 * morceau s'affiche aussitôt en gras, en italique ou souligné, dans le champ
 * même. Plus de `**` ni de `_` à taper — ce que l'on voit dans le champ est ce
 * que le visiteur verra.
 *
 * Le champ est **maître de son contenu** : son texte n'est posé qu'à
 * l'ouverture, et chaque frappe repart vers l'extérieur. Réécrire son contenu
 * à chaque rendu, comme le fait un champ ordinaire de React, replacerait le
 * curseur au début à chaque lettre.
 */

/** Ce que le champ met à disposition des boutons du panneau. */
export interface CommandesTexteRiche {
  basculer: (marque: 'gras' | 'italique' | 'souligne') => void
}

const COMMANDES = { gras: 'bold', italique: 'italic', souligne: 'underline' } as const

const MARQUE_PAR_BALISE: Record<string, keyof MorceauTexte> = {
  B: 'gras',
  STRONG: 'gras',
  I: 'italique',
  EM: 'italique',
  U: 'souligne',
}

const BALISES_DE_LIGNE = new Set(['DIV', 'P', 'LI'])

export function ChampTexteRiche({
  lignes,
  maxSignes,
  commandes,
  surChangement,
}: {
  lignes: LigneTexte[]
  maxSignes: number
  /** Boîte où le champ dépose ses commandes, à l'usage des boutons du panneau. */
  commandes: RefObject<CommandesTexteRiche | null>
  surChangement: (lignes: LigneTexte[]) => void
}) {
  const zone = useRef<HTMLDivElement>(null)

  // Le contenu de départ, posé une seule fois — voir l'explication ci-dessus.
  // « lignes » n'est volontairement pas une dépendance : le champ est ensuite
  // seul maître à bord jusqu'à ce qu'on ouvre un autre bloc, ce qui le remonte
  // à neuf.
  useEffect(() => {
    const element = zone.current
    if (!element) return
    element.replaceChildren(...noeudsDeLignes(lignes))
    // Demande à l'éditeur du navigateur de poser des balises (<b>, <i>, <u>)
    // plutôt que des styles : c'est ce que relit « lignesDeNoeud ».
    document.execCommand('styleWithCSS', false, 'false')
    element.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emettre = () => {
    const element = zone.current
    if (element) surChangement(lignesDeNoeud(element))
  }

  // Les boutons G / I / S du panneau passent par ici. Rafraîchi à chaque rendu :
  // « emettre » doit toujours renvoyer vers le bloc actuellement ouvert.
  useEffect(() => {
    commandes.current = {
      basculer: (marque) => {
        zone.current?.focus({ preventScroll: true })
        document.execCommand(COMMANDES[marque])
        emettre()
      },
    }
    return () => {
      commandes.current = null
    }
  })

  return (
    <div
      ref={zone}
      className="champ__riche"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      spellCheck={false}
      onInput={emettre}
      onBeforeInput={(evenement) => {
        // La limite de signes, qu'un champ à contenu modifiable n'applique pas
        // tout seul. On laisse toujours passer ce qui efface ou met en forme.
        const type = (evenement.nativeEvent as InputEvent).inputType ?? ''
        if (type.startsWith('delete') || type.startsWith('format')) return
        const zoneCourante = zone.current
        if (!zoneCourante) return
        if (texteBrut(lignesDeNoeud(zoneCourante)).length >= maxSignes) {
          evenement.preventDefault()
        }
      }}
      // Un texte collé arrive en texte brut : ni style ni script ne peuvent
      // entrer par un copier-coller depuis un traitement de texte ou le web.
      onPaste={(evenement) => {
        evenement.preventDefault()
        const texte = evenement.clipboardData.getData('text/plain')
        if (texte) document.execCommand('insertText', false, texte)
      }}
    />
  )
}

// ── Du contenu du champ vers les lignes ──────────────────────────────────────

function memesMarques(a: MorceauTexte, b: MorceauTexte): boolean {
  return !!a.gras === !!b.gras && !!a.italique === !!b.italique && !!a.souligne === !!b.souligne
}

/**
 * Une ligne au propre : morceaux vides retirés, morceaux voisins de même mise
 * en forme réunis, et « - » de tête relu comme une puce — la façon d'écrire une
 * liste n'a pas changé.
 */
function ligneAuPropre(morceaux: MorceauTexte[]): LigneTexte {
  const propres: MorceauTexte[] = []
  for (const morceau of morceaux) {
    if (morceau.texte === '') continue
    const dernier = propres[propres.length - 1]
    if (dernier && memesMarques(dernier, morceau)) dernier.texte += morceau.texte
    else propres.push({ ...morceau })
  }

  const premier = propres[0]
  if (premier?.texte.startsWith('- ')) {
    premier.texte = premier.texte.slice(2)
    if (premier.texte === '') propres.shift()
    return { puce: true, morceaux: propres }
  }
  return { morceaux: propres }
}

/** Relit le contenu du champ. Le navigateur y range une ligne par « div ». */
function lignesDeNoeud(racine: HTMLElement): LigneTexte[] {
  const lignes: LigneTexte[] = []
  let courante: MorceauTexte[] = []
  let commencee = false

  const fermer = () => {
    lignes.push(ligneAuPropre(courante))
    courante = []
    commencee = false
  }

  const parcourir = (noeud: Node, marques: Partial<MorceauTexte>) => {
    for (const enfant of Array.from(noeud.childNodes)) {
      if (enfant.nodeType === Node.TEXT_NODE) {
        const texte = enfant.textContent ?? ''
        if (texte !== '') {
          courante.push({ ...marques, texte })
          commencee = true
        }
        continue
      }
      if (!(enfant instanceof HTMLElement)) continue

      if (enfant.tagName === 'BR') {
        fermer()
        continue
      }

      if (BALISES_DE_LIGNE.has(enfant.tagName)) {
        if (commencee) fermer()
        const avant = lignes.length
        parcourir(enfant, marques)
        if (commencee) fermer()
        // Un conteneur qui n'a rien produit est une ligne vide voulue.
        else if (lignes.length === avant) lignes.push({ morceaux: [] })
        continue
      }

      const marque = MARQUE_PAR_BALISE[enfant.tagName]
      parcourir(enfant, marque ? { ...marques, [marque]: true } : marques)
    }
  }

  parcourir(racine, {})
  if (commencee || lignes.length === 0) fermer()
  return lignes
}

// ── Des lignes vers le contenu du champ ──────────────────────────────────────

function noeudDeMorceau(morceau: MorceauTexte): Node {
  let noeud: Node = document.createTextNode(morceau.texte)
  // Construit nœud par nœud, jamais par « innerHTML » : un texte contenant
  // « <script> » reste du texte, il ne peut pas devenir une balise.
  if (morceau.souligne) noeud = envelopper('u', noeud)
  if (morceau.italique) noeud = envelopper('em', noeud)
  if (morceau.gras) noeud = envelopper('strong', noeud)
  return noeud
}

function envelopper(balise: string, noeud: Node): HTMLElement {
  const element = document.createElement(balise)
  element.appendChild(noeud)
  return element
}

function noeudsDeLignes(lignes: LigneTexte[]): Node[] {
  const vraies = lignes.length > 0 ? lignes : [{ morceaux: [] }]
  return vraies.map((ligne) => {
    const div = document.createElement('div')
    const morceaux = ligne.puce ? [{ texte: '- ' }, ...ligne.morceaux] : ligne.morceaux
    if (morceaux.length === 0) div.appendChild(document.createElement('br'))
    else for (const morceau of morceaux) div.appendChild(noeudDeMorceau(morceau))
    return div
  })
}
