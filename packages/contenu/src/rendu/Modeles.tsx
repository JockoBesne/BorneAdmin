import { useRef, useState, type ReactNode } from 'react'
import {
  colonnesDe,
  colonnesEmplacement,
  estBlocLibreVide,
  lireGalerie,
  lireImage,
  lireStyle,
  lireSuite,
  lireTexte,
  lireValeurTexte,
  lireVideo,
  positionBloc,
} from '../lecture.js'
import { modelePar } from '../modeles/index.js'
import { lignesDeTexte } from '../texte.js'
import {
  COLONNES_GRILLE,
  COLONNES_MIN,
  type BlocLibre,
  type ContenuPage,
  type StyleBloc,
  type ValeurTexte,
} from '../types.js'
import { AtelierFrise, AtelierQuiz } from './ateliers.jsx'
import { BlocGalerie, BlocImage, BlocVideo } from './blocs.jsx'
import { TexteEnrichi } from './TexteEnrichi.jsx'
import type { EnveloppeEmplacement, PropsModele } from './types.js'

/* Les trois modèles. Ces composants sont utilisés à l'identique par
 * l'administration (aperçu et édition) et par la borne (§7.2) : c'est ce qui
 * rend l'aperçu fidèle par construction, et non par ressemblance. */

const SANS_ENVELOPPE: EnveloppeEmplacement = (_info, defaut) => defaut

/**
 * Habillage d'un bloc : son fond et la mise en forme de son texte.
 *
 * Un bloc sans habillage n'est pas enveloppé du tout — le rendu des pages
 * écrites avant ce réglage est inchangé, au nœud près. Les classes font le
 * travail (voir « modeles.css ») : elles doivent l'emporter sur la couleur et
 * la graisse que chaque bloc se donne lui-même (`.b-h1`, `.b-corps`…), ce qu'un
 * simple style hérité ne ferait pas.
 */
function Habillage({ style, children }: { style: StyleBloc | undefined; children: ReactNode }) {
  if (!style) return <>{children}</>

  const classes = ['b-hab']
  if (style.fond) classes.push('b-hab--fond')
  if (style.couleur) classes.push('b-hab--couleur')
  if (style.gras) classes.push('b-hab--gras')
  if (style.italique) classes.push('b-hab--italique')
  if (style.souligne) classes.push('b-hab--souligne')
  if (style.alignement === 'centre') classes.push('b-hab--centre')
  if (style.alignement === 'droite') classes.push('b-hab--droite')
  if (classes.length === 1) return <>{children}</>

  return (
    <div className={classes.join(' ')} style={{ background: style.fond, color: style.couleur }}>
      {children}
    </div>
  )
}

/**
 * L'enveloppe des blocs, habillage compris. Elle passe par un seul point : la
 * borne et l'éditeur habillent donc les blocs exactement pareil, et l'aperçu
 * reste fidèle sans que rien ne soit à tenir en double.
 */
function habiller(contenu: ContenuPage, emp?: EnveloppeEmplacement): EnveloppeEmplacement {
  const base = emp ?? SANS_ENVELOPPE
  return (info, defaut) =>
    base(info, <Habillage style={lireStyle(contenu, info.nom)}>{defaut}</Habillage>)
}

function TitreOuVide({ texte, secours }: { texte: string; secours: string }) {
  if (texte.trim() === '') return <span className="b-attente">{secours}</span>
  return <>{texte}</>
}

function TexteOuVide({ valeur, secours }: { valeur: ValeurTexte; secours: string }) {
  if (valeur.valeur.trim() === '') return <span className="b-attente">{secours}</span>
  return <TexteEnrichi lignes={lignesDeTexte(valeur)} />
}


/**
 * Poignée de largeur d'un bloc.
 *
 * On l'attrape et on tire : la largeur suit le doigt, mais s'aimante sur une
 * colonne de la grille. Le geste est celui d'un logiciel de présentation ; la
 * grille, elle, garantit qu'une page ne peut ni se trouer ni faire se
 * chevaucher deux blocs.
 *
 * Le pas est mesuré sur la grille affichée, pas calculé à partir des 1920 px
 * de la toile : l'aperçu de l'éditeur est réduit, et un pas en pixels de toile
 * ferait glisser le bloc deux fois plus vite que le doigt.
 */
function PoigneeLargeur({
  cle,
  colonnes,
  surRedimensionner,
}: {
  /** Identifie ce qu'on redimensionne : « suite:<id> » ou un nom d'emplacement. */
  cle: string
  colonnes: number
  surRedimensionner: (cle: string, colonnes: number) => void
}) {
  const poignee = useRef<HTMLButtonElement>(null)
  const depart = useRef<{ x: number; colonnes: number; pas: number } | null>(null)

  const commencer = (evenement: React.PointerEvent<HTMLButtonElement>) => {
    const grille = poignee.current?.closest('.mdl__grille')
    if (!grille) return
    const pas = grille.getBoundingClientRect().width / COLONNES_GRILLE
    if (pas <= 0) return
    depart.current = { x: evenement.clientX, colonnes, pas }
    try {
      evenement.currentTarget.setPointerCapture(evenement.pointerId)
    } catch {
      /* capture indisponible : le glissement reste possible sans elle */
    }
  }

  const glisser = (evenement: React.PointerEvent<HTMLButtonElement>) => {
    const debut = depart.current
    if (!debut) return
    const ecart = Math.round((evenement.clientX - debut.x) / debut.pas)
    const cible = Math.min(COLONNES_GRILLE, Math.max(COLONNES_MIN, debut.colonnes + ecart))
    if (cible !== colonnes) surRedimensionner(cle, cible)
  }

  const finir = () => {
    depart.current = null
  }

  return (
    <button
      ref={poignee}
      type="button"
      className="mdl__poignee"
      onPointerDown={commencer}
      onPointerMove={glisser}
      onPointerUp={finir}
      onPointerCancel={finir}
      // Alternative au clavier : le glissement ne doit jamais être le seul
      // moyen de régler une largeur (§6.9 de la conception).
      onKeyDown={(evenement) => {
        if (evenement.key === 'ArrowLeft') {
          evenement.preventDefault()
          surRedimensionner(cle, Math.max(COLONNES_MIN, colonnes - 1))
        }
        if (evenement.key === 'ArrowRight') {
          evenement.preventDefault()
          surRedimensionner(cle, Math.min(COLONNES_GRILLE, colonnes + 1))
        }
      }}
      aria-label={`Largeur : ${colonnes} colonnes sur ${COLONNES_GRILLE}. Flèches gauche et droite pour ajuster.`}
      title="Tirer pour changer la largeur"
    >
      <span className="mdl__poignee-barre" aria-hidden="true" />
    </button>
  )
}

/**
 * Grille d'une page : emplacements du modèle et blocs ajoutés, dans l'ordre,
 * sur les mêmes 12 colonnes.
 *
 * C'est ce qui rend *toute* la page redimensionnable : un titre, une image du
 * modèle et un bloc ajouté sont désormais la même chose du point de vue de la
 * mise en page — une cellule d'une largeur réglable. Les modèles ne décrivent
 * plus une disposition figée, seulement les emplacements qu'ils proposent et
 * leur largeur de départ.
 */
function RenduGrille({
  contenu,
  media,
  emp,
  surImage,
  surRedimensionner,
  lecteurVideo,
}: PropsModele) {
  const edition = emp !== undefined
  const env = habiller(contenu, emp)
  const modele = modelePar(contenu.modele)
  if (!modele) return null

  const sections = modele.sections.map((section) => section.nom)
  const suite = lireSuite(contenu)

  const cellules: ReactNode[] = []

  const enveloppeCellule = (
    cle: string,
    colonnes: number,
    classe: string,
    enfant: ReactNode,
  ) => (
    <div
      key={cle}
      className={`mdl__cellule${classe ? ` ${classe}` : ''}`}
      style={{ gridColumn: `span ${colonnes}` }}
    >
      {enfant}
      {surRedimensionner ? (
        <PoigneeLargeur cle={cle} colonnes={colonnes} surRedimensionner={surRedimensionner} />
      ) : null}
    </div>
  )

  for (const section of modele.sections) {
    // 1. Les emplacements de la section, dans l'ordre déclaré par le modèle.
    for (const nom of section.emplacements) {
      const def = modele.emplacements[nom]
      if (!def) continue
      const colonnes = colonnesEmplacement(contenu, nom, def.colonnes)
      cellules.push(
        enveloppeCellule(
          nom,
          colonnes,
          def.type === 'galerie' ? 'mdl__cellule--galerie' : '',
          renduEmplacement(nom, def.type, { contenu, media, surImage, lecteurVideo }, env),
        ),
      )
    }

    // 2. Puis les blocs ajoutés ancrés après cette section.
    for (const bloc of suite) {
      if (positionBloc(bloc, sections) !== section.nom) continue
      if (!edition && estBlocLibreVide(bloc)) continue
      cellules.push(
        enveloppeCellule(
          `suite:${bloc.id}`,
          colonnesDe(bloc),
          bloc.valeur.type === 'galerie'
            ? 'mdl__cellule--galerie'
            : bloc.valeur.type === 'video'
              ? 'mdl__cellule--video'
              : '',
          renduBlocLibre(bloc, { contenu, media, surImage, lecteurVideo }, env),
        ),
      )
    }
  }

  return <div className="mdl__grille">{cellules}</div>
}

/** Rendu par défaut d'un emplacement du modèle, selon son type. */
function renduEmplacement(
  nom: string,
  type: string,
  ctx: Pick<PropsModele, 'contenu' | 'media' | 'surImage' | 'lecteurVideo'>,
  env: EnveloppeEmplacement,
): ReactNode {
  const { contenu, media, surImage, lecteurVideo } = ctx
  switch (type) {
    case 'titre':
      return env(
        { nom, type: 'titre', classe: 'b-h1' },
        <h1 className="b-h1">
          <TitreOuVide texte={lireTexte(contenu, nom)} secours="Titre de la page" />
        </h1>,
      )
    case 'texte':
      return env(
        { nom, type: 'texte', classe: 'b-corps' },
        <div className="b-corps">
          <TexteOuVide valeur={lireValeurTexte(contenu, nom)} secours="Texte de la page" />
        </div>,
      )
    case 'image':
      return env(
        { nom, type: 'image', classe: '' },
        <BlocImage
          valeur={lireImage(contenu, nom)}
          media={media}
          profil="grand"
          libelleVide="Image"
          surImage={surImage}
        />,
      )
    case 'galerie':
      return env(
        { nom, type: 'galerie', classe: '' },
        <BlocGalerie
          elements={lireGalerie(contenu, nom)}
          media={media}
          libelleVide="Galerie"
          surImage={surImage}
        />,
      )
    case 'video':
      return env(
        { nom, type: 'video', classe: '' },
        <BlocVideo
          valeur={lireVideo(contenu, nom)}
          media={media}
          libelleVide="Vidéo"
          lisible={lecteurVideo ?? false}
        />,
      )
    default:
      return null
  }
}

/**
 * Blocs ajoutés librement, affichés après la section « section » du modèle.
 *
 * En mode visiteur (pas d'enveloppe), un bloc vide est sauté : le public ne
 * voit jamais de zone en attente. Dans l'éditeur (enveloppe fournie), il est
 * affiché pour rester sélectionnable et modifiable.
 */
/** Rendu par défaut d'un bloc ajouté, selon son type. */
function renduBlocLibre(
  bloc: BlocLibre,
  ctx: Pick<PropsModele, 'contenu' | 'media' | 'surImage' | 'lecteurVideo'>,
  env: EnveloppeEmplacement,
): ReactNode {
  const { media, surImage, lecteurVideo } = ctx
  const nom = `suite:${bloc.id}`
  // Éditeur : les vidéos et les ateliers sont affichés mais inertes, sinon
  // toucher une réponse répondrait au quiz au lieu de sélectionner le bloc.
  const jouable = lecteurVideo ?? false

  switch (bloc.valeur.type) {
    case 'texte':
      return env(
        { nom, type: 'texte', classe: 'b-corps' },
        <div className="b-corps">
          <TexteOuVide valeur={bloc.valeur} secours="Texte ajouté (vide)" />
        </div>,
      )
    case 'image':
      return env(
        { nom, type: 'image', classe: '' },
        <BlocImage
          valeur={bloc.valeur}
          media={media}
          profil="grand"
          libelleVide="Photo ajoutée (vide)"
          surImage={surImage}
        />,
      )
    case 'galerie':
      return env(
        { nom, type: 'galerie', classe: '' },
        <BlocGalerie
          elements={bloc.valeur.elements}
          media={media}
          libelleVide="Galerie ajoutée (vide)"
          surImage={surImage}
        />,
      )
    case 'video':
      return env(
        { nom, type: 'video', classe: '' },
        <BlocVideo
          valeur={bloc.valeur}
          media={media}
          libelleVide="Vidéo ajoutée (vide)"
          lisible={jouable}
        />,
      )
    case 'quiz':
      return env(
        { nom, type: 'quiz', classe: '' },
        <AtelierQuiz valeur={bloc.valeur} jouable={jouable} />,
      )
    case 'frise':
      return env(
        { nom, type: 'frise', classe: '' },
        <AtelierFrise valeur={bloc.valeur} jouable={jouable} />,
      )
  }
}

// ── Modèle 1 — Une image, un texte ───────────────────────────────────────────

export function Modele1(props: PropsModele) {
  return (
    <article className="mdl mdl-1">
      <RenduGrille {...props} />
    </article>
  )
}

// ── Modèle 2 — Image et texte côte à côte ────────────────────────────────────

export function Modele2(props: PropsModele) {
  return (
    <article className="mdl mdl-2">
      <RenduGrille {...props} />
    </article>
  )
}

/**
 * Blocs ajoutés seuls, sur la grille de 12 colonnes.
 *
 * Sert au modèle 3, dont la composition vidéo est indivisible (sa déclaration
 * le dit expressément) : ses emplacements ne passent donc pas par la grille,
 * mais les blocs ajoutés dessous, si.
 */
function GrilleBlocsAjoutes({
  contenu,
  media,
  emp,
  surImage,
  surRedimensionner,
  lecteurVideo,
}: PropsModele) {
  const edition = emp !== undefined
  const env = habiller(contenu, emp)
  const sections = (modelePar(contenu.modele)?.sections ?? []).map((s) => s.nom)
  const blocs = lireSuite(contenu).filter((bloc) => edition || !estBlocLibreVide(bloc))
  if (blocs.length === 0) return null
  void sections

  return (
    <div className="mdl__grille">
      {blocs.map((bloc) => {
        const colonnes = colonnesDe(bloc)
        return (
          <div
            key={bloc.id}
            className={`mdl__cellule${
              bloc.valeur.type === 'galerie'
                ? ' mdl__cellule--galerie'
                : bloc.valeur.type === 'video'
                  ? ' mdl__cellule--video'
                  : ''
            }`}
            style={{ gridColumn: `span ${colonnes}` }}
          >
            {renduBlocLibre(bloc, { contenu, media, surImage, lecteurVideo }, env)}
            {surRedimensionner ? (
              <PoigneeLargeur
                cle={`suite:${bloc.id}`}
                colonnes={colonnes}
                surRedimensionner={surRedimensionner}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// ── Modèle 3 — Vidéo en avant ────────────────────────────────────────────────

export function Modele3({
  contenu,
  media,
  emp,
  surImage,
  surRedimensionner,
  lecteurVideo = false,
}: PropsModele) {
  const env = habiller(contenu, emp)
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
                  valeur={lireValeurTexte(contenu, 'texte')}
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
                <TexteOuVide
                  valeur={lireValeurTexte(contenu, 'encartTexte')}
                  secours="Information pratique"
                />
              </div>,
            )}
          </aside>
        </div>
      </div>

      <GrilleBlocsAjoutes
        contenu={contenu}
        media={media}
        emp={emp}
        surImage={surImage}
        surRedimensionner={surRedimensionner}
        lecteurVideo={lecteurVideo}
      />
    </article>
  )
}
