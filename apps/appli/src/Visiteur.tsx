import { useEffect, useMemo, useState } from 'react'
import { REGLAGES_DEFAUT, type ContenuPage, type Manifeste, type PageManifeste } from '@borne/contenu'
import { RenduPage, ToileBorne, type ResoudreMedia } from '@borne/contenu/rendu'
import { Accueil } from './Accueil.jsx'
import { chargerContenu, resolveurMedias } from './contenu.js'
import { couleursEffectives, couleursHub, stylesCouleurs } from './couleurs.js'

/**
 * Mode visiteur.
 *
 * Deux écrans seulement : un **accueil** qui présente les pages, et une **page**
 * ouverte en plein écran. On entre dans une page, on la quitte, on en ouvre une
 * autre.
 *
 * Ce choix vient de l'usage réel d'une borne : un visiteur arrive au hasard,
 * devant un écran que quelqu'un vient de laisser. Avec un fil linéaire, il
 * tombe au milieu du parcours d'un autre et ne sait ni où il est ni ce qu'il a
 * manqué. Avec un accueil, il voit d'emblée tout ce qui existe et choisit.
 *
 * L'accueil reste donc le point d'entrée, dans la barre du haut. Au **bout** de
 * la page, une fois qu'on l'a descendue, deux boutons mènent aux pages
 * **voisines** : ils ajoutent le confort du parcours suivi de bout en bout,
 * sans imposer de fil — on peut toujours remonter à l'accueil et sauter où l'on
 * veut (voir « Voisine » plus bas).
 */
export function Visiteur() {
  const [manifeste, setManifeste] = useState<Manifeste | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  /** Page ouverte, ou « null » quand on est sur l'accueil. */
  const [ouverte, setOuverte] = useState<string | null>(null)
  /** Photo affichée en grand par-dessus la page, ou « null ». */
  const [visionneuse, setVisionneuse] = useState<string | null>(null)

  // Quitter la page referme la photo : sans cela, elle réapparaîtrait par-dessus
  // la page suivante — y compris après le retour automatique à l'accueil.
  useEffect(() => setVisionneuse(null), [ouverte])

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
  // Le rang, et pas seulement la page : c'est lui qui donne les deux voisines
  // affichées en bas de l'écran.
  const rang = pages.findIndex((candidate) => candidate.id === ouverte)
  const page = rang === -1 ? undefined : pages[rang]

  // Couleurs : celles de la page ouverte si elle en a, sinon le thème global.
  // Hors d'une page (l'accueil), celles propres à l'accueil s'il en a.
  const reglages = manifeste?.reglages ?? REGLAGES_DEFAUT
  const minutesAvantVeille = reglages.minutesAvantVeille

  /*
   * Retour automatique à l'accueil après un moment sans rien toucher.
   *
   * C'est la raison d'être de l'accueil : un visiteur arrive devant un écran que
   * quelqu'un vient de laisser, et il ne doit pas atterrir au milieu de la page
   * d'un autre. Le délai se règle depuis l'administration
   * (« minutesAvantVeille ») — il existait dans le contenu depuis le début sans
   * être branché.
   *
   * Rien à faire sur l'accueil lui-même : on y est déjà.
   */
  useEffect(() => {
    if (!ouverte) return

    const delai = Math.max(1, minutesAvantVeille) * 60_000
    let minuterie = 0

    // Une vidéo qui joue n'est pas de l'inactivité : le visiteur regarde,
    // justement sans toucher l'écran. On repousse plutôt que de le couper au
    // milieu — c'est le cas qui se produirait dès la première vidéo un peu
    // longue.
    const videoEnCours = () =>
      Array.from(document.querySelectorAll('video')).some((video) => !video.paused && !video.ended)

    const armer = () => {
      window.clearTimeout(minuterie)
      minuterie = window.setTimeout(() => {
        if (videoEnCours()) armer()
        else setOuverte(null)
      }, delai)
    }

    armer()
    window.addEventListener('pointerdown', armer)
    window.addEventListener('keydown', armer)

    return () => {
      window.clearTimeout(minuterie)
      window.removeEventListener('pointerdown', armer)
      window.removeEventListener('keydown', armer)
    }
  }, [ouverte, minutesAvantVeille])
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
        {/* Masqué, le bandeau ne disparaît pas : il devient transparent et ne
            garde que le bouton de retour, posé par-dessus la page (voir
            « .monde__barre--masque »). La sortie ne se retire pas. */}
        <div className={`monde__barre${page.bandeauMasque ? ' monde__barre--masque' : ''}`}>
          <button type="button" className="monde__retour" onClick={() => setOuverte(null)}>
            ← Accueil
          </button>
          <span className="monde__titre">{page.titre}</span>
        </div>

        {/* La clé remonte la toile à chaque page : le défilement repart du haut. */}
        <ToileBorne key={page.id}>
          <RenduPage
            contenu={page.contenu as ContenuPage}
            media={media}
            lecteurVideo
            surImage={setVisionneuse}
          />

          {/* Dans la toile, après la page : les deux boutons sont la **fin** du
              contenu, on les atteint en descendant. Hors de la toile, ils
              formaient un bandeau toujours affiché qui mangeait de la hauteur
              sur chaque page. */}
          <nav className="voisines" aria-label="Pages voisines">
            <Voisine sens="precedente" page={pages[rang - 1]} surOuvrir={setOuverte} />
            <Voisine sens="suivante" page={pages[rang + 1]} surOuvrir={setOuverte} />
          </nav>
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
      {visionneuse ? (
        <Visionneuse
          mediaId={visionneuse}
          media={media}
          surFermeture={() => setVisionneuse(null)}
        />
      ) : null}
    </div>
  )
}

/**
 * Bouton vers la page voisine, tout **au bout** de la page.
 *
 * Il **double** l'accueil, il ne le remplace pas : celui qui a lu la page
 * jusqu'au bout enchaîne sur la suivante, et l'accueil reste à portée dans la
 * barre du haut pour celui qui arrive au milieu.
 *
 * Sa place est dans le contenu, pas dans un bandeau : on ne le voit qu'après
 * avoir descendu la page, et il ne prend aucune hauteur d'écran le reste du
 * temps.
 *
 * Aux deux bouts du parcours, le bouton reste en place, éteint, et dit où l'on
 * est : les deux boutons ne changent jamais de position d'une page à l'autre —
 * sur un écran tactile, une cible qui se déplace est une cible ratée.
 */
function Voisine({
  sens,
  page,
  surOuvrir,
}: {
  sens: 'precedente' | 'suivante'
  /** Absente au premier (ou au dernier) rang : le bouton s'éteint. */
  page: PageManifeste | undefined
  surOuvrir: (id: string) => void
}) {
  const avant = sens === 'precedente'
  const libelle = avant ? 'Page précédente' : 'Page suivante'
  const fleche = (
    <span className="voisine__fleche" aria-hidden="true">
      {avant ? '‹' : '›'}
    </span>
  )

  return (
    <button
      type="button"
      className={`voisine voisine--${sens}`}
      disabled={!page}
      onClick={() => page && surOuvrir(page.id)}
      aria-label={page ? `${libelle} : ${page.titre}` : undefined}
    >
      {avant ? fleche : null}
      <span className="voisine__textes">
        <span className="voisine__sens">{libelle}</span>
        <span className="voisine__nom">
          {page ? page.titre : avant ? 'Début du parcours' : 'Fin du parcours'}
        </span>
      </span>
      {avant ? null : fleche}
    </button>
  )
}

/**
 * Une photo en grand, par-dessus la page — touchée dans une galerie ou dans un
 * bloc image. Elle est montrée **entière** (« contain ») : agrandir une photo
 * pour la couper serait absurde.
 *
 * Toucher n'importe où referme, en plus du bouton : c'est le geste qu'un
 * visiteur essaie en premier, et viser un bouton précis au doigt ne va pas de
 * soi. Le fond est un bouton à part entière plutôt qu'un « onClick » sur le
 * cadre — sinon toucher la photo elle-même refermerait aussi, par ricochet.
 */
function Visionneuse({
  mediaId,
  media,
  surFermeture,
}: {
  mediaId: string
  media: ResoudreMedia
  surFermeture: () => void
}) {
  const resolu = media(mediaId)
  if (!resolu) return null

  return (
    <div
      className="visionneuse"
      role="dialog"
      aria-modal="true"
      aria-label={resolu.legende || 'Photo'}
    >
      <button
        type="button"
        className="visionneuse__zone"
        onClick={surFermeture}
        aria-label="Fermer"
      />
      <img className="visionneuse__image" src={resolu.url('grand')} alt={resolu.legende} />
      {resolu.legende ? <p className="visionneuse__legende">{resolu.legende}</p> : null}
      <button type="button" className="visionneuse__fermer" onClick={surFermeture}>
        Fermer ✕
      </button>
    </div>
  )
}
