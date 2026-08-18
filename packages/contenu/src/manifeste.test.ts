import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { schemaManifeste } from './manifeste.js'

/*
 * Le piège le plus coûteux de ce projet : **un champ non déclaré dans le schéma
 * Zod est effacé en silence à l'enregistrement.** Déjà rencontré plusieurs fois
 * (la suite des blocs, les largeurs, l'habillage). Rien ne plante, rien ne
 * s'affiche en rouge — le travail disparaît simplement au prochain
 * enregistrement automatique, six cents millisecondes après la dernière frappe.
 *
 * D'où ce contenu de démonstration, qui utilise **tous** les champs facultatifs
 * du modèle. Ajouter un champ à `types.ts` sans le déclarer dans `manifeste.ts`
 * fait échouer ce test au lieu de coûter une soirée au musée.
 */
const complet = {
  version: 1,
  genereLe: '2026-08-12T09:00:00.000Z',
  reglages: {
    titreVeille: 'Musée des Transmissions',
    sousTitreVeille: "Touchez l'écran",
    minutesAvantVeille: 3,
    couleurFond: '#0e2237',
    couleurTexte: '#f5f7fa',
    hubCouleurFond: '#123456',
    hubCouleurTexte: '#ffffff',
    hubImage: 'media-fond',
    pinAdmin: '1975',
  },
  pages: [
    {
      id: 'page-1',
      titre: 'Les ondes',
      modele: 't1',
      ordre: 1,
      vignette: 'media-1',
      couleurFond: '#001122',
      couleurTexte: '#eeeeee',
      contenu: {
        modele: 't1',
        largeurs: { titre: 12, image: 6 },
        decalages: { image: 3 },
        hauteurs: { image: 480 },
        ordre: ['titre', 'suite:b1', 'image'],
        styles: {
          titre: {
            fond: '#ff0000',
            couleur: '#ffffff',
            opacite: 60,
            gras: true,
            italique: true,
            souligne: true,
            alignement: 'centre',
            taille: 130,
          },
          image: { recadre: true },
        },
        emplacements: {
          titre: { type: 'titre', valeur: 'Les ondes' },
          image: { type: 'image', mediaId: 'media-1', legende: 'Une antenne' },
        },
        suite: [
          {
            id: 'b1',
            apres: 'corps',
            largeur: 'moitie',
            colonnes: 6,
            decalage: 3,
            hauteur: 320,
            valeur: {
              type: 'texte',
              valeur: 'Un texte en gras',
              lignes: [{ puce: true, morceaux: [{ texte: 'Un texte en gras', gras: true }] }],
            },
          },
          {
            id: 'b2',
            valeur: {
              type: 'galerie',
              elements: [{ mediaId: 'media-1', legende: 'Vue de face' }],
            },
          },
          {
            id: 'b3',
            valeur: { type: 'video', mediaId: 'media-2', legende: 'Démonstration' },
          },
          {
            id: 'b4',
            valeur: {
              type: 'quiz',
              question: 'En quelle année ?',
              reponses: [
                { id: 'r1', texte: '1975', correcte: true, explication: 'Bonne réponse.' },
                { id: 'r2', texte: '1980', correcte: false, explication: 'Un peu tard.' },
              ],
            },
          },
          {
            id: 'b5',
            valeur: {
              type: 'frise',
              consigne: 'Replacez les événements',
              evenements: [
                { id: 'e1', libelle: 'Premier poste', annee: 1900, detail: 'À Rennes.' },
                { id: 'e2', libelle: 'Second poste', annee: 1950, detail: '' },
              ],
            },
          },
        ],
      },
    },
  ],
  medias: [
    {
      id: 'media-1',
      empreinte: 'abc123',
      type: 'image',
      legende: 'Une antenne',
      largeur: 1920,
      hauteur: 1080,
      dureeSecondes: null,
      posterChemin: null,
      pointFocal: { x: 0.5, y: 0.5 },
      fichiers: [{ profil: 'origine', chemin: 'antenne.jpg', octets: 120000 }],
    },
    {
      id: 'media-2',
      empreinte: 'def456',
      type: 'video',
      legende: 'Démonstration',
      largeur: 1280,
      hauteur: 720,
      dureeSecondes: 42,
      posterChemin: 'couverture-demo.jpg',
      pointFocal: { x: 0.5, y: 0.5 },
      fichiers: [{ profil: 'origine', chemin: 'demo.mp4', octets: 8000000 }],
    },
  ],
}

test('aucun champ facultatif ne disparaît à l’aller-retour', () => {
  assert.deepEqual(schemaManifeste.parse(complet), complet)
})

test('un deuxième passage ne change plus rien', () => {
  // C'est le vrai scénario : le contenu est relu au démarrage, réécrit à chaque
  // modification, relu au démarrage suivant. Un champ qui ne survit pas deux
  // tours ne survit pas une journée d'utilisation.
  const premier = schemaManifeste.parse(complet)
  assert.deepEqual(schemaManifeste.parse(premier), premier)
})

test('les réglages absents reçoivent leurs valeurs par défaut', () => {
  // Un contenu écrit avant l'introduction des couleurs doit rester lisible.
  const ancien = {
    ...complet,
    reglages: {
      titreVeille: 'Musée',
      sousTitreVeille: 'Touchez',
      minutesAvantVeille: 3,
    },
  }
  const relu = schemaManifeste.parse(ancien)
  assert.equal(relu.reglages.couleurFond, '#0e2237')
  assert.equal(relu.reglages.pinAdmin, '1975')
})

test('une couleur qui n’en est pas une est refusée', () => {
  const abime = structuredClone(complet)
  abime.reglages.couleurFond = 'bleu'
  assert.throws(() => schemaManifeste.parse(abime))
})

test('le contenu d’exemple du dépôt est valide', () => {
  // Il sert de jeu de test à la main et de contenu de départ sur une
  // installation neuve : s'il ne passe plus, l'application s'ouvre sur un écran
  // d'erreur.
  const chemin = fileURLToPath(new URL('../../../contenu-exemple/contenu.json', import.meta.url))
  schemaManifeste.parse(JSON.parse(readFileSync(chemin, 'utf8')))
})
