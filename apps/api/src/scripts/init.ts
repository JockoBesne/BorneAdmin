/**
 * Initialisation : crée la base, les comptes, les réglages et un jeu de
 * contenus de démonstration. Idempotent — relancer ne duplique rien.
 *
 *   npm run init
 */
import process from 'node:process'
import sharp from 'sharp'
import type { ContenuPage } from '@borne/contenu'
import { base } from '../base/connexion.js'
import {
  creerUtilisateur,
  ecrireParametre,
  lireUtilisateurParIdentifiant,
  PIN_DEFAUT,
} from '../depots/divers.js'
import { nouvelId } from '../domaine/identifiants.js'
import * as depotMedias from '../depots/medias.js'
import * as depotPages from '../depots/pages.js'
import { traiterImage } from '../medias/stockage.js'
import { hacherMotDePasse } from '../securite/mots-de-passe.js'
import { mettreEnLigne } from '../services/pages.js'
import type { Connecte } from '../securite/sessions.js'

const MOT_DE_PASSE_DEMO = 'motdepassedemo'

const COMPTES = [
  {
    identifiant: 's.martin',
    nomAffiche: 'Sylvie Martin',
    role: 'editeur' as const,
  },
  {
    identifiant: 'm.petit',
    nomAffiche: 'Marc Petit',
    role: 'editeur' as const,
  },
  {
    identifiant: 'h.dubois',
    nomAffiche: 'Hélène Dubois',
    role: 'administrateur' as const,
  },
]

/** Images de démonstration générées localement : aucune ressource distante,
 *  et le musée remplacera ces visuels par les siens. */
const VISUELS = [
  { nom: 'salle-exposition', teinte: '#1b3b5c', accent: '#e9b44c', libelle: "Salle d'exposition" },
  { nom: 'poste-radio', teinte: '#2a4258', accent: '#8fb8d8', libelle: 'Poste radio' },
  { nom: 'atelier', teinte: '#3a3f4b', accent: '#d8b98f', libelle: 'Atelier' },
  { nom: 'antenne', teinte: '#123141', accent: '#7fd8c0', libelle: 'Antenne' },
  { nom: 'archives', teinte: '#432f2a', accent: '#e0a878', libelle: 'Archives' },
  { nom: 'insigne', teinte: '#1d2f4d', accent: '#f0d68a', libelle: 'Insigne' },
  { nom: 'vitrine', teinte: '#2b3a2f', accent: '#bcd8a0', libelle: 'Vitrine' },
  { nom: 'detail', teinte: '#4a2f3d', accent: '#e8a8c0', libelle: 'Détail' },
]

function visuelSvg(teinte: string, accent: string, libelle: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
    <defs>
      <linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${teinte}"/>
        <stop offset="100%" stop-color="#0b1622"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="1000" fill="url(#f)"/>
    <circle cx="1240" cy="250" r="190" fill="${accent}" opacity="0.16"/>
    <circle cx="320" cy="780" r="260" fill="${accent}" opacity="0.10"/>
    <rect x="80" y="80" width="1440" height="840" fill="none" stroke="${accent}" stroke-width="3" opacity="0.35"/>
    <text x="800" y="520" font-family="Georgia, serif" font-size="76" fill="${accent}"
          text-anchor="middle" opacity="0.9">${libelle}</text>
    <text x="800" y="596" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#ffffff"
          text-anchor="middle" opacity="0.55">Image de démonstration</text>
  </svg>`)
}

function texteDemo(corps: string): string {
  return `${corps}\n\n_Texte de démonstration — à remplacer par le contenu rédigé et validé par le musée._`
}

async function principal(): Promise<void> {
  base()

  // ── Comptes ───────────────────────────────────────────────────────────────
  const hash = hacherMotDePasse(MOT_DE_PASSE_DEMO)
  for (const compte of COMPTES) {
    if (lireUtilisateurParIdentifiant(compte.identifiant)) continue
    creerUtilisateur({ id: nouvelId(), motDePasseHash: hash, ...compte })
    console.log(`[init] compte créé : ${compte.identifiant} (${compte.role})`)
  }

  const admin = lireUtilisateurParIdentifiant('h.dubois')
  if (!admin) throw new Error('compte administrateur introuvable')
  const auteur: Connecte = {
    id: admin.id,
    identifiant: admin.identifiant,
    nomAffiche: admin.nom_affiche,
    role: 'administrateur',
    jetonCsrf: '',
  }

  // ── Réglages ──────────────────────────────────────────────────────────────
  ecrireParametre('reglages', {
    titreVeille: 'Musée des Transmissions',
    sousTitreVeille: "Touchez l'écran pour découvrir l'exposition",
    minutesAvantVeille: 3,
  })
  ecrireParametre('pinBorne', PIN_DEFAUT)

  // ── Pages déjà présentes ? on s'arrête là ────────────────────────────────
  const dejaDesPages = depotPages.listerPages().length > 0
  if (dejaDesPages) {
    console.log('[init] des pages existent déjà : contenus de démonstration non recréés.')
    console.log(terminer())
    return
  }

  // ── Médias de démonstration ───────────────────────────────────────────────
  const medias: Record<string, string> = {}
  for (const visuel of VISUELS) {
    const donnees = await sharp(visuelSvg(visuel.teinte, visuel.accent, visuel.libelle))
      .png()
      .toBuffer()
    const resultat = await traiterImage(donnees)

    const existant = depotMedias.lireMediaParEmpreinte(resultat.empreinte)
    if (existant) {
      medias[visuel.nom] = existant.id
      continue
    }

    const id = nouvelId()
    depotMedias.creerMedia({
      id,
      empreinte: resultat.empreinte,
      type: 'image',
      mime: resultat.mime,
      extension: resultat.extension,
      nomOrigine: `${visuel.nom}.png`,
      nomAffiche: visuel.libelle,
      poidsOctets: donnees.length,
      poidsOptimise: resultat.poidsOptimise,
      largeur: resultat.largeur,
      hauteur: resultat.hauteur,
      dureeSecondes: null,
      aPoster: false,
      utilisateurId: auteur.id,
    })
    depotMedias.majMedia(id, { legende: `${visuel.libelle} — image de démonstration` })
    medias[visuel.nom] = id
  }
  console.log(`[init] ${VISUELS.length} images de démonstration créées`)

  // ── Pages de démonstration ────────────────────────────────────────────────
  const pages: {
    titre: string
    modele: 't1' | 't2' | 't3'
    contenu: ContenuPage
    publier: boolean
  }[] = [
    {
      titre: "Bienvenue au Musée des Transmissions",
      modele: 't1',
      publier: true,
      contenu: {
        modele: 't1',
        emplacements: {
          titre: { type: 'titre', valeur: 'Bienvenue au Musée des Transmissions' },
          image: {
            type: 'image',
            mediaId: medias['salle-exposition'] ?? null,
            legende: "Vue de la salle d'exposition",
          },
          texte: {
            type: 'texte',
            valeur: texteDemo(
              "Cette borne présente les pages créées depuis l'interface d'administration. Touchez une page du sommaire pour la consulter, puis utilisez **Précédent** et **Suivant** pour parcourir l'exposition.",
            ),
          },
        },
      },
    },
    {
      titre: 'Un objet, une histoire',
      modele: 't2',
      publier: true,
      contenu: {
        modele: 't2',
        emplacements: {
          titre: { type: 'titre', valeur: 'Un objet, une histoire' },
          image: {
            type: 'image',
            mediaId: medias['poste-radio'] ?? null,
            legende: 'Poste radio présenté en vitrine',
          },
          texte: {
            type: 'texte',
            valeur: texteDemo(
              "Ce modèle place une image à gauche et un texte à droite, avec une galerie en dessous. Il convient à la description détaillée d'un objet.\n\nLe texte accepte trois mises en forme :\n- du **gras** pour un mot important ;\n- de l'_italique_ pour un terme étranger ;\n- des listes à puces comme celle-ci.",
            ),
          },
          galerie: {
            type: 'galerie',
            elements: [
              { mediaId: medias['atelier'] ?? '', legende: "Vue d'atelier" },
              { mediaId: medias['antenne'] ?? '', legende: 'Antenne' },
              { mediaId: medias['archives'] ?? '', legende: 'Archives' },
              { mediaId: medias['detail'] ?? '', legende: 'Détail' },
            ].filter((element) => element.mediaId !== ''),
          },
        },
      },
    },
    {
      titre: 'Les collections du musée',
      modele: 't2',
      publier: true,
      contenu: {
        modele: 't2',
        emplacements: {
          titre: { type: 'titre', valeur: 'Les collections du musée' },
          image: {
            type: 'image',
            mediaId: medias['vitrine'] ?? null,
            legende: 'Vitrine des collections',
          },
          texte: {
            type: 'texte',
            valeur: texteDemo(
              "Les collections rassemblent des objets, des documents et des témoignages. Chaque page de cette borne est créée en quelques minutes depuis l'interface d'administration : on choisit un modèle, on remplit les emplacements, on publie.",
            ),
          },
          galerie: { type: 'galerie', elements: [] },
        },
      },
    },
    {
      titre: 'Les insignes',
      modele: 't1',
      publier: true,
      contenu: {
        modele: 't1',
        emplacements: {
          titre: { type: 'titre', valeur: 'Les insignes' },
          image: {
            type: 'image',
            mediaId: medias['insigne'] ?? null,
            legende: 'Insigne présenté en vitrine',
          },
          texte: {
            type: 'texte',
            valeur: texteDemo(
              "La légende saisie sous une photo est affichée aux visiteurs et sert également de description pour les personnes malvoyantes : un seul champ, deux usages.",
            ),
          },
        },
      },
    },
    {
      titre: 'Film : témoignages',
      modele: 't3',
      publier: false, // volontairement en brouillon : la vidéo manque encore
      contenu: {
        modele: 't3',
        emplacements: {
          titre: { type: 'titre', valeur: 'Film : témoignages' },
          video: { type: 'video', mediaId: null, legende: '' },
          texte: {
            type: 'texte',
            valeur:
              "Déposez une vidéo MP4 dans cette page pour la mettre en ligne : le contrôle « Il manque la vidéo » disparaîtra alors.",
          },
          encartTitre: { type: 'titre', valeur: 'Durée' },
          encartTexte: { type: 'texte', valeur: 'Environ 6 minutes. Sous-titres disponibles.' },
        },
      },
    },
  ]

  for (const modele of pages) {
    const id = nouvelId()
    depotPages.creerPage({
      id,
      modele: modele.modele,
      titre: modele.titre,
      ordre: depotPages.prochainOrdre(),
      contenu: modele.contenu,
      utilisateurId: auteur.id,
    })
    if (modele.publier) mettreEnLigne(id, auteur)
    console.log(`[init] page créée : ${modele.titre}${modele.publier ? ' (en ligne)' : ' (brouillon)'}`)
  }

  console.log(terminer())
}

function terminer(): string {
  return `
  ────────────────────────────────────────────────────────
   Initialisation terminée.

   Comptes :
     s.martin  / ${MOT_DE_PASSE_DEMO}   (éditeur)
     m.petit   / ${MOT_DE_PASSE_DEMO}   (éditeur)
     h.dubois  / ${MOT_DE_PASSE_DEMO}   (administrateur)

   Code PIN du bouton secret de la borne : ${PIN_DEFAUT}

   Lancez maintenant :  npm run dev
  ────────────────────────────────────────────────────────`
}

principal().catch((erreur) => {
  console.error('[init] échec :', erreur)
  process.exit(1)
})
