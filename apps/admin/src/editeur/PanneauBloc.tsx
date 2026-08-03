import type { DefEmplacement, Modele, Probleme, ValeurEmplacement } from '@borne/contenu'
import { Bouton, Champ } from '@borne/ui'
import type { Media } from '../api.js'

/**
 * Panneau contextuel de droite : uniquement les réglages du bloc sélectionné.
 * Tant que rien n'est sélectionné, il présente la page — il n'y a jamais de
 * formulaire à remplir « quelque part » (§5.5).
 */
export function PanneauBloc({
  modele,
  nom,
  valeur,
  medias,
  problemes,
  surTexte,
  surLegende,
  surChoisirMedia,
  surRetirerMedia,
  surRetirerGalerie,
}: {
  modele: Modele
  nom: string | null
  valeur: ValeurEmplacement | undefined
  medias: Map<string, Media>
  problemes: Probleme[]
  surTexte: (nom: string, texte: string) => void
  surLegende: (nom: string, legende: string, index?: number) => void
  surChoisirMedia: (nom: string, type: 'image' | 'video') => void
  surRetirerMedia: (nom: string) => void
  surRetirerGalerie: (nom: string, index: number) => void
}) {
  if (!nom || !valeur) {
    return (
      <aside className="panneau">
        <p className="panneau__titre">Cette page</p>
        <p className="panneau__aide">
          Cliquez sur un bloc de l'aperçu pour le modifier : un titre, un texte, une photo ou
          une vidéo.
        </p>
        <p className="panneau__section">Modèle</p>
        <p className="panneau__valeur">{modele.nom}</p>
        <p className="panneau__aide">{modele.description}</p>

        {problemes.length > 0 ? (
          <>
            <p className="panneau__section">À vérifier</p>
            <ul className="controles">
              {problemes.map((probleme, index) => (
                <li key={index} className={`controle controle--${probleme.gravite}`}>
                  <span aria-hidden="true">{probleme.gravite === 'bloquant' ? '✗' : '⚠'}</span>
                  {probleme.message}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </aside>
    )
  }

  const def = modele.emplacements[nom] as DefEmplacement | undefined
  if (!def) return <aside className="panneau" />

  return (
    <aside className="panneau">
      <p className="panneau__titre">{def.libelle}</p>

      {def.type === 'titre' || def.type === 'texte' ? (
        <ContenuTexte def={def} valeur={valeur} nom={nom} surTexte={surTexte} />
      ) : null}

      {def.type === 'image' || def.type === 'video' ? (
        <ContenuMedia
          def={def}
          nom={nom}
          valeur={valeur}
          medias={medias}
          surLegende={surLegende}
          surChoisirMedia={surChoisirMedia}
          surRetirerMedia={surRetirerMedia}
        />
      ) : null}

      {def.type === 'galerie' && valeur.type === 'galerie' ? (
        <>
          <p className="panneau__aide">
            {valeur.elements.length} photo{valeur.elements.length > 1 ? 's' : ''} — {def.min} à{' '}
            {def.max} conseillées.
          </p>
          <ul className="panneau__galerie">
            {valeur.elements.map((element, index) => {
              const media = medias.get(element.mediaId)
              return (
                <li key={`${element.mediaId}-${index}`}>
                  {media ? <img src={media.urls.vignette} alt="" /> : <span className="panneau__manquant">?</span>}
                  <input
                    className="panneau__legende"
                    value={element.legende}
                    placeholder="Légende…"
                    maxLength={200}
                    onChange={(evenement) => surLegende(nom, evenement.target.value, index)}
                    aria-label={`Légende de la photo ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="panneau__retirer"
                    onClick={() => surRetirerGalerie(nom, index)}
                    aria-label={`Retirer la photo ${index + 1}`}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
          {valeur.elements.length < def.max ? (
            <Bouton variante="secondaire" onClick={() => surChoisirMedia(nom, 'image')}>
              + Ajouter une photo
            </Bouton>
          ) : null}
        </>
      ) : null}

      {def.conseil ? (
        <>
          <p className="panneau__section">Conseil</p>
          <p className="panneau__aide">{def.conseil}</p>
        </>
      ) : null}
    </aside>
  )
}

function ContenuTexte({
  def,
  valeur,
  nom,
  surTexte,
}: {
  def: Extract<DefEmplacement, { type: 'titre' | 'texte' }>
  valeur: ValeurEmplacement
  nom: string
  surTexte: (nom: string, texte: string) => void
}) {
  if (valeur.type !== 'titre' && valeur.type !== 'texte') return null
  const longueur = valeur.valeur.length
  const proche = longueur > def.maxSignes * 0.9

  return (
    <>
      <p className={`compteur${proche ? ' compteur--proche' : ''}`}>
        {longueur} / {def.maxSignes} signes
      </p>
      <textarea
        className="panneau__zone"
        value={valeur.valeur}
        maxLength={def.maxSignes}
        rows={def.type === 'titre' ? 2 : 8}
        placeholder="Saisissez le texte…"
        aria-label={def.libelle}
        onChange={(evenement) => surTexte(nom, evenement.target.value)}
      />
      <p className="panneau__aide">
        Mise en forme : <code>**gras**</code>, <code>_italique_</code>, et une ligne commençant
        par <code>-</code> pour une liste.
      </p>
    </>
  )
}

function ContenuMedia({
  def,
  nom,
  valeur,
  medias,
  surLegende,
  surChoisirMedia,
  surRetirerMedia,
}: {
  def: Extract<DefEmplacement, { type: 'image' | 'video' }>
  nom: string
  valeur: ValeurEmplacement
  medias: Map<string, Media>
  surLegende: (nom: string, legende: string) => void
  surChoisirMedia: (nom: string, type: 'image' | 'video') => void
  surRetirerMedia: (nom: string) => void
}) {
  if (valeur.type !== 'image' && valeur.type !== 'video') return null
  const media = valeur.mediaId ? medias.get(valeur.mediaId) : undefined

  return (
    <>
      {media ? (
        <>
          <p className="panneau__valeur">{media.nomAffiche}</p>
          {media.largeur ? (
            <p className="panneau__aide">
              {media.largeur} × {media.hauteur} pixels
            </p>
          ) : null}
          <Champ
            libelle="Légende"
            aide="Affichée aux visiteurs, et lue par les lecteurs d'écran."
            value={valeur.legende}
            maxLength={200}
            onChange={(evenement) => surLegende(nom, evenement.target.value)}
          />
          <div className="panneau__actions">
            <Bouton variante="secondaire" onClick={() => surChoisirMedia(nom, def.type)}>
              Remplacer
            </Bouton>
            <Bouton variante="discret" onClick={() => surRetirerMedia(nom)}>
              Retirer
            </Bouton>
          </div>
        </>
      ) : (
        <>
          <p className="panneau__aide">
            {def.type === 'image'
              ? 'Aucune photo pour le moment. Glissez un fichier sur le bloc, ou choisissez-en une dans la bibliothèque.'
              : 'Aucune vidéo pour le moment. Formats acceptés : MP4 et WebM.'}
          </p>
          <Bouton variante="primaire" onClick={() => surChoisirMedia(nom, def.type)}>
            {def.type === 'image' ? 'Choisir une photo' : 'Choisir une vidéo'}
          </Bouton>
        </>
      )}
    </>
  )
}
