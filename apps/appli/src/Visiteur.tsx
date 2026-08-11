import { useEffect, useMemo, useState } from 'react'
import { REGLAGES_DEFAUT, type ContenuPage, type Manifeste } from '@borne/contenu'
import { RenduPage, ToileBorne } from '@borne/contenu/rendu'
import { Accueil } from './Accueil.jsx'
import { chargerContenu, resolveurMedias } from './contenu.js'
import { couleursEffectives, couleursHub, stylesCouleurs } from './couleurs.js'

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
  // Hors d'une page (l'accueil), celles propres à l'accueil s'il en a.
  const reglages = manifeste?.reglages ?? REGLAGES_DEFAUT
  const style = stylesCouleurs(page ? couleursEffectives(reglages, page) : couleursHub(reglages))

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
    // Même toile que les pages : l'accueil est dessiné pour 1920 × 1080 et mis
    // à l'échelle de la fenêtre. C'est ce qui permet à l'administration d'en
    // montrer un aperçu fidèle, en petit, sans redessiner quoi que ce soit.
    contenu = (
      <ToileBorne className="toile--accueil">
        <Accueil manifeste={manifeste} media={media} surOuvrir={setOuverte} />
      </ToileBorne>
    )
  }

  return (
    <div className="visiteur-hote" style={style}>
      {contenu}
    </div>
  )
}
