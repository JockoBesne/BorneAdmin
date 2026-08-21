# -*- coding: utf-8 -*-
"""
Fabrique « 2 - Administrer le contenu.pdf ».

Le PDF ne se modifie pas à la main : on modifie CE fichier, puis on relance

    python documentation/generer-guide-2.py

depuis la racine du dépôt (une seule installation préalable : pip install reportlab).

Mis à jour le 2026-08-20 : bandeau réglable par page, habillage des blocs
(taille du texte, couleur, fond, transparence, remplissage), recadrage et
cadrage des photos, panneau « Écran d'accueil », panneau « Réglages » (code
d'accès modifiable, fermeture de l'application), modèle « Page vierge »,
clavier à l'écran, Ctrl + M.
"""

import os

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# --------------------------------------------------------------------------
# Palette — celle de la borne elle-même.
# --------------------------------------------------------------------------
NUIT = HexColor('#0e2237')       # fond de la borne
ENCRE = HexColor('#1d2733')      # texte courant
BLEU = HexColor('#26445f')
BLEU_SOMBRE = HexColor('#1b3550')
OR = HexColor('#c9a227')
CREME = HexColor('#f6efd8')
GRIS = HexColor('#5a6675')
GRIS_CLAIR = HexColor('#8fa3b8')
LIGNE = HexColor('#d7dde4')
RANG = HexColor('#eef1f4')
BLANC = HexColor('#ffffff')
VERT = HexColor('#7fd18a')
ROUGE = HexColor('#a4303f')
ROSE = HexColor('#fbeef0')

LARGEUR, HAUTEUR = A4
MARGE = 20 * mm
UTILE = LARGEUR - 2 * MARGE

# --------------------------------------------------------------------------
# Polices : celles de Windows, comme le guide d'origine.
# --------------------------------------------------------------------------
FICHIERS_POLICES = {
    'Calibri': 'calibri.ttf',
    'Calibri-Bold': 'calibrib.ttf',
    'Calibri-Italic': 'calibrii.ttf',
    'Consolas': 'consola.ttf',
    'Symbole': 'seguisym.ttf',
}
DOSSIER_POLICES = os.path.join(os.environ.get('WINDIR', r'C:\Windows'), 'Fonts')
DISPONIBLES = {}
for nom, fichier in FICHIERS_POLICES.items():
    chemin = os.path.join(DOSSIER_POLICES, fichier)
    if os.path.exists(chemin):
        pdfmetrics.registerFont(TTFont(nom, chemin))
        DISPONIBLES[nom] = True

REG = 'Calibri' if DISPONIBLES.get('Calibri') else 'Helvetica'
GRAS = 'Calibri-Bold' if DISPONIBLES.get('Calibri-Bold') else 'Helvetica-Bold'
ITAL = 'Calibri-Italic' if DISPONIBLES.get('Calibri-Italic') else 'Helvetica-Oblique'
MONO = 'Consolas' if DISPONIBLES.get('Consolas') else 'Courier'
SYM = 'Symbole' if DISPONIBLES.get('Symbole') else REG


def s(texte):
    """Passe une suite de symboles (flèches, croix…) dans la police qui les a."""
    return '<font name="%s">%s</font>' % (SYM, texte)


def mono(texte):
    return '<font name="%s">%s</font>' % (MONO, texte)


# --------------------------------------------------------------------------
# Styles de texte
# --------------------------------------------------------------------------
corps = ParagraphStyle('corps', fontName=REG, fontSize=10.8, leading=16.5,
                       textColor=ENCRE, spaceAfter=0)
corps_espace = ParagraphStyle('corps_espace', parent=corps, spaceAfter=9)
petit = ParagraphStyle('petit', parent=corps, fontSize=9.6, leading=13.5)
aide = ParagraphStyle('aide', parent=corps, fontSize=10.2, leading=15.5)
aide_titre = ParagraphStyle('aide_titre', parent=aide, fontName=GRAS, textColor=NUIT)
sous_titre = ParagraphStyle('sous_titre', fontName=GRAS, fontSize=12.5, leading=16,
                            textColor=NUIT, spaceBefore=14, spaceAfter=7,
                            keepWithNext=1)
legende_fig = ParagraphStyle('legende_fig', fontName=ITAL, fontSize=8.5, leading=11,
                             textColor=GRIS, alignment=TA_CENTER, spaceBefore=4,
                             spaceAfter=10)
entete_tab = ParagraphStyle('entete_tab', fontName=GRAS, fontSize=9.6, leading=13,
                            textColor=BLANC)
cell = ParagraphStyle('cell', fontName=REG, fontSize=9.6, leading=13.5, textColor=ENCRE)
cell_gras = ParagraphStyle('cell_gras', parent=cell, fontName=GRAS, textColor=NUIT)
num_style = ParagraphStyle('num', fontName=GRAS, fontSize=15, leading=18,
                           textColor=BLANC, alignment=TA_CENTER)
titre_sec = ParagraphStyle('titre_sec', fontName=GRAS, fontSize=16, leading=20,
                           textColor=NUIT)
badge_style = ParagraphStyle('badge', fontName=GRAS, fontSize=9.5, leading=13,
                             textColor=OR, alignment=TA_CENTER)


# --------------------------------------------------------------------------
# Briques de mise en page
# --------------------------------------------------------------------------
def titre(numero, texte):
    """Carré sombre numéroté + titre de section."""
    cote = 11 * mm
    t = Table([[Paragraph(str(numero), num_style), Paragraph(texte, titre_sec)]],
              colWidths=[cote, UTILE - cote], rowHeights=[cote])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), NUIT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (0, 0), (0, 0), 0),
        ('LEFTPADDING', (1, 0), (1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    t.spaceBefore = 4
    t.spaceAfter = 10
    t.keepWithNext = True  # jamais un titre de section seul en bas de page
    return t


def encart(titre_encart, *lignes):
    """Boîte crème à barre d'or : ce qu'il ne faut pas rater."""
    interieur = [Paragraph(titre_encart, aide_titre)]
    for ligne in lignes:
        interieur.append(Spacer(1, 3))
        interieur.append(Paragraph(ligne, aide))
    t = Table([[interieur]], colWidths=[UTILE])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CREME),
        ('LINEBEFORE', (0, 0), (0, -1), 3.5, OR),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    t.spaceBefore = 8
    t.spaceAfter = 12
    return t


def tableau(entetes, lignes, largeurs=None):
    """Tableau à en-tête sombre et rangées alternées."""
    if largeurs is None:
        largeurs = [UTILE * 0.34, UTILE * 0.66]
    donnees = [[Paragraph(e, entete_tab) for e in entetes]]
    for ligne in lignes:
        donnees.append([Paragraph(ligne[0], cell_gras)] +
                       [Paragraph(c, cell) for c in ligne[1:]])
    t = Table(donnees, colWidths=largeurs, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), NUIT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(donnees)):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), RANG))
    t.setStyle(TableStyle(style))
    t.spaceBefore = 4
    t.spaceAfter = 12
    return t


def reperes(*elements):
    """Légende numérotée d'une figure : petit numéro d'or, puis le texte."""
    donnees = [[Paragraph(str(i), badge_style), Paragraph(texte, petit)]
               for i, texte in enumerate(elements, start=1)]
    t = Table(donnees, colWidths=[16, UTILE - 16])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    t.spaceAfter = 10
    return t


def puces(*elements):
    donnees = [[Paragraph('•', cell_gras), Paragraph(texte, corps)] for texte in elements]
    t = Table(donnees, colWidths=[12, UTILE - 12])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    t.spaceAfter = 10
    return t


# --------------------------------------------------------------------------
# Figures — dessinées, jamais des captures : elles restent lisibles à
# l'impression en noir et blanc et ne périment pas au premier pixel changé.
# --------------------------------------------------------------------------
class Figure(Flowable):
    hauteur = 150

    def __init__(self):
        Flowable.__init__(self)
        self.width = UTILE
        self.height = self.hauteur

    def wrap(self, *_):
        return self.width, self.height

    def draw(self):
        self.dessiner(self.canv)

    # ---- outils de dessin ------------------------------------------------
    def boite(self, c, x, y, w, h, fond=None, trait=None, rayon=4, epaisseur=0.8):
        if fond:
            c.setFillColor(fond)
        if trait:
            c.setStrokeColor(trait)
            c.setLineWidth(epaisseur)
        c.roundRect(x, y, w, h, rayon, stroke=1 if trait else 0, fill=1 if fond else 0)

    def mot(self, c, x, y, texte, taille=8, couleur=ENCRE, police=None, centre=None):
        c.setFont(police or REG, taille)
        c.setFillColor(couleur)
        if centre:
            c.drawCentredString(x + centre / 2.0, y, texte)
        else:
            c.drawString(x, y, texte)

    def bouton(self, c, x, y, w, h, texte, fond=BLANC, encre=BLEU, bord=LIGNE, taille=7):
        self.boite(c, x, y, w, h, fond, bord, rayon=3)
        self.mot(c, x, y + h / 2.0 - taille * 0.36, texte, taille, encre, centre=w)

    def pastille(self, c, x, y, numero, rayon=6.5):
        c.setFillColor(OR)
        c.circle(x, y, rayon, stroke=0, fill=1)
        c.setFillColor(BLANC)
        c.setFont(GRAS, 8)
        c.drawCentredString(x, y - 2.8, str(numero))


class FigAcces(Figure):
    """L'appui de 5 secondes dans le coin, puis le pavé du code."""
    hauteur = 158

    def dessiner(self, c):
        # L'écran de la borne
        self.boite(c, 4, 8, 250, 134, NUIT, GRIS_CLAIR)
        self.mot(c, 14, 112, 'Musée des Transmissions', 11, BLANC, GRAS)
        for i in range(3):
            self.boite(c, 18 + i * 76.9, 26, 60.9, 68, BLEU_SOMBRE, None)
        # Le coin caché
        c.setStrokeColor(OR)
        c.setLineWidth(1.4)
        c.setDash(3, 3)
        c.rect(210.6, 98, 38, 38, stroke=1, fill=0)
        c.setDash()
        c.setFillColor(OR)
        c.circle(229.6, 117, 6.5, stroke=0, fill=1)
        self.mot(c, 213.6, 84, '5 secondes', 7, OR, GRAS)
        self.pastille(c, 237, 148, 1)

        # Le pavé de code
        gx = 290
        self.boite(c, gx, 8, 188, 134, BLANC, LIGNE)
        self.mot(c, gx, 120, "Code d'accès", 11, NUIT, GRAS, centre=188)
        for rang in range(3):
            for col in range(3):
                x = gx + 34 + col * 42
                y = 84 - rang * 32
                self.boite(c, x, y, 34, 26, RANG, LIGNE, rayon=3)
                self.mot(c, x, y + 8, str(rang * 3 + col + 1), 10, NUIT, GRAS, centre=34)
        self.boite(c, gx + 34, 14, 118, 14, NUIT, None, rayon=3)
        self.mot(c, gx + 34, 18.5, '• • • •', 8, OR, GRAS, centre=118)
        self.pastille(c, gx + 182, 148, 2)


class FigPages(Figure):
    """L'écran des pages, avec ses commandes."""
    hauteur = 200

    def dessiner(self, c):
        L = UTILE
        # barre du haut
        self.boite(c, 0, 170, L, 26, NUIT, None, rayon=3)
        self.mot(c, 12, 179, 'Administration', 10, BLANC, GRAS)
        self.mot(c, 150, 179.5, '✔ Enregistré', 7.5, VERT, SYM)
        self.bouton(c, 232, 175, 48, 15, '↶ Annuler', BLEU_SOMBRE, BLANC, BLEU, 7)
        self.bouton(c, 286, 175, 50, 15, '↷ Rétablir', BLEU_SOMBRE, BLANC, BLEU, 7)
        self.bouton(c, 342, 175, 44, 15, 'Fermer', BLEU_SOMBRE, BLANC, BLEU, 7)
        self.pastille(c, 222, 183, 6)

        # les cinq boutons d'en-tête
        boutons = (('Importer une page', 70), ("Écran d'accueil", 62),
                   ('Apparence', 48), ('Réglages', 44), ('+ Nouvelle page', 64))
        x = 0
        for i, (t, w) in enumerate(boutons):
            principal = t.startswith('+')
            self.bouton(c, x, 126, w, 17, t,
                        NUIT if principal else BLANC,
                        BLANC if principal else BLEU, LIGNE, 7)
            self.pastille(c, x + w / 2.0, 152, i + 1)
            x += w + 6

        # les rangées de pages
        titres = ('Trois mille ans pour se parler', "Avant l'électricité",
                  'Le télégraphe de Chappe')
        for i, nom in enumerate(titres):
            y = 84 - i * 30
            self.boite(c, 0, y, L, 26, BLANC if i % 2 == 0 else RANG, LIGNE, rayon=3)
            self.mot(c, 8, y + 9, '⠿', 9, GRIS_CLAIR, SYM)
            self.mot(c, 22, y + 9.5, str(i + 1), 8, OR, GRAS)
            self.mot(c, 34, y + 9.5, nom, 8.5, ENCRE, GRAS)
            self.mot(c, 196, y + 9.5, 'Une image, un texte', 7.5, GRIS)
            bx = 280
            for t, w, danger in (('Modifier', 44, False), ('Dupliquer', 46, False),
                                 ('Exporter', 44, False), ('Supprimer', 46, True)):
                self.bouton(c, bx, y + 5, w, 16, t, ROSE if danger else BLANC,
                            ROUGE if danger else BLEU, LIGNE, 7)
                bx += w + 5
        self.pastille(c, 6, 116, 7)
        self.pastille(c, 304, 116, 8)


class FigEditeur(Figure):
    """L'éditeur d'une page : l'aperçu et la liste des blocs."""
    hauteur = 212

    def dessiner(self, c):
        L = UTILE
        self.boite(c, 0, 186, L, 22, NUIT, None, rayon=3)
        self.mot(c, 10, 193, '← Pages', 8, BLANC, GRAS)
        self.mot(c, 62, 193, 'Trois mille ans pour se parler', 8, GRIS_CLAIR)
        self.mot(c, 400, 193.5, '✔ Enregistré', 7.5, VERT, SYM)
        self.pastille(c, 462, 197, 4)

        # aperçu (gauche)
        self.boite(c, 0, 4, 246, 174, NUIT, LIGNE)
        self.mot(c, 12, 156, 'Trois mille ans pour se parler', 9, BLANC, GRAS)
        self.boite(c, 12, 56, 222, 90, BLEU_SOMBRE, None)
        self.mot(c, 12, 98, 'photo', 8, GRIS_CLAIR, centre=222)
        # poignées : bord droit (largeur), bords haut et bas (hauteur)
        c.setFillColor(OR)
        c.roundRect(230, 86, 5, 30, 2.5, stroke=0, fill=1)
        c.roundRect(108, 52, 30, 5, 2.5, stroke=0, fill=1)
        c.roundRect(108, 145, 30, 5, 2.5, stroke=0, fill=1)
        self.mot(c, 12, 34, 'poignées : largeur (à droite), hauteur (en haut, en bas)',
                 6.5, OR, ITAL)
        self.mot(c, 12, 18, 'Texte de la page…', 8, GRIS_CLAIR)
        self.pastille(c, 10, 170, 1)

        # panneau des blocs (droite)
        px = 258
        pw = L - px
        self.boite(c, px, 4, pw, 174, BLANC, LIGNE)
        self.mot(c, px + 10, 164, 'Blocs de la page', 8.5, NUIT, GRAS)
        for i, nom in enumerate(('Titre', 'Image principale', 'Texte', 'Quiz')):
            y = 136 - i * 26
            self.boite(c, px + 8, y, pw - 16, 22, CREME if i == 0 else RANG, LIGNE, rayon=3)
            self.mot(c, px + 14, y + 7.5, '⠿', 8, GRIS_CLAIR, SYM)
            self.mot(c, px + 26, y + 7.5, nom, 7.5, ENCRE, GRAS)
            bx = px + pw - 104
            for signe in ('▲', '▼', '◧', '↔', '✕'):
                self.boite(c, bx, y + 4, 15, 14, BLANC, LIGNE, rayon=2)
                self.mot(c, bx, y + 8, signe, 6.5,
                         ROUGE if signe == '✕' else BLEU, SYM, centre=15)
                bx += 17
        self.bouton(c, px + 8, 16, pw - 16, 18, '+ Ajouter un bloc', NUIT, BLANC, NUIT, 7.5)
        self.pastille(c, px + 2, 150, 2)
        self.pastille(c, px + pw - 10, 147, 3)
        self.pastille(c, px + 2, 25, 5)


class FigExport(Figure):
    """Le choix de la destination, et le dossier obtenu."""
    hauteur = 150

    def dessiner(self, c):
        self.boite(c, 0, 8, 236, 134, BLANC, LIGNE)
        self.mot(c, 12, 124, 'Où déposer la page ? (clé USB, dossier…)', 8, NUIT, GRAS)
        for i, nom in enumerate(('Ce PC', '     Bureau', '     Documents', '     Clé USB (E:)')):
            self.mot(c, 14, 104 - i * 16, nom, 8,
                     NUIT if i == 3 else GRIS, GRAS if i == 3 else REG)
        self.bouton(c, 140, 18, 84, 18, 'Exporter ici', NUIT, BLANC, NUIT, 7.5)
        self.pastille(c, 6, 14, 1)

        gx = 268
        self.boite(c, gx, 8, UTILE - gx, 134, RANG, LIGNE)
        self.mot(c, gx + 12, 124, 'Sur la clé USB', 8, GRIS, GRAS)
        self.boite(c, gx + 12, 30, UTILE - gx - 24, 84, BLANC, LIGNE, rayon=3)
        self.mot(c, gx + 22, 98, 'Trois mille ans.bornepage', 8.5, NUIT, GRAS)
        self.mot(c, gx + 38, 80, 'page.json', 8, ENCRE, MONO)
        self.mot(c, gx + 38, 62, 'medias', 8, ENCRE, MONO)
        self.mot(c, gx + 56, 46, 'tambours-garde.jpg', 8, GRIS)
        self.mot(c, gx + 56, 34, '…', 8, GRIS)
        self.pastille(c, gx + 4, 118, 2)


class FigImport(Figure):
    """Le message de confirmation après un import."""
    hauteur = 124

    def dessiner(self, c):
        L = UTILE
        self.boite(c, 0, 98, L, 24, NUIT, None, rayon=3)
        self.mot(c, 12, 106, 'Administration', 9, BLANC, GRAS)
        self.mot(c, 300, 106.5, '✔ Enregistré', 7.5, VERT, SYM)
        self.bouton(c, 424, 102, 48, 16, 'Fermer', BLEU_SOMBRE, BLANC, BLEU, 7)

        self.bouton(c, 0, 70, 88, 18, 'Importer une page', BLANC, BLEU, LIGNE, 7.5)
        self.pastille(c, 96, 79, 1)

        self.boite(c, 0, 38, L, 24, CREME, OR, rayon=3)
        self.mot(c, 10, 46, '« Trois mille ans pour se parler » a remplacé la page du même nom.',
                 8, NUIT, GRAS)
        self.pastille(c, L - 10, 50, 2)

        for i, nom in enumerate(('Trois mille ans pour se parler', "Avant l'électricité")):
            y = 18 - i * 14
            self.mot(c, 10, y, str(i + 1), 8, OR, GRAS)
            self.mot(c, 22, y, nom, 8, ENCRE, GRAS if i == 0 else REG)


def figure(classe, legende):
    return KeepTogether([classe(), Paragraph(legende, legende_fig)])


# --------------------------------------------------------------------------
# Habillage des pages
# --------------------------------------------------------------------------
def pied(canevas, doc):
    canevas.saveState()
    canevas.setStrokeColor(LIGNE)
    canevas.setLineWidth(0.6)
    canevas.line(MARGE, 36.85, LARGEUR - MARGE, 36.85)
    canevas.setFont(REG, 7.8)
    canevas.setFillColor(GRIS)
    canevas.drawString(MARGE, 25.5, 'Administrer le contenu  ·  Musée des Transmissions')
    canevas.drawRightString(LARGEUR - MARGE, 25.5, 'page %d' % canevas.getPageNumber())
    canevas.restoreState()


def couverture(canevas, doc):
    canevas.saveState()
    canevas.setFillColor(NUIT)
    canevas.rect(0, HAUTEUR - 221, LARGEUR, 221, stroke=0, fill=1)
    canevas.setFillColor(OR)
    canevas.rect(0, HAUTEUR - 221, LARGEUR, 3.5, stroke=0, fill=1)
    canevas.setFont(GRAS, 10)
    canevas.drawString(MARGE, HAUTEUR - 76.5, 'MUSÉE DES TRANSMISSIONS  ·  BORNE INTERACTIVE')
    canevas.setFillColor(BLANC)
    canevas.setFont(GRAS, 27)
    canevas.drawString(MARGE, HAUTEUR - 116, 'Administrer')
    canevas.drawString(MARGE, HAUTEUR - 147, 'le contenu')
    canevas.setFillColor(GRIS_CLAIR)
    canevas.setFont(REG, 12)
    canevas.drawString(MARGE, HAUTEUR - 193,
                       'Créer, modifier, habiller et transporter les pages de la borne')
    canevas.setFillColor(BLEU)
    canevas.setFont(GRAS, 62)
    canevas.drawRightString(LARGEUR - MARGE, HAUTEUR - 119, '2')
    canevas.restoreState()
    pied(canevas, doc)


# --------------------------------------------------------------------------
# Le texte du guide
# --------------------------------------------------------------------------
def contenu():
    p = [NextPageTemplate('suite')]
    a = p.append

    # ---------------------------------------------------------------- page 1
    a(Paragraph(
        "Ce guide s'adresse à la personne qui prépare le contenu de la borne. Il explique comment "
        "entrer dans la partie administration, créer et modifier les pages, régler leur "
        "apparence, et comment <b>préparer une page tranquillement sur son propre ordinateur</b> "
        "puis l'installer sur la borne à l'aide d'une clé USB.", corps_espace))
    a(encart(
        'Aucun risque de tout casser',
        "Chaque modification est enregistrée automatiquement, <b>Ctrl + Z</b> annule la dernière "
        "action, et l'application garde une copie de sauvegarde du contenu toutes les heures. "
        "Vous pouvez explorer sans crainte."))
    a(Paragraph('Ce que contient ce guide', sous_titre))
    a(tableau(
        ['', 'Sujet'],
        [['1', "Entrer dans l'administration"],
         ['2', "L'écran des pages : créer, réordonner, dupliquer, supprimer"],
         ['3', 'Modifier une page : les blocs, leur taille, leur habillage'],
         ['4', "Régler l'apparence : la page, toute la borne, l'écran d'accueil"],
         ['5', 'Exporter une page sur une clé USB'],
         ['6', 'Importer une page depuis une clé USB'],
         ['7', 'Les règles à connaître, et comment sortir']],
        largeurs=[26, UTILE - 26]))
    a(encart(
        'Ce qui a changé depuis la version précédente de ce guide',
        "Un quatrième modèle, <b>Page vierge</b>. Deux nouveaux panneaux : <b>Écran d'accueil</b> "
        "(les mots de l'accueil, leur apparence, l'image de chaque page, le délai de retour) et "
        "<b>Réglages</b> (le code d'accès, devenu modifiable, et la fermeture de l'application).",
        "Chaque bloc s'habille désormais : taille du texte, couleur, fond, transparence. Chaque "
        "page règle son <b>bandeau du haut</b>. Une photo se recadre, et se cadre au doigt. "
        "Enfin un <b>clavier s'affiche à l'écran</b> dès qu'on touche un champ — la salle n'a pas "
        "de clavier physique."))

    # ---------------------------------------------------------------- page 2
    a(PageBreak())
    a(titre(1, "Entrer dans l'administration"))
    a(Paragraph(
        "L'accès est volontairement caché : rien à l'écran ne le signale, pour qu'un visiteur ne "
        "tombe pas dessus par hasard.", corps_espace))
    a(figure(FigAcces, "L'appui prolongé dans le coin, puis le pavé de code."))
    a(reperes(
        "Posez le doigt dans le <b>coin supérieur droit</b> de l'écran et maintenez-le immobile "
        "<b>5 secondes</b>. Sans souris, sur l'écran tactile, c'est le seul moyen.",
        "Un pavé numérique apparaît. Saisissez le code d'accès — par défaut <b>1975</b>. "
        "L'administration s'ouvre aussitôt."))
    a(encart(
        'Vous avez un clavier branché ?',
        "Le raccourci <b>Ctrl + Alt + A</b> ouvre directement le pavé de code, sans avoir à "
        "maintenir le doigt dans le coin.",
        "Le code se tape indifféremment sur le pavé de l'écran ou au clavier — rangée du haut ou "
        "pavé numérique, verrouillage numérique allumé ou non. <b>Retour arrière</b> corrige un "
        "chiffre de trop."))
    a(encart(
        "Entrer dans l'administration depuis une page",
        "Si vous ouvrez l'administration alors qu'une page est affichée à l'écran visiteur, c'est "
        "<b>cette page</b> qui s'ouvre directement dans l'éditeur — et <b>Fermer</b> vous y "
        "ramène. Vous voyez tout de suite ce que vous venez de corriger."))
    a(encart(
        "Ce code n'est pas un mot de passe",
        "Il empêche un visiteur curieux d'entrer, rien de plus : il est inscrit en clair dans le "
        "fichier de contenu. Ne le présentez jamais comme une sécurité, et ne laissez pas "
        "l'ordinateur de la salle accessible sans surveillance.",
        "Vous pouvez le changer : bouton <b>Réglages</b>, puis <i>Code d'accès à "
        "l'administration</i>. Quatre chiffres, pas moins. Notez-le — sans lui, on n'entre plus."))

    # ---------------------------------------------------------------- page 3
    a(PageBreak())
    a(titre(2, "L'écran des pages"))
    a(Paragraph(
        "C'est le sommaire de la borne. L'ordre des lignes est exactement celui des cartes sur "
        "l'écran d'accueil, de gauche à droite.", corps_espace))
    a(figure(FigPages, "L'écran des pages, avec ses commandes."))
    a(reperes(
        "<b>Importer une page</b> — reprendre une page préparée sur un autre ordinateur "
        "(étape 6).",
        "<b>Écran d'accueil</b> — les mots de l'accueil et leur apparence, l'image de fond, "
        "l'image de chaque page, le délai de retour automatique (étape 4).",
        "<b>Apparence</b> — les couleurs de fond et de texte de <b>toutes</b> les pages "
        "(étape 4).",
        "<b>Réglages</b> — le code d'accès, et le bouton qui ferme l'application.",
        "<b>+ Nouvelle page</b> — on choisit d'abord une mise en page parmi <b>quatre "
        "modèles</b> ; le dernier, <i>Page vierge</i>, ne propose rien et vous laisse poser vos "
        "blocs vous-même.",
        "L'indicateur d'enregistrement, " + s('↶') + " <b>Annuler</b> et " + s('↷') +
        " <b>Rétablir</b>. Il n'y a pas de bouton « Enregistrer » : tout est écrit tout seul.",
        "La poignée " + s('⠿') + " : gardez le doigt dessus et glissez la ligne pour changer "
        "l'ordre des pages. Les flèches " + s('▲▼') + " font la même chose, un cran à la fois.",
        "<b>Modifier</b> (toucher le titre fait pareil), <b>Dupliquer</b>, <b>Exporter</b> vers "
        "une clé USB (étape 5), <b>Supprimer</b>."))
    a(encart(
        'Dupliquer plutôt que recommencer',
        "Pour faire une page qui ressemble à une autre, utilisez <b>Dupliquer</b> puis modifiez "
        "la copie. C'est bien plus rapide que de tout refaire, et la mise en page reste cohérente "
        "d'une page à l'autre."))
    a(encart(
        "Pas de clavier dans la salle ? L'écran en fournit un",
        "Dès que vous touchez un champ de saisie, un clavier AZERTY s'affiche en bas de l'écran, "
        "avec les lettres accentuées et un pavé de chiffres. Il se referme à la croix, ou tout "
        "seul dès que vous touchez autre chose qu'un champ."))

    # ---------------------------------------------------------------- page 4
    a(PageBreak())
    a(titre(3, 'Modifier une page'))
    a(Paragraph(
        "L'éditeur montre à gauche la page telle que le visiteur la verra, et à droite la liste "
        "de ses blocs. Ce que vous voyez à gauche est exactement ce qui s'affichera : c'est le "
        "même affichage que la borne, pas une imitation.", corps_espace))
    a(figure(FigEditeur, "L'éditeur d'une page."))
    a(reperes(
        "<b>L'aperçu.</b> Touchez un bloc pour ouvrir ses réglages, glissez-le pour le déplacer, "
        "tirez ses poignées pour changer sa taille.",
        "<b>La liste des blocs</b>, dans l'ordre de la page. Touchez-en un pour déplier ses "
        "réglages juste en dessous : son contenu d'abord, son apparence ensuite.",
        "<b>Les commandes de chaque ligne</b> — voir le tableau ci-dessous.",
        "<b>L'indicateur d'enregistrement.</b> <i>Enregistré</i> signifie que tout est écrit sur "
        "le disque.",
        "<b>+ Ajouter un bloc</b> — titre, texte, photo, galerie, vidéo, quiz ou frise "
        "chronologique. Touchez un type et le bloc se pose en bas de page ; ou glissez-le "
        "directement à l'endroit voulu sur l'aperçu."))
    a(Paragraph("Les commandes d'un bloc", sous_titre))
    a(tableau(
        ['Commande', 'Ce qu’elle fait'],
        [[s('⠿'), "Gardez le doigt dessus et glissez : le bloc se déplace, y compris entre les "
                  "blocs venus du modèle. Des cadres montrent d'avance la rangée telle qu'elle "
                  "sera."],
         [s('▲ ▼'), "Monte ou descend le bloc d'un cran — le glissement sans le geste."],
         [s('◧ ▭'), "Change la largeur, d'un palier au suivant : pleine largeur, moitié, "
                    "tiers, quart. Même réglage que la poignée du bord droit."],
         [s('↔'), "Centre le bloc sur sa ligne. Rappuyez : il se recolle à gauche. À refaire si "
                  "vous élargissez le bloc ensuite."],
         [s('✕'), "Retire le bloc de la page. Un bloc venu du modèle n'est pas perdu : il "
                  "réapparaît sous <i>Retirés de cette page</i>, son contenu intact."]],
        largeurs=[72, UTILE - 72]))
    a(Paragraph('Régler la taille et la place', sous_titre))
    a(puces(
        "<b>La largeur</b> : tirez la poignée du <b>bord droit</b>. La page est une grille de "
        "12 colonnes, un bloc en occupe de 3 à 12. Les blocs se replacent tout seuls et ne "
        "peuvent jamais se chevaucher.",
        "<b>La hauteur</b> : tirez la poignée du <b>bord bas</b> ou du <b>bord haut</b>. Celle du "
        "bas fait descendre le bloc, celle du haut le fait monter — chacune retient son bord "
        "opposé.",
        "Sur un bloc de texte, la hauteur <b>ajoute de la place, elle n'en retire jamais</b> : un "
        "texte ne peut pas être rogné. Le bloc reste centré dans la place réservée, et le vide "
        "au-dessus et au-dessous est justement l'espace entre les blocs.",
        "<b>Une photo n'a pas de hauteur à régler</b> : elle est montrée entière et son bloc "
        "prend ses proportions — sauf si vous cochez <i>Recadrer la photo</i>, page suivante."))

    # ---------------------------------------------------------------- page 5
    a(Paragraph('Habiller un bloc', sous_titre))
    a(Paragraph(
        "En haut du panneau d'un bloc, une barre règle son apparence. Elle est là pour "
        "<b>tous</b> les blocs, même ceux qui n'ont pas de texte — une galerie, un quiz, une "
        "photo pas encore choisie.", corps_espace))
    a(tableau(
        ['Réglage', 'Ce qu’il fait'],
        [['Mise en forme', "Gras, italique, souligné, listes à puces."],
         ['Alignement', "À gauche, centré, à droite."],
         ['Taille du texte', "De 60 à 200 %. C'est un facteur, pas une taille en points : les "
                             "écarts entre un titre et un paragraphe sont conservés. Les deux "
                             "« A » règlent au pas, la case s'écrit aussi à la main."],
         ['Couleur du texte', "Un disque de couleur. <i>Reprendre la couleur de la page</i> "
                              "revient en arrière."],
         ['Fond du bloc', "Une couleur, plus un curseur de <b>transparence</b> (0 à 90 %) qui ne "
                          "touche que le fond : le texte et les photos posés dessus restent "
                          "nets."],
         ['Le fond remplit<br/>toute la hauteur',
          "Case proposée une fois un fond choisi. Cochée, l'aplat de couleur descend jusqu'aux "
          "bords de la hauteur réglée ; décochée, le fond épouse le texte et la hauteur reste de "
          "l'espace libre autour du bloc."]],
        largeurs=[104, UTILE - 104]))
    a(Paragraph(
        "Le bouton du bas de la barre remet l'habillage à zéro : le bloc redevient un bloc "
        "ordinaire, et rien n'est gardé dans le fichier.", petit))
    a(Paragraph('Les photos, les galeries, les vidéos', sous_titre))
    a(puces(
        "<b>Une photo est montrée entière</b>, jamais coupée. Choisir une photo rétrécit "
        "légèrement le bloc si elle est très haute, pour qu'elle ne mange pas tout l'écran.",
        "<b>Recadrer la photo</b> (case du panneau) est la seule exception : le bloc reçoit une "
        "hauteur que vous réglez aux poignées, la photo la remplit, et ce qui dépasse est coupé. "
        "Sélectionnez le bloc puis <b>faites glisser la photo dans son cadre</b> pour choisir la "
        "partie visible. Le cadrage appartient au bloc : la même photo se cadre autrement sur une "
        "autre page.",
        "<b>Une pièce qui n'est pas une photographie ne se recadre pas</b> — affiche, gravure, "
        "planche, schéma, objet détouré : coupée, il n'en reste qu'une bande.",
        "<b>Une galerie</b> tient de 3 à 12 photos. Chacune porte sa propre légende, et les "
        "flèches réordonnent le diaporama.",
        "<b>Une vidéo</b> reçoit automatiquement une image de couverture à l'import. Elle ne "
        "démarre jamais toute seule : le visiteur touche la vidéo pour lire, et retouche pour "
        "mettre en pause."))
    a(encart(
        'Les quiz et les frises',
        "Un quiz peut avoir plusieurs bonnes réponses. Le plus important n'est pas le score mais "
        "l'explication : remplissez-la pour chaque réponse, juste ou fausse — c'est ce que le "
        "visiteur lit après avoir répondu.",
        "Une frise demande de remettre des événements dans l'ordre. Vous n'avez pas à les "
        "numéroter : indiquez l'année de chacun, l'ordre en est déduit, et l'éditeur vous montre "
        "l'ordre attendu."))
    a(encart(
        'Ce que le visiteur peut faire de votre page',
        "<b>Toucher une photo l'affiche en grand</b>, avec la légende que vous avez écrite sous "
        "cette photo-là.",
        "<b>Au bas de la page</b>, deux boutons mènent à la page précédente et à la page suivante "
        "dans l'ordre de l'accueil. Aux deux bouts du parcours, le bouton reste en place mais "
        "éteint.",
        "Sans que personne ne touche l'écran, la page se referme sur l'accueil au bout du délai "
        "réglé (étape 4). Une vidéo en cours de lecture repousse ce retour."))

    # ---------------------------------------------------------------- page 6
    a(PageBreak())
    a(titre(4, "Régler l'apparence"))
    a(Paragraph(
        "Trois panneaux, du plus précis au plus général. Chacun porte une ligne qui rappelle ce "
        "qu'il change et ce qu'il ne change pas.", corps_espace))
    a(KeepTogether(tableau(
        ['Panneau', 'Où', 'Ce qu’il change'],
        [["Apparence<br/>de la page", "Dans l'éditeur, en haut du panneau des blocs",
          "Le fond et le texte de <b>cette</b> page, et son bandeau du haut."],
         ["Apparence", "Écran des pages",
          "Le fond et le texte de <b>toutes</b> les pages, écran d'accueil compris."],
         ["Écran d'accueil", "Écran des pages",
          "Les mots de l'accueil, leur apparence, l'image de fond, l'image de chaque page, le "
          "délai de retour automatique."]],
        largeurs=[UTILE * 0.20, UTILE * 0.27, UTILE * 0.53])))
    a(encart(
        "La dernière modification l'emporte",
        "Changer une couleur générale <b>efface</b> celle des pages qui s'en étaient donné une. "
        "Sans cela, le réglage général ne changerait rien aux pages personnalisées et passerait "
        "pour cassé. C'est réversible par <b>Ctrl + Z</b>, comme tout le reste — et le bouton "
        "<i>Rétablir les couleurs d'origine</i> suit la même règle."))
    a(Paragraph('Le bandeau du haut, page par page', sous_titre))
    a(Paragraph(
        "C'est la barre où s'affichent « ← Accueil » et le titre de la page. Quatre réglages, "
        "dans <i>Apparence de la page</i>&#160;:", corps_espace))
    a(puces(
        "<b>Masquer le bandeau</b> — il devient transparent et ne garde que le bouton de retour, "
        "posé sur la page. La sortie ne se retire jamais.",
        "<b>Fond du bandeau</b> et <b>texte du bandeau</b>. Si vous ne choisissez pas la couleur "
        "du texte, elle se calcule d'elle-même : sombre sur un bandeau clair, claire sur un "
        "bandeau sombre.",
        "<b>Hauteur du bandeau</b>, de 72 à 200 pixels."))
    a(Paragraph(
        "Le bandeau est en dehors de la page : l'aperçu de l'éditeur ne le montre pas, le réglage "
        "se voit en mode visiteur.", petit))
    a(Paragraph("L'écran d'accueil", sous_titre))
    a(puces(
        "<b>Le grand titre et le sous-titre</b> : leur texte, leur couleur, leur taille.",
        "<b>La barre de titre des cartes</b> : son fond, sa couleur de texte, sa taille.",
        "<b>Les couleurs de l'accueil</b>, qui peuvent différer de celles des pages.",
        "<b>L'image de fond</b> de tout l'écran d'accueil.",
        "<b>L'image de chaque page</b> : celle qui la présente sur sa carte. Sans choix, c'est la "
        "première image de la page qui sert — le bouton <i>Automatique</i> y revient.",
        "<b>Revenir à l'accueil après</b> : de 1 à 60 minutes sans que personne ne touche "
        "l'écran.",
        "<b>Remettre l'apparence d'origine</b> efface ces réglages d'un coup."))

    # ---------------------------------------------------------------- page 7
    a(PageBreak())
    a(titre(5, 'Exporter une page sur une clé USB'))
    a(Paragraph(
        "C'est ce qui permet de préparer une page au calme, sur votre propre ordinateur, loin des "
        "visiteurs — puis de l'apporter sur la borne.", corps_espace))
    a(figure(FigExport, "Le choix de la destination, et le dossier obtenu."))
    a(reperes(
        "Branchez la clé USB, cliquez sur <b>Exporter</b> sur la ligne de la page, choisissez la "
        "clé puis validez.",
        "L'application crée un dossier « <b>Titre de la page.bornepage</b> ». Il contient la page "
        "et toutes ses photos et vidéos."))
    a(encart(
        'Ne renommez pas, ne réorganisez pas ce dossier',
        "Le fichier " + mono('page.json') + " et le sous-dossier " + mono('medias') + " doivent "
        "rester ensemble, tels quels. Copiez le dossier entier, jamais son contenu séparément."))
    a(titre(6, 'Importer une page depuis une clé USB'))
    a(Paragraph(
        "Sur l'ordinateur de destination, branchez la clé, entrez dans l'administration et "
        "cliquez sur <b>Importer une page</b>. Choisissez le dossier <b>.bornepage</b> — le "
        "dossier lui-même, pas ce qu'il y a dedans.", corps_espace))
    a(figure(FigImport, "Le message de confirmation après un import."))
    a(reperes(
        "Le bouton <b>Importer une page</b>, en haut de l'écran des pages.",
        "Le message vous dit ce qui s'est passé : la page a remplacé celle du même nom, ou bien "
        "elle a été ajoutée à la fin de l'accueil."))

    # ---------------------------------------------------------------- page 8
    a(Paragraph("Ce que fait l'application pour vous", sous_titre))
    a(tableau(
        ['Situation', 'Ce qui se passe'],
        [["La page existe déjà sur cette borne",
          "Elle est remplacée par la nouvelle version, en gardant sa place dans l'écran "
          "d'accueil. C'est le cas normal quand vous rapportez une page retouchée."],
         ["La page n'existe pas encore",
          "Elle est ajoutée à la fin de l'écran d'accueil. Vous pouvez ensuite la déplacer avec "
          "sa poignée."],
         ["Une photo est déjà présente sur la borne",
          "Elle n'est pas recopiée. Réimporter une page dont vous n'avez changé que le texte est "
          "donc quasi instantané, même avec des vidéos."],
         ["Les deux ordinateurs n'ont pas les mêmes couleurs",
          "Les couleurs et l'habillage d'origine de la page sont conservés, pour qu'elle ait "
          "exactement le même aspect qu'au moment où vous l'avez préparée."]]))
    a(encart(
        'Vous vous êtes trompé de page ?',
        "Un import s'annule comme n'importe quelle autre action : <b>Ctrl + Z</b>, ou le bouton "
        + s('↶') + " <b>Annuler</b> de la barre du haut."))
    a(titre(7, 'À connaître, et comment sortir'))
    a(Paragraph("Il n'y a pas de bouton « Enregistrer »", sous_titre))
    a(Paragraph(
        "Tout est écrit sur le disque environ une demi-seconde après votre dernière frappe. "
        "L'indicateur en haut de l'écran affiche <i>Modifications…</i> puis <i>Enregistré</i>. Ne "
        "cherchez pas de bouton : il n'y en a pas, volontairement.", corps_espace))
    a(Paragraph('Annuler une erreur', sous_titre))
    a(Paragraph(
        "<b>Ctrl + Z</b> annule, <b>Ctrl + Y</b> rétablit. Sans clavier, les boutons "
        + s('↶') + " <b>Annuler</b> et " + s('↷') + " <b>Rétablir</b> de la barre font la même "
        "chose. L'historique remonte cinquante actions en arrière, et il survit à un aller-retour "
        "par l'écran des visiteurs — c'est souvent en regardant le résultat qu'on se dit qu'on "
        "préférait l'état d'avant.", corps_espace))
    a(Paragraph('Les sauvegardes automatiques', sous_titre))
    a(Paragraph(
        "Une copie complète du contenu est mise de côté une fois par heure, dans le dossier "
        + mono('contenu-exemple\\sauvegardes') + ". Les 48 dernières sont conservées. Si le "
        "fichier principal venait à être abîmé, l'application repart toute seule sur la "
        "sauvegarde la plus récente au démarrage suivant, et le fichier abîmé est mis de côté — "
        "jamais effacé.", corps_espace))
    a(Paragraph("Sortir de l'administration", sous_titre))
    a(tableau(
        ['Ce que vous voulez faire', 'Comment'],
        [["Revenir à l'écran des visiteurs",
          "Le bouton <b>Fermer</b>, en haut à droite. Le travail en cours est enregistré avant."],
         ["Fermer complètement l'application",
          "<b>Réglages</b>, puis <b>Enregistrer et fermer l'application</b> — ou "
          "<b>Ctrl + Maj + A</b> depuis l'administration. Les deux enregistrent d'abord, puis "
          "ferment."],
         ["Fermer en cas de blocage",
          "<b>Ctrl + Alt + Maj + Q</b>, depuis n'importe où. À réserver au personnel technique : "
          "il ferme sans passer par l'enregistrement."]]))

    # ---------------------------------------------------------------- page 9
    a(Paragraph('Tous les raccourcis clavier', sous_titre))
    a(Paragraph(
        "La salle d'exposition n'a pas de clavier : tout ce qui suit se fait aussi au doigt, par "
        "les boutons de l'écran. Ces raccourcis servent quand vous préparez le contenu assis "
        "devant l'ordinateur, clavier branché.", corps_espace))
    a(tableau(
        ['Raccourci', 'Effet', 'Où'],
        [['Ctrl + Alt + A', "Ouvre le pavé du code d'accès, sans avoir à maintenir le doigt "
                            "5 secondes dans le coin", 'Écran visiteur'],
         ['Ctrl + Maj + A', "Ferme l'application — en enregistrant d'abord le travail en cours. "
                            "C'est le raccourci à retenir", 'Administration'],
         ['Ctrl + Alt + Maj + Q', "Ferme l'application sans enregistrer. Sortie de secours, à "
                                  "réserver au personnel technique", 'Partout'],
         ['Ctrl + M', "Replie l'application et découvre le bureau de Windows. On revient par "
                      "l'icône de la barre des tâches. C'est le seul moyen de replier la "
                      "fenêtre", 'Partout'],
         ['Ctrl + Z', "Annule la dernière action. L'historique remonte cinquante pas en arrière, "
                      "et un import compte pour un seul pas", 'Administration'],
         ['Ctrl + Y<br/>ou Ctrl + Maj + Z', "Rétablit ce qui vient d'être annulé",
          'Administration']],
        largeurs=[UTILE * 0.22, UTILE * 0.55, UTILE * 0.23]))
    a(encart(
        'Dans un champ de saisie, Ctrl + Z fait autre chose',
        "Il annule alors votre frappe, comme dans un traitement de texte, et non la dernière "
        "action de la page. C'est voulu : au milieu d'un texte, c'est ce que l'on attend. Pour "
        "annuler une action de la page, cliquez d'abord en dehors du champ, ou servez-vous du "
        "bouton " + s('↶') + " <b>Annuler</b> de la barre."))
    a(Paragraph('Régler un bloc au clavier', sous_titre))
    a(Paragraph(
        "Dans l'éditeur, les poignées de redimensionnement s'atteignent avec la touche "
        "<b>Tab</b>. Une fois la poignée sélectionnée :", corps_espace))
    a(tableau(
        ['Touches', 'Effet'],
        [[s('← →'), "Élargit ou rétrécit le bloc d'une colonne (entre 3 et 12 sur la grille)"],
         [s('↑ ↓'), "Change la hauteur par pas de 20 pixels, entre 160 et 1400 — sur tout bloc, "
                    "sauf une photo qui n'est pas recadrée"],
         ['Entrée ou Espace', "Sélectionne le bloc de l'aperçu et ouvre ses réglages"]],
        largeurs=[UTILE * 0.24, UTILE * 0.76]))
    a(Paragraph('Ce qui est volontairement bloqué', sous_titre))
    a(Paragraph(
        "Devant les visiteurs, la fenêtre ne laisse passer aucune touche qui rendrait le bureau "
        "Windows : <b>Échap</b>, <b>F5</b>, <b>F11</b>, <b>Alt + F4</b>, <b>Ctrl + R</b>, "
        "<b>Ctrl + W</b>, <b>Ctrl + N</b> et les raccourcis d'outils de développement n'ont aucun "
        "effet. Le geste à trois ou quatre doigts vers le bas, qui replie les fenêtres sous "
        "Windows, est rattrapé de la même façon : la borne remonte aussitôt. La frappe ordinaire, "
        "elle, passe normalement — les champs de l'administration en ont besoin.", corps_espace))
    a(encart(
        "La règle d'or du transport de pages",
        "Les deux ordinateurs doivent faire tourner <b>la même version</b> de l'application. Si "
        "vous mettez le vôtre à jour, mettez aussi la borne à jour — la commande "
        + mono('git pull') + " du guide n° 1 s'en charge. Une page préparée avec une version plus "
        "récente sera refusée avec un message clair, plutôt que de s'afficher de travers."))
    return p


def fabriquer(chemin):
    doc = BaseDocTemplate(
        chemin, pagesize=A4,
        leftMargin=MARGE, rightMargin=MARGE, topMargin=MARGE, bottomMargin=MARGE,
        title='Administrer le contenu — Borne du Musée des Transmissions',
        author='Musée des Transmissions',
    )
    doc.addPageTemplates([
        PageTemplate(id='couverture',
                     frames=[Frame(MARGE, 46, UTILE, HAUTEUR - 46 - 266, id='c')],
                     onPage=couverture),
        PageTemplate(id='suite',
                     frames=[Frame(MARGE, 46, UTILE, HAUTEUR - 46 - 62, id='s')],
                     onPage=pied),
    ])
    doc.build(contenu())
    print('écrit :', chemin)


if __name__ == '__main__':
    ici = os.path.dirname(os.path.abspath(__file__))
    fabriquer(os.path.join(ici, '2 - Administrer le contenu.pdf'))
