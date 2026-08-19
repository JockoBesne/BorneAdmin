import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  colonnesDe,
  colonnesEmplacement,
  decalageDe,
  decalageEmplacement,
  estAncreBas,
  estBlocLibreVide,
  estRecadre,
  focalDe,
  hauteurDe,
  hauteurEmplacement,
  hauteurReglable,
  lireGalerie,
  lireImage,
  lireStyle,
  lireSuite,
  lireTexte,
  lireValeurTexte,
  lireVideo,
  ordreCellules,
} from '../lecture.js'
import { modelePar } from '../modeles/index.js'
import { lignesDeTexte } from '../texte.js'
import {
  COLONNES_GRILLE,
  COLONNES_MIN,
  HAUTEUR_MAX,
  HAUTEUR_MIN,
  HAUTEUR_PAS,
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
  // Remplir la hauteur réglée, au lieu de la laisser en espace autour du bloc.
  if (style.remplir) classes.push('b-hab--remplir')
  if (style.couleur) classes.push('b-hab--couleur')
  if (style.gras) classes.push('b-hab--gras')
  if (style.italique) classes.push('b-hab--italique')
  if (style.souligne) classes.push('b-hab--souligne')
  if (style.alignement === 'centre') classes.push('b-hab--centre')
  if (style.alignement === 'droite') classes.push('b-hab--droite')
  const taille = style.taille !== undefined && style.taille !== 100 ? style.taille : null
  if (taille !== null) classes.push('b-hab--taille')
  if (classes.length === 1) return <>{children}</>

  // Transparence : elle ne touche que le **fond**, mélangé à du transparent —
  // le texte et les photos posés dessus restent nets. Sans fond, elle n'a rien
  // à rendre translucide. (« color-mix » évite de décomposer le « #rrggbb ».)
  const fond =
    style.fond !== undefined && style.opacite !== undefined && style.opacite < 100
      ? `color-mix(in srgb, ${style.fond} ${style.opacite}%, transparent)`
      : style.fond

  // La taille passe par une variable CSS plutôt que par « font-size » : les
  // textes du rendu ont chacun leur taille en pixels, qu'un « font-size » posé
  // au-dessus n'atteindrait pas. Chaque texte multiplie la sienne par ce
  // facteur — leurs écarts sont donc conservés.
  return (
    <div
      className={classes.join(' ')}
      style={
        {
          background: fond,
          color: style.couleur,
          ...(taille !== null ? { '--facteur-texte': taille / 100 } : {}),
        } as CSSProperties
      }
    >
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
 * Poignée de largeur d'un bloc, sur son bord **droit**.
 *
 * On l'attrape et on tire : la largeur suit le doigt, mais s'aimante sur une
 * colonne de la grille. Le geste est celui d'un logiciel de présentation ; la
 * grille, elle, garantit que deux blocs ne peuvent pas se chevaucher.
 *
 * **Pas de poignée à gauche.** Elle a été essayée dans les deux sens — déplacer
 * le bord gauche, puis déplacer le bloc entier — et retirée : le glisser-déposer
 * place déjà un bloc où l'on veut, y compris dans le vide d'une rangée. Une
 * poignée de plus sur le bord opposé ne servait qu'à créer de la confusion, en
 * restant immobile pendant que le bloc, lui, se déplaçait.
 *
 * Le pas est mesuré sur la grille affichée, pas calculé à partir des 1920 px
 * de la toile : l'aperçu de l'éditeur est réduit, et un pas en pixels de toile
 * ferait glisser le bloc deux fois plus vite que le doigt.
 */
function PoigneeLargeur({
  cle,
  colonnes,
  decalage,
  surRedimensionner,
}: {
  /** Identifie ce qu'on redimensionne : « suite:<id> » ou un nom d'emplacement. */
  cle: string
  colonnes: number
  /** Colonnes vides à gauche du bloc : elles mangent sa largeur possible. */
  decalage: number
  surRedimensionner: (cle: string, colonnes: number) => void
}) {
  const poignee = useRef<HTMLButtonElement>(null)
  const depart = useRef<{ x: number; colonnes: number; pas: number } | null>(null)

  /** Largeur voulue, bornée : jamais sous le minimum, jamais hors de la page. */
  const bornee = (voulue: number): number =>
    Math.min(COLONNES_GRILLE - decalage, Math.max(COLONNES_MIN, voulue))

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
    const cible = bornee(debut.colonnes + Math.round((evenement.clientX - debut.x) / debut.pas))
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
        const sens = evenement.key === 'ArrowLeft' ? -1 : evenement.key === 'ArrowRight' ? 1 : 0
        if (sens === 0) return
        evenement.preventDefault()
        surRedimensionner(cle, bornee(colonnes + sens))
      }}
      aria-label={`Taille. Largeur : ${colonnes} colonnes sur ${COLONNES_GRILLE}. Flèches gauche et droite pour ajuster.`}
      title="Tirer pour changer la taille"
    >
      <span className="mdl__poignee-barre" aria-hidden="true" />
    </button>
  )
}

/**
 * Poignée de hauteur, sur le bord **bas** ou **haut** — sur tout bloc, sauf
 * une photo non recadrée (voir « hauteurReglable »). Sur un bloc qui s'écoule
 * (texte, quiz, frise), la hauteur réglée est un plancher : elle ajoute de la
 * place, elle n'en retire jamais.
 *
 * Les deux poignées règlent la **même** hauteur, en sens inverse : tirer le
 * bord bas vers le bas agrandit, tirer le bord haut vers le haut agrandit
 * aussi. Chacune retient **son** bord opposé : la poignée du bas laisse le haut
 * du bloc en place, celle du haut pose l'ancre en bas (`StyleBloc.ancre`) et
 * fait donc monter le haut sans que le bas ne bouge.
 *
 * Ce que l'ancre ne peut pas faire : si le bloc est le plus grand de sa rangée,
 * il n'y a rien au-dessus de lui à reprendre — la rangée elle-même grandit, et
 * elle ne peut grandir que vers le bas, une page s'écoulant de haut en bas.
 * L'ancre joue tant qu'un voisin plus grand laisse de la place.
 */
function PoigneeHauteur({
  cle,
  hauteur,
  cote,
  surHauteur,
}: {
  cle: string
  /** Hauteur courante, ou « undefined » tant qu'elle n'a jamais été réglée. */
  hauteur: number | undefined
  cote: 'haut' | 'bas'
  surHauteur: (cle: string, hauteur: number, ancre?: 'bas') => void
}) {
  const poignee = useRef<HTMLButtonElement>(null)
  const depart = useRef<{ y: number; hauteur: number; echelle: number } | null>(null)

  const commencer = (evenement: React.PointerEvent<HTMLButtonElement>) => {
    const cellule = poignee.current?.parentElement
    const page = poignee.current?.closest('.mdl')
    if (!cellule || !page) return
    // L'aperçu est réduit : un déplacement de N pixels à l'écran vaut N/échelle
    // pixels de toile. Sans cette conversion, la hauteur suivrait deux fois
    // plus vite que le doigt.
    const echelle = page.getBoundingClientRect().width / 1920
    if (echelle <= 0) return
    depart.current = {
      y: evenement.clientY,
      hauteur: hauteur ?? cellule.getBoundingClientRect().height / echelle,
      echelle,
    }
    try {
      evenement.currentTarget.setPointerCapture(evenement.pointerId)
    } catch {
      /* capture indisponible : le glissement reste possible sans elle */
    }
  }

  // Le bord haut travaille à l'envers du bord bas : monter le doigt agrandit.
  const sens = cote === 'bas' ? 1 : -1
  // …et il retient le bas du bloc, quand la rangée le permet. Le bord bas, lui,
  // remet l'ancrage ordinaire : c'est ainsi qu'on revient en arrière.
  const ancre = cote === 'haut' ? ('bas' as const) : undefined

  const borner = (brute: number): number =>
    Math.min(HAUTEUR_MAX, Math.max(HAUTEUR_MIN, Math.round(brute / HAUTEUR_PAS) * HAUTEUR_PAS))

  const glisser = (evenement: React.PointerEvent<HTMLButtonElement>) => {
    const debut = depart.current
    if (!debut) return
    const ecart = ((evenement.clientY - debut.y) / debut.echelle) * sens
    const cible = borner(debut.hauteur + ecart)
    if (cible !== hauteur) surHauteur(cle, cible, ancre)
  }

  const finir = () => {
    depart.current = null
  }

  return (
    <button
      ref={poignee}
      type="button"
      className={`mdl__poignee-hauteur mdl__poignee--${cote}`}
      onPointerDown={commencer}
      onPointerMove={glisser}
      onPointerUp={finir}
      onPointerCancel={finir}
      onKeyDown={(evenement) => {
        const base = hauteur ?? 620
        if (evenement.key === 'ArrowUp') {
          evenement.preventDefault()
          surHauteur(cle, borner(base - HAUTEUR_PAS * sens), ancre)
        }
        if (evenement.key === 'ArrowDown') {
          evenement.preventDefault()
          surHauteur(cle, borner(base + HAUTEUR_PAS * sens), ancre)
        }
      }}
      aria-label={`Bord ${cote}. Hauteur : ${hauteur ?? 'automatique'}. Flèches haut et bas pour ajuster.`}
      title={
        cote === 'bas' ? 'Tirer pour changer la hauteur' : 'Tirer vers le haut pour agrandir'
      }
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
  surHauteur,
  lecteurVideo,
  seulementSuite = false,
}: PropsModele & {
  /**
   * Modèle 3 : seuls les blocs **ajoutés** passent par la grille — ses
   * emplacements à lui sont dessinés dans la composition vidéo, qui est
   * indivisible. Tout le reste (l'ordre de la page, les largeurs, les hauteurs,
   * les décalages, les poignées) est celui des autres modèles : il n'y a qu'un
   * seul chemin, donc rien qui puisse diverger. Une grille séparée l'avait
   * fait — elle affichait les blocs dans l'ordre où ils avaient été créés, et
   * les flèches ▲▼ ne changeaient rien.
   */
  seulementSuite?: boolean
}) {
  const edition = emp !== undefined
  const env = habiller(contenu, emp)
  const modele = modelePar(contenu.modele)
  if (!modele) return null

  const suite = lireSuite(contenu)

  const cellules: ReactNode[] = []

  const enveloppeCellule = (
    cle: string,
    colonnes: number,
    classe: string,
    enfant: React.ReactNode,
    type: string,
    hauteur: number | undefined,
    decalage: number,
    recadre: boolean,
  ) => (
    <div
      key={cle}
      className={`mdl__cellule${classe ? ` ${classe}` : ''}${
        hauteur === undefined ? '' : ' mdl__cellule--hauteur'
      }${estAncreBas(contenu, cle) ? ' mdl__cellule--bas' : ''}`}
      style={{
        // La cellule occupe le décalage **et** le bloc : les colonnes vides
        // sont à l'intérieur d'elle, en marge gauche (voir « modeles.css »).
        // C'est ce qui laisse un trou sans déplacer les blocs suivants.
        gridColumn: `span ${decalage + colonnes}`,
        ...(decalage === 0
          ? {}
          : {
              ['--decalage' as string]: decalage,
              ['--travee' as string]: decalage + colonnes,
            }),
        // Variable lue par le rendu : plafond de l'image, hauteur de la
        // galerie. Absente, chacun garde sa valeur d'origine.
        ...(hauteur === undefined ? {} : { ['--hauteur-bloc' as string]: `${hauteur}px` }),
      }}
    >
      {enfant}
      {/* Bord droit : la largeur. Bords haut et bas : la hauteur, pour les blocs
          qui en ont une. Rien à gauche — le glisser-déposer s'en charge. */}
      {surRedimensionner ? (
        <PoigneeLargeur
          cle={cle}
          colonnes={colonnes}
          decalage={decalage}
          surRedimensionner={surRedimensionner}
        />
      ) : null}
      {surHauteur && hauteurReglable(type, recadre)
        ? (['haut', 'bas'] as const).map((cote) => (
            <PoigneeHauteur
              key={cote}
              cle={cle}
              hauteur={hauteur}
              cote={cote}
              surHauteur={surHauteur}
            />
          ))
        : null}
    </div>
  )

  // L'ordre des cellules vient du contenu (« ordre »), pas du modèle : un
  // emplacement du modèle et un bloc ajouté se déplacent et se mélangent
  // librement. Sans « ordre », on retrouve l'ordre du modèle — voir
  // `ordreCellules`.
  for (const cle of ordreCellules(contenu, modele)) {
    if (seulementSuite && !cle.startsWith('suite:')) continue
    if (cle.startsWith('suite:')) {
      const bloc = suite.find((candidat) => `suite:${candidat.id}` === cle)
      if (!bloc) continue
      if (!edition && estBlocLibreVide(bloc)) continue
      cellules.push(
        enveloppeCellule(
          cle,
          colonnesDe(bloc),
          bloc.valeur.type === 'galerie'
            ? 'mdl__cellule--galerie'
            : bloc.valeur.type === 'video'
              ? 'mdl__cellule--video'
              : '',
          renduBlocLibre(bloc, { contenu, media, surImage, lecteurVideo }, env),
          bloc.valeur.type,
          hauteurDe(contenu, bloc),
          decalageDe(bloc),
          estRecadre(contenu, cle),
        ),
      )
      continue
    }

    const def = modele.emplacements[cle]
    if (!def) continue
    const colonnes = colonnesEmplacement(contenu, cle, def.colonnes)
    cellules.push(
      enveloppeCellule(
        cle,
        colonnes,
        def.type === 'galerie' ? 'mdl__cellule--galerie' : '',
        renduEmplacement(cle, def.type, { contenu, media, surImage, lecteurVideo }, env),
        def.type,
        hauteurEmplacement(contenu, cle, def.type),
        decalageEmplacement(contenu, cle, colonnes),
        estRecadre(contenu, cle),
      ),
    )
  }

  // Modèle 3 sans bloc ajouté : pas de grille du tout sous la composition
  // vidéo, sinon ses marges laisseraient une bande vide. Les autres modèles
  // gardent leur grille même vide — leur mise en page d'avant, au nœud près.
  if (seulementSuite && cellules.length === 0) return null
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
          focal={focalDe(contenu, nom)}
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
  const { contenu, media, surImage, lecteurVideo } = ctx
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
          focal={focalDe(contenu, nom)}
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

/**
 * Modèle 0 — page vierge. Rien d'imposé : la grille affiche les blocs ajoutés,
 * et seulement eux. Même rendu que les autres, sans emplacement de départ.
 */
export function Modele0(props: PropsModele) {
  return (
    <article className="mdl mdl-0">
      <RenduGrille {...props} />
    </article>
  )
}

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

// ── Modèle 3 — Vidéo en avant ────────────────────────────────────────────────

export function Modele3(props: PropsModele) {
  const { contenu, media, emp, lecteurVideo = false } = props
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

      {/* Les blocs ajoutés passent par la **même** grille que les autres
          modèles : l'ordre de la page, les hauteurs et les poignées y sont donc
          les mêmes partout. Seuls les emplacements du modèle sont écartés — ils
          sont dessinés ci-dessus, dans la composition vidéo. */}
      <RenduGrille {...props} lecteurVideo={lecteurVideo} seulementSuite />
    </article>
  )
}
