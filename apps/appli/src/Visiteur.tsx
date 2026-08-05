import { useEffect, useMemo, useState } from 'react'
import {
  mediasReferences,
  REGLAGES_DEFAUT,
  type ContenuPage,
  type Manifeste,
  type PageManifeste,
} from '@borne/contenu'
import { RenduPage, ToileBorne, type ResoudreMedia } from '@borne/contenu/rendu'
import { chargerContenu, resolveurMedias } from './contenu.js'
import { couleursEffectives, stylesCouleurs } from './couleurs.js'

/**
 * Mode visiteur.
 *
 * Deux écrans seulement : un **accueil** qui présente les pages, et une **page**
 * ouverte en plein écran. On entre dans une page, on la quitte, on en ouvre une
 * autre — il n'y a pas de parcours imposé, donc plus de « Précédent / Suivant ».
 *
 * Ce choix vient de l'usage réel d'une borne : un visiteur arrive au hasard,
 * devant un écran que quelqu'un vient de laisser. Avec un fil linéaire, il
 * tombe au milieu du parcours d'un autre et ne sait ni où il est ni ce qu'il a
 * manqué. Avec un accueil, il voit d'emblée tout ce qui existe et choisit.
 */
export function Visiteur() {
  const [manifeste, setManifeste] = useState<Manifeste | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  /** Page ouverte, ou « null » quand on est sur l'accueil. */
  const [ouverte, setOuverte] = useState<string | null>(null)

  useEffect(() => {
    let annule = false

    chargerContenu()
      .then((charge) => {
        if (!annule) setManifeste(charge)
      })
      .catch((cause: unknown) => {
        if (!annule) {
          setErreur(cause instanceof Error ? cause.message : 'Contenu illisible.')
        }
      })

    return () => {
      annule = true
    }
  }, [])

  const media = useMemo(
    () => (manifeste ? resolveurMedias(manifeste) : () => null),
    [manifeste],
  )

  const pages = manifeste?.pages ?? []
  const page = pages.find((candidate) => candidate.id === ouverte)

  // Couleurs : celles de la page ouverte si elle en a, sinon le thème global.
  const reglages = manifeste?.reglages ?? REGLAGES_DEFAUT
  const style = stylesCouleurs(page ? couleursEffectives(reglages, page) : reglages)

  let contenu
  if (erreur) {
    contenu = (
      <div className="etat-vide">
        <p className="etat-vide__titre">Contenu indisponible</p>
        <p className="etat-vide__texte">{erreur}</p>
      </div>
    )
  } else if (!manifeste) {
    contenu = (
      <div className="etat-vide">
        <p className="etat-vide__texte">Chargement…</p>
      </div>
    )
  } else if (pages.length === 0) {
    contenu = (
      <div className="etat-vide">
        <p className="etat-vide__titre">{reglages.titreVeille}</p>
        <p className="etat-vide__texte">Aucune page n'est encore en ligne.</p>
      </div>
    )
  } else if (page) {
    contenu = (
      <div className="monde" key={page.id}>
        <div className="monde__barre">
          <button type="button" className="monde__retour" onClick={() => setOuverte(null)}>
            ← Accueil
          </button>
          <span className="monde__titre">{page.titre}</span>
        </div>

        {/* La clé remonte la toile à chaque page : le défilement repart du haut. */}
        <ToileBorne key={page.id}>
          <RenduPage contenu={page.contenu as ContenuPage} media={media} lecteurVideo />
        </ToileBorne>
      </div>
    )
  } else {
    contenu = <Accueil manifeste={manifeste} media={media} surOuvrir={setOuverte} />
  }

  return (
    <div className="visiteur-hote" style={style}>
      {contenu}
    </div>
  )
}

/**
 * Accueil : une carte par page. La carte porte la première image de la page —
 * pas une vignette à téléverser en plus, que le personnel oublierait de
 * remplacer le jour où il change la photo de la page.
 */
function Accueil({
  manifeste,
  media,
  surOuvrir,
}: {
  manifeste: Manifeste
  media: ResoudreMedia
  surOuvrir: (id: string) => void
}) {
  return (
    <div className="hub">
      <header className="hub__entete">
        <h1 className="hub__titre">{manifeste.reglages.titreVeille}</h1>
        <p className="hub__sous-titre">{manifeste.reglages.sousTitreVeille}</p>
      </header>

      <ul className="hub__grille">
        {manifeste.pages.map((page, rang) => (
          <li key={page.id}>
            <button
              type="button"
              className="hub__carte"
              onClick={() => surOuvrir(page.id)}
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
    </div>
  )
}

/** Première image de la page ; à défaut l'image de couverture d'une vidéo ;
 *  à défaut un aplat, pour que la grille reste régulière. */
function ApercuPage({ page, media }: { page: PageManifeste; media: ResoudreMedia }) {
  const adresse = useMemo(() => {
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
  return <img className="hub__vignette" src={adresse} alt="" draggable={false} />
}
