import assert from 'node:assert/strict'
import { test } from 'node:test'

import { anneeBornee, colonnesPourPhoto, hauteurCellule, hauteurReglable } from './lecture.js'
import { DEFS_BLOCS_LIBRES } from './controles.js'
import { schemaBlocLibre } from './manifeste.js'
import {
  BLOC_LIBRE_GALERIE_MAX,
  COLONNES_GRILLE,
  COLONNES_MIN,
  FRISE_ANNEE_MAX,
  FRISE_ANNEE_MIN,
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

test('tous les autres blocs ont une hauteur réglable', () => {
  const contenu: ContenuPage = { modele: 't1', emplacements: {} }
  assert.equal(hauteurReglable('galerie'), true)
  assert.equal(hauteurCellule(contenu, 'galerie', 'galerie', 400), 400)
  // Depuis le 2026-08-19, un texte aussi : la hauteur y est un plancher, le
  // bloc s'agrandit sans jamais rogner son contenu.
  assert.equal(hauteurReglable('texte'), true)
  assert.equal(hauteurCellule(contenu, 'texte', 'texte', 400), 400)
  // Rien de réglé : aucune hauteur imposée, la page est celle d'avant.
  assert.equal(hauteurCellule(contenu, 'texte', 'texte', undefined), undefined)
})

/*
 * Les deux bornes que l'éditeur doit tenir lui-même.
 *
 * Elles ne protègent pas l'affichage : elles protègent l'**enregistrement**.
 * Un bloc que le schéma refuse fait échouer toute écriture du contenu — pas
 * seulement la sienne — et plus rien ne part sur le disque jusqu'à ce que
 * quelqu'un remarque le « ⚠ Échec » de la barre. Les deux cas ci-dessous se
 * sont produits : une année tapée avec un chiffre de trop, et une galerie
 * remplie de treize photos choisies d'un coup.
 */

test("l'année d'une frise ne peut pas sortir des bornes du schéma", () => {
  assert.equal(anneeBornee('1975'), 1975)
  assert.equal(anneeBornee('-500'), -500)
  // Le cas qui cassait l'enregistrement : un chiffre de trop.
  assert.equal(anneeBornee('20261'), FRISE_ANNEE_MAX)
  assert.equal(anneeBornee('-99999'), FRISE_ANNEE_MIN)
  // Case vidée pendant la saisie : une année, pas « NaN ».
  assert.equal(anneeBornee(''), 0)

  const frise = (annee: number) =>
    schemaBlocLibre.safeParse({
      id: 'b',
      valeur: {
        type: 'frise',
        consigne: '',
        evenements: [{ id: 'e', libelle: 'Un événement', annee, detail: '' }],
      },
    }).success

  for (const saisie of ['20261', '-99999', '1975', '']) {
    assert.ok(frise(anneeBornee(saisie)), `année refusée pour la saisie « ${saisie} »`)
  }
})

test('une galerie pleine reste acceptée par le schéma, une de plus non', () => {
  // Le plafond de l'éditeur et celui du schéma sont le même nombre : c'est ce
  // qui fait que remplir une galerie jusqu'au bout ne casse pas l'écriture.
  const def = DEFS_BLOCS_LIBRES.galerie
  assert.equal(def.type === 'galerie' ? def.max : -1, BLOC_LIBRE_GALERIE_MAX)

  const galerie = (nombre: number) =>
    schemaBlocLibre.safeParse({
      id: 'b',
      valeur: {
        type: 'galerie',
        elements: Array.from({ length: nombre }, (_, i) => ({
          mediaId: `media-${i}`,
          legende: '',
        })),
      },
    }).success

  assert.ok(galerie(BLOC_LIBRE_GALERIE_MAX))
  assert.ok(!galerie(BLOC_LIBRE_GALERIE_MAX + 1))
})
