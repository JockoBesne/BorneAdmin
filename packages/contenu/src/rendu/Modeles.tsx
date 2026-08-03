import { useState } from 'react'
import {
  estBlocLibreVide,
  lireGalerie,
  lireImage,
  lireSuite,
  lireTexte,
  lireVideo,
  positionBloc,
} from '../lecture.js'
import { modelePar } from '../modeles/index.js'
import type { BlocLibre } from '../types.js'
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

/**
 * Blocs ajoutés librement, affichés après la section « section » du modèle.
 *
 * En mode visiteur (pas d'enveloppe), un bloc vide est sauté : le public ne
 * voit jamais de zone en attente. Dans l'éditeur (enveloppe fournie), il est
 * affiché pour rester sélectionnable et modifiable.
 */
function RenduSuite({ contenu, media, emp, surImage, section }: PropsModele & { section: string }) {
  const edition = emp !== undefined
  const env = emp ?? SANS_ENVELOPPE
  const sections = (modelePar(contenu.modele)?.sections ?? []).map((candidate) => candidate.nom)
  const blocs = lireSuite(contenu).filter(
    (bloc) =>
      positionBloc(bloc, sections) === section && (edition || !estBlocLibreVide(bloc)),
  )
  if (blocs.length === 0) return null

  // La cellule d'un bloc, sans se soucier de sa largeur : c'est la rangée
  // (ci-dessous) qui place un ou deux blocs sur une même ligne.
  const cellule = (bloc: BlocLibre) => {
    const nom = `suite:${bloc.id}`
    switch (bloc.valeur.type) {
      case 'texte':
        return (
          <div key={bloc.id} className="suite__bloc">
            {env(
              { nom, type: 'texte', classe: 'b-corps' },
              <div className="b-corps">
                <TexteOuVide texte={bloc.valeur.valeur} secours="Texte ajouté (vide)" />
              </div>,
            )}
          </div>
        )
      case 'image':
        return (
          <div key={bloc.id} className="suite__bloc">
            {env(
              { nom, type: 'image', classe: '' },
              <BlocImage
                valeur={bloc.valeur}
                media={media}
                profil="grand"
                libelleVide="Photo ajoutée (vide)"
                surImage={surImage}
              />,
            )}
          </div>
        )
      case 'galerie':
        return (
          <div key={bloc.id} className="suite__bloc suite__galerie">
            {env(
              { nom, type: 'galerie', classe: '' },
              <BlocGalerie
                elements={bloc.valeur.elements}
                media={media}
                libelleVide="Galerie ajoutée (vide)"
                surImage={surImage}
              />,
            )}
          </div>
        )
      case 'video':
        return (
          <div key={bloc.id} className="suite__bloc suite__video">
            {env(
              { nom, type: 'video', classe: '' },
              <BlocVideo
                valeur={bloc.valeur}
                media={media}
                libelleVide="Vidéo ajoutée (vide)"
                // Visiteur : lecteur réel. Éditeur (enveloppe présente) :
                // image de couverture seule, comme pour le modèle 3.
                lisible={!edition}
              />,
            )}
          </div>
        )
    }
  }

  // Deux blocs « demi-largeur » consécutifs partagent une rangée ; sinon un bloc
  // occupe toute la largeur. Un « demi » resté seul garde sa demi-largeur (à
  // gauche) pour que la disposition voulue reste lisible.
  const rangs: BlocLibre[][] = []
  for (let i = 0; i < blocs.length; ) {
    const courant = blocs[i]!
    const suivant = blocs[i + 1]
    if (courant.largeur === 'moitie' && suivant?.largeur === 'moitie') {
      rangs.push([courant, suivant])
      i += 2
    } else {
      rangs.push([courant])
      i += 1
    }
  }

  return (
    <div className="suite">
      {rangs.map((rang) => {
        const classe =
          rang.length === 2
            ? 'suite__rang suite__rang--paire'
            : rang[0]!.largeur === 'moitie'
              ? 'suite__rang suite__rang--moitie'
              : 'suite__rang'
        return (
          <div key={rang[0]!.id} className={classe}>
            {rang.map((bloc) => cellule(bloc))}
          </div>
        )
      })}
    </div>
  )
}

// ── Modèle 1 — Une image, un texte ───────────────────────────────────────────

export function Modele1({ contenu, media, emp, surImage }: PropsModele) {
  const env = emp ?? SANS_ENVELOPPE
  return (
    <article className="mdl mdl-1">
      <header className="mdl-1__entete">
        {env(
          { nom: 'titre', type: 'titre', classe: 'b-h1' },
          <h1 className="b-h1">
            <TitreOuVide texte={lireTexte(contenu, 'titre')} secours="Titre de la page" />
          </h1>,
        )}
      </header>

      <RenduSuite contenu={contenu} media={media} emp={emp} surImage={surImage} section="titre" />

      <div className="mdl-1__image">
        {env(
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

      <RenduSuite contenu={contenu} media={media} emp={emp} surImage={surImage} section="image" />

      <div className="mdl-1__texte">
        {env(
          { nom: 'texte', type: 'texte', classe: 'b-corps' },
          <div className="b-corps">
            <TexteOuVide texte={lireTexte(contenu, 'texte')} secours="Texte de la page" />
          </div>,
        )}
      </div>

      <RenduSuite contenu={contenu} media={media} emp={emp} surImage={surImage} section="texte" />
    </article>
  )
}

// ── Modèle 2 — Image et texte côte à côte ────────────────────────────────────

export function Modele2({ contenu, media, emp, surImage }: PropsModele) {
  const env = emp ?? SANS_ENVELOPPE
  const galerie = lireGalerie(contenu, 'galerie')

  return (
    <article className="mdl mdl-2">
      <header className="mdl-2__entete">
        {env(
          { nom: 'titre', type: 'titre', classe: 'b-h1' },
          <h1 className="b-h1">
            <TitreOuVide texte={lireTexte(contenu, 'titre')} secours="Titre de la page" />
          </h1>,
        )}
      </header>

      <RenduSuite contenu={contenu} media={media} emp={emp} surImage={surImage} section="titre" />

      <div className="mdl-2__colonnes">
        <div className="mdl-2__image">
          {env(
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
          {env(
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

      <RenduSuite
        contenu={contenu}
        media={media}
        emp={emp}
        surImage={surImage}
        section="colonnes"
      />

      <div className={`mdl-2__galerie${galerie.length === 0 ? ' mdl-2__galerie--vide' : ''}`}>
        {env(
          { nom: 'galerie', type: 'galerie', classe: '' },
          <BlocGalerie
            elements={galerie}
            media={media}
            libelleVide="Galerie (facultative)"
            surImage={surImage}
          />,
        )}
      </div>

      <RenduSuite contenu={contenu} media={media} emp={emp} surImage={surImage} section="galerie" />
    </article>
  )
}

// ── Modèle 3 — Vidéo en avant ────────────────────────────────────────────────

export function Modele3({
  contenu,
  media,
  emp,
  surImage,
  lecteurVideo = false,
}: PropsModele) {
  const env = emp ?? SANS_ENVELOPPE
  const encartTitre = lireTexte(contenu, 'encartTitre')
  const encartTexte = lireTexte(contenu, 'encartTexte')
  const encartVide = encartTitre.trim() === '' && encartTexte.trim() === ''

  // Le texte superposé (titre, texte, encart) s'efface pendant la lecture pour
  // laisser toute la place à la vidéo, et revient à la pause / à la fin. Ne
  // s'active qu'en mode visiteur, où le lecteur est réel (voir « surLecture »).
  const [enLecture, setEnLecture] = useState(false)

  return (
    <article className="mdl mdl-3">
      {/* Premier écran : la composition vidéo. Le cadre la cantonne — sans
          lui, la vidéo en position absolue s'étirerait derrière les blocs
          ajoutés à la suite. La classe « --lecture » efface le voile et le
          texte superposé pendant que la vidéo joue. */}
      <div className={`mdl-3__ecran${enLecture ? ' mdl-3__ecran--lecture' : ''}`}>
        <div className="mdl-3__video">
          {env(
            { nom: 'video', type: 'video', classe: '' },
            <BlocVideo
              valeur={lireVideo(contenu, 'video')}
              media={media}
              libelleVide="Vidéo plein écran"
              lisible={lecteurVideo}
              surLecture={setEnLecture}
            />,
          )}
        </div>

        <div className="mdl-3__voile" aria-hidden="true" />

        <div className="mdl-3__superpose">
          <div className="mdl-3__principal">
            {env(
              { nom: 'titre', type: 'titre', classe: 'b-h1' },
              <h1 className="b-h1 b-h1--clair">
                <TitreOuVide texte={lireTexte(contenu, 'titre')} secours="Titre de la page" />
              </h1>,
            )}
            {env(
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
            {env(
              { nom: 'encartTitre', type: 'titre', classe: 'b-h3' },
              <h2 className="b-h3">
                <TitreOuVide texte={encartTitre} secours="Titre de l'encart" />
              </h2>,
            )}
            {env(
              { nom: 'encartTexte', type: 'texte', classe: 'b-petit' },
              <div className="b-petit">
                <TexteOuVide texte={encartTexte} secours="Information pratique" />
              </div>,
            )}
          </aside>
        </div>
      </div>

      <RenduSuite contenu={contenu} media={media} emp={emp} surImage={surImage} section="ecran" />
    </article>
  )
}
