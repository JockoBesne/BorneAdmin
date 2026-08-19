import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Manifeste, MediaManifeste, PageManifeste } from './manifeste.js'
import { schemaExportPage } from './manifeste.js'
import { fichiersDe, integrerImport, mediasManquants, preparerExport } from './transfert.js'

/*
 * Ce que ce fichier protège : l'aller-retour d'une page d'une machine à l'autre.
 *
 * C'est la seule opération du projet qui écrit dans un contenu **déjà rempli**
 * sans que l'utilisateur voie ce qu'elle touche. Une erreur d'identifiant de
 * média n'y ferait pas planter l'application : elle afficherait tranquillement
 * la mauvaise photo, ou aucune. D'où ces vérifications.
 */

const media = (id: string, empreinte: string, chemin: string): MediaManifeste => ({
  id,
  empreinte,
  type: 'image',
  legende: chemin,
  largeur: 800,
  hauteur: 600,
  dureeSecondes: null,
  posterChemin: null,
  pointFocal: { x: 0.5, y: 0.5 },
  fichiers: [{ profil: 'origine', chemin, octets: 1000 }],
})

const page = (id: string, mediaId: string): PageManifeste => ({
  id,
  titre: `Page ${id}`,
  modele: 't1',
  ordre: 1,
  vignette: mediaId,
  contenu: {
    modele: 't1',
    emplacements: { image: { type: 'image', mediaId, legende: '' } },
    suite: [
      {
        id: 'b1',
        valeur: { type: 'galerie', elements: [{ mediaId, legende: '' }] },
      },
    ],
  },
})

const manifeste = (pages: PageManifeste[], medias: MediaManifeste[]): Manifeste => ({
  version: 1,
  genereLe: '2026-08-12T00:00:00.000Z',
  reglages: {
    titreVeille: 'Musée',
    sousTitreVeille: 'Touchez',
    minutesAvantVeille: 3,
    pinAdmin: '1975',
    couleurFond: '#0e2237',
    couleurTexte: '#f5f7fa',
  },
  pages,
  medias,
})

test("l'export n'emporte que les médias de la page, et reste valide", () => {
  const source = manifeste(
    [page('p1', 'm1')],
    [media('m1', 'aaa', 'onde.jpg'), media('m2', 'bbb', 'inutile.jpg')],
  )

  const exporte = preparerExport(source, 'p1')
  assert.ok(exporte)
  assert.deepEqual(
    exporte.medias.map((m) => m.id),
    ['m1'],
  )
  assert.deepEqual(fichiersDe(exporte.medias), ['onde.jpg'])
  // Le fichier écrit doit repasser le schéma, sans quoi il serait irrécupérable.
  schemaExportPage.parse(exporte)
})

test("l'habillage d'un bloc traverse la clé USB, taille du texte comprise", () => {
  /*
   * L'export passe par un fichier : ce qui n'est pas déclaré dans le schéma Zod
   * est effacé en silence au passage. Un réglage d'apparence perdu ne fait rien
   * planter — la page arrive simplement fade sur l'autre machine, et personne
   * ne comprend pourquoi. D'où ce contrôle, sur le dernier réglage ajouté.
   */
  const modele = page('p1', 'm1')
  const habillee: PageManifeste = {
    ...modele,
    couleurBandeau: '#3a1f10',
    couleurBandeauTexte: '#ffe9c4',
    hauteurBandeau: 140,
    bandeauMasque: true,
    contenu: {
      ...modele.contenu,
      styles: {
        image: {
          taille: 145,
          fond: '#112233',
          opacite: 60,
          alignement: 'centre',
          ancre: 'bas',
          recadre: true,
          focalX: 30,
          focalY: 70,
          remplir: true,
        },
      },
    },
  }

  const exporte = preparerExport(manifeste([habillee], [media('m1', 'aaa', 'onde.jpg')]), 'p1')
  assert.ok(exporte)

  // Écrit puis relu comme sur la clé : c'est ce passage-là qui élague.
  const relu = schemaExportPage.parse(JSON.parse(JSON.stringify(exporte)))
  const fusion = integrerImport(manifeste([], [media('m1', 'aaa', 'onde.jpg')]), relu, {})

  const contenu = fusion.pages[0]!.contenu as {
    styles?: Record<
      string,
      {
        taille?: number
        fond?: string
        opacite?: number
        ancre?: string
        focalX?: number
        focalY?: number
        remplir?: boolean
      }
    >
  }
  assert.equal(contenu.styles?.image?.taille, 145, 'la taille du texte a survécu')
  assert.equal(contenu.styles?.image?.fond, '#112233')
  assert.equal(contenu.styles?.image?.opacite, 60)
  assert.equal(contenu.styles?.image?.ancre, 'bas', "l'ancre basse a survécu")
  // Le cadrage d'une photo : c'est le passage où un champ non déclaré disparaît.
  assert.equal(contenu.styles?.image?.focalX, 30, 'le cadrage de la photo a survécu')
  assert.equal(contenu.styles?.image?.focalY, 70)
  assert.equal(contenu.styles?.image?.remplir, true, 'le fond pleine hauteur a survécu')
  const arrivee = fusion.pages[0]!
  assert.equal(arrivee.couleurBandeau, '#3a1f10', 'le fond du bandeau a survécu')
  assert.equal(arrivee.couleurBandeauTexte, '#ffe9c4')
  assert.equal(arrivee.hauteurBandeau, 140)
  assert.equal(arrivee.bandeauMasque, true)
})

test('un média déjà présent est réutilisé, pas recopié', () => {
  const exporte = preparerExport(manifeste([page('p1', 'm1')], [media('m1', 'aaa', 'onde.jpg')]), 'p1')
  assert.ok(exporte)

  // La borne a le même fichier (même empreinte) sous un autre identifiant.
  const borne = manifeste([], [media('autre-id', 'aaa', 'onde.jpg')])
  assert.deepEqual(mediasManquants(borne, exporte), [])

  const fusion = integrerImport(borne, exporte, {})
  assert.equal(fusion.medias.length, 1, 'aucun média ajouté')

  const arrivee = fusion.pages[0]!
  assert.equal(arrivee.vignette, 'autre-id')
  const contenu = arrivee.contenu as { emplacements: Record<string, { mediaId: string }> }
  assert.equal(contenu.emplacements.image!.mediaId, 'autre-id')
})

test('un identifiant déjà pris par un autre fichier est renuméroté partout', () => {
  const exporte = preparerExport(manifeste([page('p1', 'm1')], [media('m1', 'aaa', 'onde.jpg')]), 'p1')
  assert.ok(exporte)

  // Même identifiant « m1 », mais une tout autre image (empreinte différente).
  const borne = manifeste([], [media('m1', 'zzz', 'autre.jpg')])
  assert.deepEqual(
    mediasManquants(borne, exporte).map((m) => m.id),
    ['m1'],
  )

  const fusion = integrerImport(borne, exporte, { 'onde.jpg': 'onde-2.jpg' })
  const ajoute = fusion.medias.find((m) => m.empreinte === 'aaa')!
  assert.notEqual(ajoute.id, 'm1', "l'identifiant en conflit a été changé")
  assert.equal(ajoute.fichiers[0]!.chemin, 'onde-2.jpg', 'le fichier renommé est suivi')

  // Et la page doit pointer vers le nouvel identifiant, à ses trois endroits.
  const arrivee = fusion.pages[0]!
  const contenu = arrivee.contenu as {
    emplacements: Record<string, { mediaId: string }>
    suite: { valeur: { elements: { mediaId: string }[] } }[]
  }
  assert.equal(arrivee.vignette, ajoute.id)
  assert.equal(contenu.emplacements.image!.mediaId, ajoute.id)
  assert.equal(contenu.suite[0]!.valeur.elements[0]!.mediaId, ajoute.id)

  // L'image que la borne avait déjà n'a pas bougé.
  assert.ok(fusion.medias.some((m) => m.id === 'm1' && m.empreinte === 'zzz'))
})

test('une page de même identifiant est remplacée sans changer de place', () => {
  const exporte = preparerExport(manifeste([page('p1', 'm1')], [media('m1', 'aaa', 'onde.jpg')]), 'p1')
  assert.ok(exporte)
  exporte.page = { ...exporte.page, titre: 'Titre retouché' }

  const ancienne: PageManifeste = { ...page('p1', 'm1'), titre: 'Ancien titre', ordre: 2 }
  const borne = manifeste(
    [{ ...page('p0', 'm1'), ordre: 1 }, ancienne],
    [media('m1', 'aaa', 'onde.jpg')],
  )

  const fusion = integrerImport(borne, exporte, {})
  assert.equal(fusion.pages.length, 2, 'remplacée, pas ajoutée')
  assert.equal(fusion.pages[1]!.titre, 'Titre retouché')
  assert.equal(fusion.pages[1]!.ordre, 2, "la place dans l'accueil appartient à la borne")
})

test('les couleurs sont figées seulement si les deux bornes diffèrent', () => {
  const source = manifeste([page('p1', 'm1')], [media('m1', 'aaa', 'onde.jpg')])
  const exporte = preparerExport(source, 'p1')!

  // Même thème des deux côtés : la page continue de suivre celui de la borne.
  const jumelle = integrerImport(manifeste([], []), exporte, {})
  assert.equal(jumelle.pages[0]!.couleurFond, undefined)

  // Thème différent : sans cela, la page changerait d'aspect en arrivant.
  const autre = manifeste([], [])
  autre.reglages = { ...autre.reglages, couleurFond: '#ffffff' }
  const figee = integrerImport(autre, exporte, {})
  assert.equal(figee.pages[0]!.couleurFond, '#0e2237')
})
