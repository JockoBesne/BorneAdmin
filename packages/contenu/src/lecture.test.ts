import assert from 'node:assert/strict'
import { test } from 'node:test'

import { colonnesPourPhoto, hauteurCellule, hauteurReglable } from './lecture.js'
import {
  COLONNES_GRILLE,
  COLONNES_MIN,
  HAUTEUR_PHOTO_VISEE,
  largeurEnPixels,
  type ContenuPage,
} from './types.js'

/*
 * Deux règles qui décident de l'allure d'une photo sur la borne, et qu'on ne peut
 * pas vérifier à l'œil sans y passer la journée :
 *
 * 1. le bloc d'une photo se rétrécit assez pour que la photo ne fasse pas deux
 *    écrans de haut — sans jamais devenir illisible ;
 * 2. une photo n'a de hauteur imposée (donc n'est recadrée) que si on l'a
 *    expressément demandé. C'est ce point-là qui a coûté le plus cher : des photos
 *    apparaissaient coupées sans que personne ne l'ait décidé.
 */

/** Hauteur qu'occuperait la photo dans un bloc de `colonnes` colonnes. */
const hauteurRendue = (colonnes: number, largeur: number, hauteur: number): number =>
  largeurEnPixels(colonnes) * (hauteur / largeur)

test('le bloc d’une photo se rétrécit jusqu’à une hauteur raisonnable', () => {
  // Une photo en hauteur en pleine largeur ferait 2 300 px de haut : inutilisable.
  const colonnes = colonnesPourPhoto(3000, 4000, COLONNES_GRILLE)
  assert.ok(colonnes < COLONNES_GRILLE, 'la largeur doit avoir été réduite')
  assert.ok(colonnes >= COLONNES_MIN, 'jamais en dessous du minimum lisible')
  assert.ok(
    hauteurRendue(colonnes, 3000, 4000) <= HAUTEUR_PHOTO_VISEE,
    'la photo doit tenir dans la hauteur visée',
  )
})

test('une photo large garde toute la place qu’on lui donne', () => {
  // Un panorama tient déjà en hauteur : rien à réduire, il reste pleine largeur.
  assert.equal(colonnesPourPhoto(4000, 1000, COLONNES_GRILLE), COLONNES_GRILLE)
})

test('on ne rétrécit jamais un bloc déjà étroit, ni sans savoir', () => {
  // Le bloc n'est jamais élargi : sa largeur a pu être choisie exprès.
  assert.equal(colonnesPourPhoto(4000, 1000, 4), 4)
  // Dimensions inconnues (média sans mesures) : on ne touche à rien.
  assert.equal(colonnesPourPhoto(null, null, 9), 9)
  // Même une photo démesurée ne descend pas sous le minimum lisible.
  assert.equal(colonnesPourPhoto(100, 4000, COLONNES_GRILLE), COLONNES_MIN)
})

test('une photo n’est recadrée que si on l’a demandé', () => {
  // Hauteur enregistrée du temps où elle servait de plafond : elle ne doit pas
  // se mettre à couper la photo.
  const sansRecadrage: ContenuPage = {
    modele: 't1',
    emplacements: {},
    hauteurs: { image: 300 },
  }
  assert.equal(hauteurCellule(sansRecadrage, 'image', 'image', 300), undefined)
  assert.equal(hauteurReglable('image'), false)

  const avecRecadrage: ContenuPage = {
    ...sansRecadrage,
    styles: { image: { recadre: true } },
  }
  assert.equal(hauteurCellule(avecRecadrage, 'image', 'image', 300), 300)
  assert.equal(hauteurReglable('image', true), true)
  // Recadrage demandé mais aucune hauteur enregistrée : un cadre quand même.
  assert.equal(
    hauteurCellule(avecRecadrage, 'image', 'image', undefined),
    HAUTEUR_PHOTO_VISEE,
  )
})

test('une galerie garde sa hauteur réglable, elle', () => {
  const contenu: ContenuPage = { modele: 't1', emplacements: {} }
  assert.equal(hauteurReglable('galerie'), true)
  assert.equal(hauteurCellule(contenu, 'galerie', 'galerie', 400), 400)
  // La hauteur d'un texte, elle, ne se règle pas : elle découle de son contenu.
  assert.equal(hauteurCellule(contenu, 'texte', 'texte', 400), undefined)
})
