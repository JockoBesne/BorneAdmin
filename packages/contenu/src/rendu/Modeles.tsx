import { lireGalerie, lireImage, lireTexte, lireVideo } from '../lecture.js'
import { BlocGalerie, BlocImage, BlocVideo } from './blocs.jsx'
import { TexteEnrichi } from './TexteEnrichi.jsx'
import type { EnveloppeEmplacement, PropsModele } from './types.js'

/* Les trois modèles. Ces composants sont utilisés à l'identique par
 * l'administration (aperçu et édition) et par la borne (§7.2) : c'est ce qui
 * rend l'aperçu fidèle par construction, et non par ressemblance. */

const SANS_ENVELOPPE: EnveloppeEmplacement = (_info, defaut) => defaut

function TitreOuVide({ texte, secours }: { texte: string; secours: string }) {
  if (texte.trim() === '') return <span className="b-attente">{secours}</span>
  return <>{texte}</>
}

function TexteOuVide({ texte, secours }: { texte: string; secours: string }) {
  if (texte.trim() === '') return <span className="b-attente">{secours}</span>
  return <TexteEnrichi texte={texte} />
}

// ── Modèle 1 — Une image, un texte ───────────────────────────────────────────

export function Modele1({ contenu, media, emp = SANS_ENVELOPPE, surImage }: PropsModele) {
  return (
    <article className="mdl mdl-1">
      <header className="mdl-1__entete">
        {emp(
          { nom: 'titre', type: 'titre', classe: 'b-h1' },
          <h1 className="b-h1">
            <TitreOuVide texte={lireTexte(contenu, 'titre')} secours="Titre de la page" />
          </h1>,
        )}
      </header>

      <div className="mdl-1__image">
        {emp(
          { nom: 'image', type: 'image', classe: '' },
          <BlocImage
            valeur={lireImage(contenu, 'image')}
            media={media}
            profil="grand"
            libelleVide="Image principale"
            surImage={surImage}
          />,
        )}
      </div>

      <div className="mdl-1__texte">
        {emp(
          { nom: 'texte', type: 'texte', classe: 'b-corps' },
          <div className="b-corps">
            <TexteOuVide texte={lireTexte(contenu, 'texte')} secours="Texte de la page" />
          </div>,
        )}
      </div>
    </article>
  )
}

// ── Modèle 2 — Image et texte côte à côte ────────────────────────────────────

export function Modele2({ contenu, media, emp = SANS_ENVELOPPE, surImage }: PropsModele) {
  const galerie = lireGalerie(contenu, 'galerie')

  return (
    <article className="mdl mdl-2">
      <header className="mdl-2__entete">
        {emp(
          { nom: 'titre', type: 'titre', classe: 'b-h1' },
          <h1 className="b-h1">
            <TitreOuVide texte={lireTexte(contenu, 'titre')} secours="Titre de la page" />
          </h1>,
        )}
      </header>

      <div className="mdl-2__colonnes">
        <div className="mdl-2__image">
          {emp(
            { nom: 'image', type: 'image', classe: '' },
            <BlocImage
              valeur={lireImage(contenu, 'image')}
              media={media}
              profil="grand"
              libelleVide="Image de gauche"
              surImage={surImage}
            />,
          )}
        </div>

        <div className="mdl-2__texte">
          {emp(
            { nom: 'texte', type: 'texte', classe: 'b-corps' },
            <div className="b-corps">
              <TexteOuVide
                texte={lireTexte(contenu, 'texte')}
                secours="Texte de description"
              />
            </div>,
          )}
        </div>
      </div>

      <div className={`mdl-2__galerie${galerie.length === 0 ? ' mdl-2__galerie--vide' : ''}`}>
        {emp(
          { nom: 'galerie', type: 'galerie', classe: '' },
          <BlocGalerie
            elements={galerie}
            media={media}
            libelleVide="Galerie (facultative)"
            surImage={surImage}
          />,
        )}
      </div>
    </article>
  )
}

// ── Modèle 3 — Vidéo en avant ────────────────────────────────────────────────

export function Modele3({
  contenu,
  media,
  emp = SANS_ENVELOPPE,
  lecteurVideo = false,
}: PropsModele) {
  const encartTitre = lireTexte(contenu, 'encartTitre')
  const encartTexte = lireTexte(contenu, 'encartTexte')
  const encartVide = encartTitre.trim() === '' && encartTexte.trim() === ''

  return (
    <article className="mdl mdl-3">
      <div className="mdl-3__video">
        {emp(
          { nom: 'video', type: 'video', classe: '' },
          <BlocVideo
            valeur={lireVideo(contenu, 'video')}
            media={media}
            libelleVide="Vidéo plein écran"
            lisible={lecteurVideo}
          />,
        )}
      </div>

      <div className="mdl-3__voile" aria-hidden="true" />

      <div className="mdl-3__superpose">
        <div className="mdl-3__principal">
          {emp(
            { nom: 'titre', type: 'titre', classe: 'b-h1' },
            <h1 className="b-h1 b-h1--clair">
              <TitreOuVide texte={lireTexte(contenu, 'titre')} secours="Titre de la page" />
            </h1>,
          )}
          {emp(
            { nom: 'texte', type: 'texte', classe: 'b-corps' },
            <div className="b-corps b-corps--clair">
              <TexteOuVide
                texte={lireTexte(contenu, 'texte')}
                secours="Texte superposé (court)"
              />
            </div>,
          )}
        </div>

        <aside className={`mdl-3__encart${encartVide ? ' mdl-3__encart--vide' : ''}`}>
          {emp(
            { nom: 'encartTitre', type: 'titre', classe: 'b-h3' },
            <h2 className="b-h3">
              <TitreOuVide texte={encartTitre} secours="Titre de l'encart" />
            </h2>,
          )}
          {emp(
            { nom: 'encartTexte', type: 'texte', classe: 'b-petit' },
            <div className="b-petit">
              <TexteOuVide texte={encartTexte} secours="Information pratique" />
            </div>,
          )}
        </aside>
      </div>
    </article>
  )
}
