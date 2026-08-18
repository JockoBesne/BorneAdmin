import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { mediasReferences, type ContenuPage, type Manifeste, type PageManifeste } from '@borne/contenu'
import type { ResoudreMedia } from '@borne/contenu/rendu'

/**
 * Écran d'accueil de la borne (le « hub »).
 *
 * Un composant à part, et non un morceau de `Visiteur.tsx`, parce que
 * l'administration l'affiche **tel quel** en aperçu : ce que le personnel voit
 * en réglant les couleurs ou en choisissant les images est exactement ce que le
 * visiteur verra. Même règle que pour le rendu des pages — jamais deux rendus à
 * tenir d'accord.
 *
 * Une carte par page, sur **une seule rangée horizontale, trois à la fois** :
 * le visiteur voit tout de suite qu'il y a une suite, au lieu d'une grille qui
 * descend sous l'écran. On avance d'un écran de trois avec les flèches, ou en
 * glissant la rangée du doigt.
 *
 * Le défilement lui-même est celui du navigateur (`overflow-x`), pas une
 * mécanique maison : au doigt, il roule et s'arrête tout seul comme partout
 * ailleurs. Les flèches ne font que le pousser d'une largeur, et le glissement
 * à la souris n'est là que pour l'essai sur un ordinateur — sur la borne, c'est
 * le doigt qui fait le travail.
 */
export function Accueil({
  manifeste,
  media,
  surOuvrir,
}: {
  manifeste: Manifeste
  media: ResoudreMedia
  /** Absent en aperçu : les cartes se regardent, elles ne s'ouvrent pas. */
  surOuvrir?: (id: string) => void
}) {
  const piste = useRef<HTMLUListElement>(null)
  const [bords, setBords] = useState({ debut: true, fin: true })
  /** Glissement à la souris en cours : point de départ et défilement d'alors. */
  const glisse = useRef<{ x: number; depart: number } | null>(null)
  /** Empêche le clic de fin de geste d'ouvrir la page qu'on vient de traîner. */
  const vientDeGlisser = useRef(false)

  const mesurer = () => {
    const rangee = piste.current
    if (!rangee) return
    // Marge d'un pixel : un défilement fractionnaire ne doit pas laisser une
    // flèche active alors qu'on est visiblement au bout.
    setBords({
      debut: rangee.scrollLeft <= 1,
      fin: rangee.scrollLeft >= rangee.scrollWidth - rangee.clientWidth - 1,
    })
  }

  useEffect(mesurer, [manifeste.pages.length])

  const defiler = (sens: -1 | 1) => {
    const rangee = piste.current
    if (!rangee) return
    rangee.scrollBy({ left: sens * rangee.clientWidth, behavior: 'smooth' })
  }

  const finGlissement = () => {
    if (!glisse.current || !piste.current) return
    glisse.current = null
    piste.current.style.scrollSnapType = ''
    // Le drapeau doit retomber tout seul, après le clic de fin de geste.
    setTimeout(() => {
      vientDeGlisser.current = false
    }, 0)
  }

  // Image de fond de l'accueil, si le musée en a choisi une.
  const fond = media(manifeste.reglages.hubImage ?? null)
  const style = fond
    ? { backgroundImage: `url("${fond.url('grand')}")` }
    : undefined

  // Les cartes se partagent la largeur disponible : une seule page l'occupe
  // entière, deux la coupent en deux, trois en trois. Au-delà de trois, on
  // reste à trois — une quatrième carte serait trop étroite pour être lue de
  // loin — et les suivantes attendent derrière : c'est là, et seulement là,
  // que les flèches et le défilement ont une raison d'être.
  const colonnes = Math.min(Math.max(manifeste.pages.length, 1), 3)
  const defilable = manifeste.pages.length > colonnes

  return (
    <div className={`hub${fond ? ' hub--image' : ''}`} style={style}>
      <header className="hub__entete">
        <h1 className="hub__titre">{manifeste.reglages.titreVeille}</h1>
        <p className="hub__sous-titre">{manifeste.reglages.sousTitreVeille}</p>
      </header>

      <div className="hub__defile">
        {defilable ? (
          <button
            type="button"
            className="hub__fleche"
            aria-label="Voir les pages précédentes"
            disabled={bords.debut}
            onClick={() => defiler(-1)}
          >
            ‹
          </button>
        ) : null}

        <ul
          className="hub__piste"
          style={{ '--colonnes': colonnes } as CSSProperties}
          ref={piste}
          onScroll={mesurer}
          onPointerDown={(evenement) => {
            // Au doigt, le navigateur défile déjà : ne rien lui prendre.
            if (evenement.pointerType === 'touch' || !piste.current) return
            glisse.current = { x: evenement.clientX, depart: piste.current.scrollLeft }
            // L'aimantation reprend la main au relâchement ; pendant le geste
            // elle ferait sauter la rangée à chaque pixel.
            piste.current.style.scrollSnapType = 'none'
          }}
          onPointerMove={(evenement) => {
            const debut = glisse.current
            if (!debut || !piste.current) return
            const ecart = evenement.clientX - debut.x
            // Même seuil qu'ailleurs dans l'application : en dessous, c'est un
            // clic, pas un glissement.
            if (Math.abs(ecart) > 8) vientDeGlisser.current = true
            piste.current.scrollLeft = debut.depart - ecart
          }}
          onPointerUp={finGlissement}
          onPointerLeave={finGlissement}
        >
          {manifeste.pages.map((page, rang) => (
            <li key={page.id}>
              <button
                type="button"
                className="hub__carte"
                onClick={() => {
                  if (vientDeGlisser.current) return
                  surOuvrir?.(page.id)
                }}
                // Apparition en cascade : les cartes arrivent l'une après l'autre.
                // Purement décoratif, et borné à 6 pour que la dernière carte
                // n'attende jamais plus d'un tiers de seconde.
                style={{ animationDelay: `${Math.min(rang, 6) * 55}ms` }}
              >
                <span className="hub__image">
                  <ApercuPage page={page} media={media} />
                </span>
                <span className="hub__nom">{page.titre}</span>
              </button>
            </li>
          ))}
        </ul>

        {defilable ? (
          <button
            type="button"
            className="hub__fleche"
            aria-label="Voir les pages suivantes"
            disabled={bords.fin}
            onClick={() => defiler(1)}
          >
            ›
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Image de présentation d'une page sur sa carte.
 *
 * L'image choisie dans l'administration (`vignette`) d'abord ; à défaut la
 * première image de la page — pas une vignette à téléverser en plus, que le
 * personnel oublierait de remplacer le jour où il change la photo de la page ;
 * à défaut l'image de couverture d'une vidéo ; à défaut un aplat, pour que la
 * rangée reste régulière.
 */
export function ApercuPage({ page, media }: { page: PageManifeste; media: ResoudreMedia }) {
  const adresse = useMemo(() => {
    const choisie = media(page.vignette)
    if (choisie) {
      if (choisie.type === 'image') return choisie.url('moyen')
      if (choisie.poster) return choisie.poster
    }

    for (const id of mediasReferences(page.contenu as ContenuPage)) {
      const resolu = media(id)
      if (!resolu) continue
      if (resolu.type === 'image') return resolu.url('moyen')
      if (resolu.type === 'video' && resolu.poster) return resolu.poster
    }
    return null
  }, [page, media])

  if (!adresse) {
    return (
      <span className="hub__image--absente" aria-hidden="true">
        ◈
      </span>
    )
  }
  // Deux fois la même image : l'une floutée remplit le fond de la carte,
  // l'autre est montrée entière par-dessus. Le navigateur ne la télécharge
  // qu'une fois. Voir « .hub__fond » dans la feuille de style.
  return (
    <>
      <img className="hub__fond" src={adresse} alt="" aria-hidden="true" draggable={false} />
      <img className="hub__vignette" src={adresse} alt="" draggable={false} />
    </>
  )
}
