import { definirModele, type Modele } from './definir-modele.js'
import type { IdModele } from '../types.js'

/**
 * Modèle 0 — « Page vierge »
 *
 * Aucun emplacement, aucune section : la page part vide et se construit
 * entièrement avec les blocs ajoutés (texte, image, galerie, vidéo, quiz,
 * frise). C'est le modèle de celui qui sait déjà ce qu'il veut mettre et ne
 * veut pas commencer par retirer ce qui ne lui sert pas.
 */
export const modele0 = definirModele({
  id: 't0',
  nom: 'Page vierge',
  description: 'Page vide : on y ajoute soi-même les blocs, dans l’ordre voulu.',
  sections: [],
  emplacements: {},
})

/**
 * Modèle 1 — « Une image, un texte »
 * Grand titre, image principale, zone de texte.
 */
export const modele1 = definirModele({
  id: 't1',
  nom: 'Une image, un texte',
  description: 'Idéal pour présenter un objet ou introduire un thème.',
  sections: [
    { nom: 'titre', emplacements: ['titre'] },
    { nom: 'image', emplacements: ['image'] },
    { nom: 'texte', emplacements: ['texte'] },
  ],
  emplacements: {
    titre: {
      type: 'titre',
      libelle: 'Titre',
      requis: true,
      maxSignes: 70,
      conseil: 'Un titre court se lit mieux de loin.',
    },
    image: {
      type: 'image',
      libelle: 'Image principale',
      requis: true,
      largeurMin: 1280,
      conseil: "L'image occupe toute la largeur de l'écran.",
    },
    texte: {
      type: 'texte',
      libelle: 'Texte',
      requis: true,
      maxSignes: 900,
      conseil: 'Trois à cinq phrases suffisent devant une borne.',
    },
  },
})

/**
 * Modèle 2 — « Image et texte côte à côte »
 * Image à gauche, texte à droite, galerie en dessous.
 */
export const modele2 = definirModele({
  id: 't2',
  nom: 'Image et texte côte à côte',
  description: 'Idéal pour décrire un objet en détail avec des photos complémentaires.',
  sections: [
    { nom: 'titre', emplacements: ['titre'] },
    // L'image et le texte forment une paire indissociable : on peut insérer
    // un bloc avant ou après les colonnes, jamais entre les deux.
    { nom: 'colonnes', emplacements: ['image', 'texte'] },
    { nom: 'galerie', emplacements: ['galerie'] },
  ],
  emplacements: {
    titre: {
      type: 'titre',
      libelle: 'Titre',
      requis: true,
      maxSignes: 70,
    },
    image: {
      type: 'image',
      libelle: 'Image de gauche',
      // 5 colonnes sur 12 : reprend la proportion de l'ancienne colonne fixe
      // de 760 px, mais devient réglable à la poignée.
      colonnes: 5,
      requis: true,
      largeurMin: 1024,
    },
    texte: {
      type: 'texte',
      libelle: 'Texte de droite',
      colonnes: 7,
      requis: true,
      maxSignes: 1400,
      conseil: 'Vous pouvez utiliser du gras, de l’italique et des listes.',
    },
    galerie: {
      type: 'galerie',
      libelle: 'Galerie',
      requis: false,
      min: 3,
      max: 8,
      conseil: 'Une galerie est plus lisible à partir de 3 photos.',
    },
  },
})

/**
 * Modèle 3 — « Vidéo en avant »
 * Vidéo plein écran, texte superposé, encart d'information facultatif.
 */
export const modele3 = definirModele({
  id: 't3',
  nom: 'Vidéo en avant',
  description: 'Idéal pour un film ou un témoignage.',
  sections: [
    // Une seule section : l'écran vidéo est une composition indivisible, les
    // blocs ajoutés viennent forcément dessous.
    { nom: 'ecran', emplacements: ['video', 'titre', 'texte', 'encartTitre', 'encartTexte'] },
  ],
  emplacements: {
    titre: {
      type: 'titre',
      libelle: 'Titre',
      requis: true,
      maxSignes: 60,
    },
    video: {
      type: 'video',
      libelle: 'Vidéo',
      requis: true,
      dureeMaxSecondes: 1800,
      conseil: 'Format MP4, 1080p. La vidéo ne démarre jamais toute seule.',
    },
    texte: {
      type: 'texte',
      libelle: 'Texte superposé',
      requis: true,
      maxSignes: 400,
      conseil: 'Ce texte se superpose à la vidéo : restez très bref.',
    },
    encartTitre: {
      type: 'titre',
      libelle: "Titre de l'encart",
      requis: false,
      maxSignes: 60,
    },
    encartTexte: {
      type: 'texte',
      libelle: "Texte de l'encart",
      requis: false,
      maxSignes: 200,
      conseil: "L'encart sert à donner une information pratique.",
    },
  },
})

export const MODELES: Record<IdModele, Modele> = {
  t0: modele0,
  t1: modele1,
  t2: modele2,
  t3: modele3,
}

// La page vierge en dernier : les trois mises en page guidées d'abord, elles
// conviennent à la plupart des pages ; la page vide est l'autre solution.
export const LISTE_MODELES: Modele[] = [modele1, modele2, modele3, modele0]

export function modelePar(id: string): Modele | null {
  return id in MODELES ? MODELES[id as IdModele] : null
}

export { definirModele }
export type { Modele }
