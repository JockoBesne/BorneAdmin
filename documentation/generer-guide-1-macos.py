# -*- coding: utf-8 -*-
"""
Fabrique « 1 - Installer la borne (macOS).pdf ».

Version macOS du guide n° 1. Le PDF ne se modifie pas à la main : on modifie
CE fichier, puis on relance

    python documentation/generer-guide-1-macos.py

depuis la racine du dépôt (une seule installation préalable : pip install reportlab).

La mise en page (palette, styles, encarts, tableaux, figures) est celle du
guide n° 2 : on l'importe au lieu de la recopier, pour que les deux guides ne
se mettent jamais à diverger.

Écrit le 2026-08-21.
"""

import importlib.util
import os

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
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
# On reprend tout l'habillage du guide n° 2. Son nom de fichier porte un tiret,
# qu'un « import » ordinaire ne sait pas lire : d'où le passage par importlib.
# Le guide n° 2 ne fabrique rien à l'import (il a sa garde « __main__ »).
# --------------------------------------------------------------------------
ICI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    'guide2', os.path.join(ICI, 'generer-guide-2.py'))
g2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(g2)

# Couleurs, polices et styles
NUIT, ENCRE, BLEU, BLEU_SOMBRE = g2.NUIT, g2.ENCRE, g2.BLEU, g2.BLEU_SOMBRE
OR, CREME, GRIS, GRIS_CLAIR = g2.OR, g2.CREME, g2.GRIS, g2.GRIS_CLAIR
LIGNE, RANG, BLANC, VERT = g2.LIGNE, g2.RANG, g2.BLANC, g2.VERT
REG, GRAS, ITAL, MONO = g2.REG, g2.GRAS, g2.ITAL, g2.MONO
LARGEUR, HAUTEUR, MARGE, UTILE = g2.LARGEUR, g2.HAUTEUR, g2.MARGE, g2.UTILE
corps, corps_espace, petit = g2.corps, g2.corps_espace, g2.petit
sous_titre, legende_fig = g2.sous_titre, g2.legende_fig
cell, cell_gras = g2.cell, g2.cell_gras

# Briques de mise en page
s, mono = g2.s, g2.mono
titre, encart, tableau, reperes, puces = (
    g2.titre, g2.encart, g2.tableau, g2.reperes, g2.puces)
Figure, figure = g2.Figure, g2.figure


# --------------------------------------------------------------------------
# Deux briques propres à ce guide-ci : les commandes à recopier, et l'arbre
# des dossiers. Le guide n° 2 n'en a pas besoin — il ne fait taper personne.
# --------------------------------------------------------------------------
from reportlab.lib.styles import ParagraphStyle  # noqa: E402  (après g2)

etiquette = ParagraphStyle('etiquette', fontName=GRAS, fontSize=7.6, leading=11,
                           textColor=OR)
ligne_cmd = ParagraphStyle('ligne_cmd', fontName=MONO, fontSize=9.4, leading=15,
                           textColor=BLANC, leftIndent=14, firstLineIndent=-14)
ligne_arbre = ParagraphStyle('ligne_arbre', fontName=MONO, fontSize=9,
                             leading=13.5, textColor=ENCRE)


def commande(*lignes, etiq='À TAPER DANS LE TERMINAL'):
    """Encadré sombre : du texte à recopier tel quel, puis Entrée."""
    interieur = [Paragraph(etiq, etiquette), Spacer(1, 5)]
    for ligne in lignes:
        interieur.append(Paragraph(
            '<font color="#c9a227">&gt;</font>&nbsp;&nbsp;%s' % ligne, ligne_cmd))
    t = Table([[interieur]], colWidths=[UTILE])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NUIT),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    t.spaceBefore = 8
    t.spaceAfter = 12
    return t


def arbre(*lignes):
    """Le contenu d'un dossier, en pas-de-caractère fixe."""
    interieur = [Paragraph(l.replace(' ', '&nbsp;'), ligne_arbre) for l in lignes]
    t = Table([[interieur]], colWidths=[UTILE])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), RANG),
        ('LINEBEFORE', (0, 0), (0, -1), 3.5, GRIS_CLAIR),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    t.spaceBefore = 6
    t.spaceAfter = 4
    return t


# --------------------------------------------------------------------------
# Figures
# --------------------------------------------------------------------------
class FigTerminal(Figure):
    """Spotlight, puis la fenêtre du Terminal."""
    hauteur = 168

    def dessiner(self, c):
        # --- Spotlight -----------------------------------------------------
        self.boite(c, 4, 108, 224, 34, BLANC, LIGNE, rayon=8)
        c.setStrokeColor(GRIS)
        c.setLineWidth(1.2)
        c.circle(22, 125, 5.5, stroke=1, fill=0)
        c.line(26, 121, 30, 117)
        self.mot(c, 40, 121, 'terminal', 12, ENCRE, REG)
        self.pastille(c, 232, 142, 1)

        # Résultat proposé
        self.boite(c, 4, 66, 224, 36, BLANC, LIGNE, rayon=8)
        self.boite(c, 10, 72, 212, 24, RANG, None, rayon=5)
        self.boite(c, 16, 76, 16, 16, NUIT, None, rayon=3)
        self.mot(c, 18.5, 81, '>_', 7, VERT, MONO)
        self.mot(c, 38, 86, 'Terminal', 8.5, NUIT, GRAS)
        self.mot(c, 38, 76.5, 'Application', 7, GRIS, REG)
        self.pastille(c, 232, 100, 2)

        # --- La fenêtre du Terminal ---------------------------------------
        fx = 254
        fw = UTILE - fx
        self.boite(c, fx, 46, fw, 108, BLANC, LIGNE, rayon=6)
        # barre de titre à pastilles
        self.boite(c, fx, 132, fw, 22, RANG, None, rayon=6)
        for i, teinte in enumerate((g2.ROUGE, OR, VERT)):
            c.setFillColor(teinte)
            c.circle(fx + 14 + i * 13, 143, 4.2, stroke=0, fill=1)
            c.setFillColor(BLANC)
        self.mot(c, fx, 139.5, 'musee — -zsh — 80×24', 7.6, GRIS, REG, centre=fw)
        # l'invite
        self.mot(c, fx + 12, 116, 'Dernière connexion : mar. 21 août', 7.4, GRIS, MONO)
        self.mot(c, fx + 12, 100, 'musee@Mac-du-musee ~ %', 8.4, ENCRE, MONO)
        c.setFillColor(ENCRE)
        c.rect(fx + 124, 98.5, 5, 10, stroke=0, fill=1)
        self.pastille(c, UTILE - 6, 160, 3)

        # légende de l'invite
        self.mot(c, fx + 12, 74, "Le curseur clignote : le Mac attend", 7.4, GRIS, ITAL)
        self.mot(c, fx + 12, 63, "que vous tapiez une commande.", 7.4, GRIS, ITAL)


class FigGitHub(Figure):
    """La page du projet sur GitHub : le bouton vert et l'icône de copie."""
    hauteur = 150

    def dessiner(self, c):
        L = UTILE
        self.boite(c, 0, 8, L, 134, BLANC, LIGNE)
        # barre d'adresse
        self.boite(c, 10, 118, L - 20, 18, RANG, LIGNE, rayon=9)
        self.mot(c, 22, 123.5, 'https://github.com/JockoBesne/BorneAdmin', 7.6, GRIS, MONO)
        # fil d'Ariane
        self.mot(c, 14, 100, 'JockoBesne / ', 9, BLEU, REG)
        self.mot(c, 63, 100, 'BorneAdmin', 9, NUIT, GRAS)

        # bouton Code
        bx = L - 108
        self.boite(c, bx, 74, 62, 20, VERT, None, rayon=4)
        self.mot(c, bx, 80.5, 'Code  ▾', 8.5, NUIT, GRAS, centre=62)
        self.pastille(c, bx - 8, 92, 1)

        # menu déroulant
        self.boite(c, bx - 96, 20, 158, 50, BLANC, LIGNE, rayon=4)
        self.mot(c, bx - 86, 56, 'HTTPS', 7.5, NUIT, GRAS)
        self.boite(c, bx - 86, 32, 118, 16, RANG, LIGNE, rayon=3)
        self.mot(c, bx - 82, 37, 'https://github.com/JockoBesne/', 6.6, ENCRE, MONO)
        # icône de copie
        self.boite(c, bx - 44 + 6, 32, 26, 16, BLANC, LIGNE, rayon=3)
        self.mot(c, bx - 38 + 6, 37, 'COPIER', 5.8, BLEU, GRAS)
        self.pastille(c, bx + 70, 40, 2)

        # l'avertissement
        self.boite(c, 14, 24, 150, 20, g2.ROSE, g2.ROUGE, rayon=3)
        self.mot(c, 22, 30.5, 'Ne prenez pas « Download ZIP ».', 7.4, g2.ROUGE, GRAS)


class FigAccueil(Figure):
    """L'écran d'accueil de la borne, et le coin d'accès caché."""
    hauteur = 172

    def dessiner(self, c):
        L = UTILE
        self.boite(c, 0, 8, L, 156, NUIT, GRIS_CLAIR)
        self.mot(c, 20, 132, 'Musée des Transmissions', 13, BLANC, GRAS)
        self.mot(c, 20, 118, "Troisième étage — de l'Antiquité aux années 1970",
                 8.4, GRIS_CLAIR, REG)
        noms = ('Trois mille ans', "Avant l'électricité", 'Chappe')
        for i, nom in enumerate(noms):
            x = 20 + i * ((L - 40) / 3.0)
            w = (L - 40) / 3.0 - 12
            self.boite(c, x, 28, w, 76, BLEU_SOMBRE, None, rayon=3)
            self.boite(c, x, 28, w, 16, NUIT, None, rayon=3)
            self.mot(c, x + 8, 33, nom, 7.6, CREME, GRAS)

        # le coin caché
        c.setStrokeColor(OR)
        c.setLineWidth(1.4)
        c.setDash(3, 3)
        c.rect(L - 46, 118, 40, 40, stroke=1, fill=0)
        c.setDash()
        self.pastille(c, L - 26, 168, 1)


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
    canevas.drawString(MARGE, 25.5, 'Installer la borne sur macOS  ·  Musée des Transmissions')
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
    canevas.drawString(MARGE, HAUTEUR - 116, 'Installer la borne')
    canevas.drawString(MARGE, HAUTEUR - 147, 'sur un Mac')
    canevas.setFillColor(GRIS_CLAIR)
    canevas.setFont(REG, 12)
    canevas.drawString(MARGE, HAUTEUR - 193,
                       'Guide pas à pas, sans aucune connaissance en informatique')
    canevas.setFillColor(BLEU)
    canevas.setFont(GRAS, 62)
    canevas.drawRightString(LARGEUR - MARGE, HAUTEUR - 119, '1')
    canevas.setFillColor(GRIS_CLAIR)
    canevas.setFont(GRAS, 11)
    canevas.drawRightString(LARGEUR - MARGE, HAUTEUR - 148, 'macOS')
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
        "Ce guide explique comment installer l'application de la borne sur un Mac, de zéro. "
        "Vous n'avez besoin d'aucune connaissance particulière : il suffit de suivre les "
        "étapes dans l'ordre et de recopier les commandes exactement telles qu'elles sont "
        "écrites.", corps_espace))

    a(encart(
        "Un Mac ne peut pas tenir la borne de la salle",
        "Deux raisons, et aucune ne se corrige par du réglage. <b>macOS ne gère pas les "
        "écrans tactiles</b> : le moniteur de l'exposition afficherait l'image, mais aucun "
        "toucher ne serait transmis. Et le <b>verrouillage du mode borne est incomplet</b> "
        "sur macOS : " + mono('Cmd + H') + ", " + mono('Cmd + Tab') + " et Mission Control "
        "rendent le bureau au visiteur.",
        "<b>Servez-vous donc d'un Mac pour préparer le contenu</b>, et gardez l'ordinateur "
        "Windows pour la salle. Les étapes 1 à 6 de ce guide valent pour les deux ; "
        "l'étape 7 est écrite pour un poste de démonstration surveillé."))

    a(Paragraph("Comptez environ 30 minutes", sous_titre))
    a(Paragraph(
        "Dont une bonne partie d'attente pendant les téléchargements. Vous aurez besoin d'un "
        "Mac sous macOS 12 (Monterey) ou plus récent, d'une connexion internet et d'environ "
        "5 Go d'espace libre sur le disque. Les Mac à puce Apple (M1 à M4) comme les Mac "
        "Intel conviennent.", corps_espace))

    a(Paragraph("Ce que vous allez faire", sous_titre))
    a(tableau(
        ['Étape', 'Durée'],
        [['1&nbsp;&nbsp; Installer Node.js, le moteur qui fait tourner l\'application', '5 min'],
         ['2&nbsp;&nbsp; Installer Git, l\'outil qui récupère le projet', '5 min'],
         ['3&nbsp;&nbsp; Ouvrir le Terminal, la fenêtre où l\'on tape les commandes', '1 min'],
         ['4&nbsp;&nbsp; Télécharger le projet depuis internet', '3 min'],
         ['5&nbsp;&nbsp; Installer les composants de l\'application', '5 à 10 min'],
         ['6&nbsp;&nbsp; Lancer l\'application pour la première fois', '2 min'],
         ['7&nbsp;&nbsp; Faire démarrer la borne toute seule (poste de démonstration)', '5 min']],
        largeurs=[UTILE * 0.82, UTILE * 0.18]))

    a(Paragraph("Un mot sur les commandes", sous_titre))
    a(Paragraph(
        "Vous allez rencontrer des encadrés sombres. Ce sont des commandes : du texte à "
        "recopier dans une fenêtre appelée le <b>Terminal</b>, puis à valider avec la touche "
        "Entrée. Le signe " + mono('&gt;') + " au début ne se recopie pas, il indique "
        "simplement le début de la ligne.", corps_espace))

    a(Paragraph("Les touches du Mac", sous_titre))
    a(Paragraph(
        "Les raccourcis de la borne ont été écrits pour un clavier de PC. Sur un Mac, ils "
        "s'utilisent tels quels — avec la touche <b>Contrôle</b>, et surtout pas la touche "
        "Commande, qui lui ressemble mais n'est pas la même.", corps_espace))
    a(tableau(
        ['Nom dans ce guide', 'La touche sur le clavier du Mac'],
        [['Ctrl', 'La touche ' + s('⌃') + ' <b>Contrôle</b>, en bas à gauche. '
                  'C\'est celle qu\'utilisent les raccourcis de la borne.'],
         ['Cmd', 'La touche ' + s('⌘') + ' <b>Commande</b>, de part et d\'autre de la barre '
                 'd\'espace. Elle sert à macOS, pas à la borne.'],
         ['Maj', 'La touche ' + s('⇧') + ' <b>Majuscule</b>.'],
         ['Alt', 'La touche ' + s('⌥') + ' <b>Option</b>.']],
        largeurs=[UTILE * 0.24, UTILE * 0.76]))

    a(PageBreak())

    # ---------------------------------------------------------------- page 2
    a(titre(1, 'Installer Node.js'))
    a(Paragraph(
        "Node.js est le moteur qui fait fonctionner l'application. Sans lui, rien ne démarre.",
        corps_espace))
    a(commande('https://nodejs.org/fr/download', etiq='PAGE DE TÉLÉCHARGEMENT'))
    a(Paragraph(
        "Sur cette page, prenez la version <b>LTS</b> « la plus stable », au format "
        "<b>macOS Installer (.pkg)</b>. Deux versions sont proposées : <b>ARM64</b> pour les "
        "Mac à puce Apple, <b>x64</b> pour les Mac Intel.", corps_espace))
    a(Paragraph(
        "Pour savoir laquelle prendre : menu <b>Pomme</b>, en haut à gauche de l'écran, puis "
        "<b>À propos de ce Mac</b>. Si la ligne indique « Puce Apple M1 » (ou M2, M3, M4), "
        "prenez ARM64 ; si elle indique « Processeur Intel », prenez x64.", corps_espace))
    a(Paragraph(
        "Téléchargez le fichier, puis ouvrez-le. L'installateur pose plusieurs questions : "
        "gardez toutes les réponses proposées par défaut et cliquez sur <b>Continuer</b> "
        "jusqu'au bout. Il demandera le mot de passe de votre session à la fin.",
        corps_espace))
    a(encart(
        "Vérification",
        "Une fois l'installation terminée, fermez toutes les fenêtres du Terminal déjà "
        "ouvertes, puis rouvrez-en une (voir l'étape 3) et tapez " + mono('node -v') + ". "
        "Le Mac doit répondre quelque chose comme " + mono('v22.12.0') + " ou plus. Si le "
        "numéro est plus petit, réinstallez la version LTS."))

    a(titre(2, 'Installer Git'))
    a(Paragraph(
        "Git est l'outil qui va chercher le projet sur internet et, plus tard, permettra de "
        "récupérer les mises à jour d'une seule commande. Sur un Mac, il n'y a rien à "
        "télécharger : macOS l'installe lui-même dès qu'on le lui demande.", corps_espace))
    a(commande('git --version'))
    a(Paragraph(
        "Une fenêtre s'ouvre : « <b>La commande git nécessite les outils de développement en "
        "ligne de commande</b> ». Cliquez sur <b>Installer</b>, acceptez la licence, et "
        "laissez faire — comptez quelques minutes.", corps_espace))
    a(encart(
        "Vérification",
        "Quand l'installation est finie, retapez " + mono('git --version') + ". Le Mac doit "
        "répondre quelque chose comme " + mono('git version 2.39.5') + ".",
        "Si aucune fenêtre ne s'est ouverte, lancez l'installation à la main avec "
        + mono('xcode-select --install') + "."))

    a(PageBreak())

    # ---------------------------------------------------------------- page 3
    a(titre(3, 'Ouvrir le Terminal'))
    a(Paragraph(
        "Le Terminal est une fenêtre dans laquelle on tape des commandes. C'est là que vous "
        "recopierez tous les encadrés sombres de ce guide.", corps_espace))
    a(figure(FigTerminal, 'Ouvrir le Terminal depuis la recherche Spotlight.'))
    a(reperes(
        "Appuyez sur " + mono('Cmd + Espace') + " : une barre de recherche s'ouvre au milieu "
        "de l'écran. Tapez directement <b>terminal</b> au clavier.",
        "Le Mac propose l'application <b>Terminal</b>. Appuyez sur Entrée.",
        "La fenêtre s'ouvre. Le curseur clignote après le signe " + mono('%') + " : "
        "l'ordinateur attend une commande."))
    a(encart(
        "Comment recopier une commande sans se tromper",
        "Sélectionnez le texte de l'encadré sombre dans ce PDF, faites " + mono('Cmd + C')
        + " pour le copier, cliquez dans la fenêtre du Terminal puis faites "
        + mono('Cmd + V') + " pour le coller. Appuyez ensuite sur Entrée.",
        "Attention, une commande recopiée à la main avec une faute ne fonctionnera pas."))

    a(titre(4, 'Télécharger le projet'))
    a(Paragraph(
        "Le projet est stocké sur GitHub, un site qui héberge des programmes. Son adresse "
        "est :", corps_espace))
    a(commande('https://github.com/JockoBesne/BorneAdmin', etiq='ADRESSE DU PROJET'))
    a(Paragraph(
        "Vous n'avez pas besoin d'aller sur le site : les deux commandes ci-dessous "
        "suffisent. La première crée un dossier " + mono('borne') + " dans votre dossier "
        "personnel et s'y place, la seconde y télécharge le projet.", corps_espace))
    a(commande('mkdir -p ~/borne &amp;&amp; cd ~/borne',
               'git clone https://github.com/JockoBesne/BorneAdmin.git'))
    a(Paragraph(
        "Le signe " + mono('~') + " désigne votre dossier personnel — celui qui porte votre "
        "nom dans le Finder. Le projet se retrouvera donc dans "
        + mono('/Users/&lt;votre nom&gt;/borne/BorneAdmin') + ". Il s'obtient au clavier avec "
        + mono('Alt + N') + ".", corps_espace))

    a(PageBreak())

    # ---------------------------------------------------------------- page 4
    a(Paragraph("Si vous préférez passer par le site", sous_titre))
    a(figure(FigGitHub, 'Schéma de la page du projet sur GitHub.'))
    a(reperes(
        "Le bouton vert <b>Code</b>, en haut à droite de la liste des fichiers.",
        "L'icône de copie, à côté de l'adresse HTTPS. Elle copie l'adresse à coller après "
        + mono('git clone') + "."))
    a(encart(
        "Ne prenez pas « Download ZIP »",
        "Le fichier ZIP fonctionne, mais il ne permet pas de recevoir les mises à jour "
        "ensuite. Avec " + mono('git clone') + ", une seule commande suffira plus tard pour "
        "mettre la borne à jour."))

    a(titre(5, 'Installer les composants'))
    a(Paragraph(
        "Le projet téléchargé ne contient que le code. Il faut maintenant récupérer les "
        "briques logicielles dont il a besoin. Placez-vous dans le dossier du projet, puis "
        "lancez l'installation.", corps_espace))
    a(commande('cd ~/borne/BorneAdmin', 'npm install'))
    a(Paragraph(
        "Cette étape dure plusieurs minutes et affiche beaucoup de lignes. C'est normal. À la "
        "fin, vous devez voir un message du genre " + mono('added 84 packages') + ".",
        corps_espace))
    a(encart(
        "Ne lancez jamais « npm audit fix »",
        "À la fin de l'installation, l'ordinateur signale parfois des vulnérabilités et "
        "propose de lancer " + mono('npm audit fix') + ". Ne le faites pas. Ces alertes "
        "concernent des sites web exposés à internet, ce que la borne n'est pas — et cette "
        "commande casse l'installation d'Electron. C'est la panne la plus fréquente sur ce "
        "projet.",
        "Ne mettez jamais " + mono('sudo') + " devant " + mono('npm') + " non plus : "
        "l'installation se ferait au nom de l'administrateur et le projet ne s'ouvrirait "
        "plus ensuite."))

    a(PageBreak())

    # ---------------------------------------------------------------- page 5
    a(Paragraph(
        "Une fois l'installation terminée, votre dossier doit ressembler à ceci :",
        corps_espace))
    a(arbre(
        '~/borne/BorneAdmin',
        '  apps',
        '  packages',
        '  contenu-exemple',
        '     contenu.json   ← tout le contenu de la borne',
        '     medias         ← les photos et les vidéos',
        '  package.json',
        '  documentation     ← les guides'))
    a(Paragraph('Le contenu du dossier <i>~/borne/BorneAdmin</i> après installation.',
                legende_fig))

    a(titre(6, "Lancer l'application"))
    a(commande('npm run appli'))
    a(Paragraph(
        "L'application s'ouvre en plein écran, sur l'écran d'accueil du musée. Laissez la "
        "fenêtre du Terminal ouverte derrière : c'est elle qui fait tourner la borne, la "
        "fermer arrêterait l'application.", corps_espace))
    a(figure(FigAccueil, "L'écran d'accueil de la borne au premier lancement."))
    a(reperes(
        "Le coin supérieur droit est la zone d'accès cachée à l'administration. Elle est "
        "invisible pour les visiteurs. Voyez le guide n° 2 pour l'utiliser."))
    a(encart(
        "Si rien ne s'ouvre",
        "La commande " + mono('npm run appli') + " passe un réglage prévu pour Linux, que "
        "macOS ignore. Si l'application refusait malgré tout de s'ouvrir, essayez les deux "
        "commandes " + mono('npm run construire') + " puis " + mono('npx electron .') + ", "
        "qui font la même chose sans ce réglage."))

    a(PageBreak())

    # ---------------------------------------------------------------- page 6
    a(Paragraph("Comment fermer l'application", sous_titre))
    a(Paragraph(
        "La borne est volontairement verrouillée : ni la croix de fermeture, ni "
        + mono('Cmd + Q') + ", ni Échap ne fonctionnent, pour qu'un visiteur ne puisse pas en "
        "sortir. Deux raccourcis ferment l'application — tous deux avec la touche "
        "<b>Contrôle</b> " + s('⌃') + ", pas la touche Commande :", corps_espace))
    a(puces(
        "<b>Ctrl + Maj + A</b> depuis l'écran d'administration — c'est celui à retenir, il "
        "enregistre le travail en cours avant de fermer. L'écran « Réglages » a aussi un "
        "bouton qui fait exactement la même chose, pour les postes sans clavier.",
        "<b>Ctrl + Alt + Maj + Q</b> depuis n'importe où — le raccourci de secours, à "
        "réserver au personnel technique."))
    a(encart(
        "Ce que le verrouillage ne retient pas sur un Mac",
        "Le mode borne a été construit contre Windows. Sur macOS, trois gestes rendent le "
        "bureau au visiteur et aucun réglage de l'application ne les arrête : "
        + mono('Cmd + H') + " (masquer), " + mono('Cmd + Tab') + " (changer d'application) "
        "et Mission Control (balayage à trois doigts, touche F3, coins actifs).",
        "Sur un poste de démonstration, réduisez le risque dans <b>Réglages Système "
        "&gt; Clavier &gt; Raccourcis clavier</b> : décochez tout dans <b>Mission Control</b>, "
        "et mettez tous les <b>coins actifs</b> sur « — ». Cela ne remplace pas un poste "
        "Windows pour une salle laissée sans surveillance."))

    a(PageBreak())

    # ---------------------------------------------------------------- page 7
    a(titre(7, 'Faire démarrer la borne toute seule'))
    a(Paragraph(
        "Cette étape ne concerne que le Mac d'un poste de démonstration. Elle fait en sorte "
        "qu'à l'allumage, il ouvre sa session et lance l'application sans que personne n'ait "
        "rien à faire.", corps_espace))

    a(Paragraph("Fabriquer le lanceur", sous_titre))
    a(Paragraph(
        "La commande ci-dessous crée un petit fichier " + mono('borne.command') + " qui "
        "lance l'application. Adaptez le chemin si vous n'avez pas installé le projet dans "
        + mono('~/borne') + ".", corps_espace))
    a(commande(
        "printf '#!/bin/bash\\ncd ~/borne/BorneAdmin \\&\\& npm run appli\\n' "
        "&gt; ~/borne/borne.command",
        'chmod +x ~/borne/borne.command'))
    a(Paragraph(
        "Pour vérifier tout de suite qu'il fonctionne :", corps_espace))
    a(commande('open ~/borne/borne.command'))

    a(Paragraph("Le lancer à l'ouverture de session", sous_titre))
    a(Paragraph(
        "Ouvrez <b>Réglages Système &gt; Général &gt; Ouverture</b>. Dans la liste du haut, "
        "« Ouvrir au moment de la connexion », cliquez sur <b>+</b>, puis appuyez sur "
        + mono('Cmd + Maj + G') + " et tapez " + mono('~/borne') + " pour retrouver le "
        "fichier " + mono('borne.command') + ". Sélectionnez-le et validez.", corps_espace))

    a(Paragraph("Ouverture de session automatique", sous_titre))
    a(Paragraph(
        "Sans cela, le Mac s'arrête sur l'écran de mot de passe. Allez dans <b>Réglages "
        "Système &gt; Utilisateurs et groupes</b>, puis réglez <b>Ouvrir une session "
        "automatiquement en tant que</b> sur le compte de la borne.", corps_espace))
    a(encart(
        "Si le réglage est grisé",
        "C'est que <b>FileVault</b>, le chiffrement du disque, est actif : macOS refuse alors "
        "toute ouverture de session automatique. Désactivez-le dans <b>Réglages Système "
        "&gt; Confidentialité et sécurité &gt; FileVault</b>. Le déchiffrement peut prendre "
        "une heure ou deux, laissez le Mac branché."))

    a(Paragraph("Empêcher la mise en veille", sous_titre))
    a(Paragraph(
        "La commande demandera le mot de passe de votre session : tapez-le, rien ne "
        "s'affiche à l'écran pendant la frappe, c'est normal.", corps_espace))
    a(commande('sudo pmset -a displaysleep 0 sleep 0 disksleep 0'))
    a(Paragraph(
        "Réglez aussi l'économiseur d'écran sur <b>Jamais</b> dans <b>Réglages Système "
        "&gt; Écran verrouillé</b>, et mettez « Exiger un mot de passe » sur <b>Jamais</b>.",
        corps_espace))
    a(Paragraph(
        "Redémarrez enfin le Mac pour vérifier toute la chaîne : allumage, ouverture de "
        "session, application en plein écran.", corps_espace))

    a(PageBreak())

    # ---------------------------------------------------------------- page 8
    a(Paragraph("En cas de problème", sous_titre))
    a(Paragraph(
        "Voici les pannes rencontrées sur ce projet, et leur solution.", corps_espace))
    a(tableau(
        ['Ce que vous voyez', "Ce qu'il faut faire"],
        [['command not found: npm<br/>ou command not found: git',
          "Le logiciel vient d'être installé mais le Terminal ne le sait pas encore. "
          "Fermez la fenêtre et rouvrez-en une neuve."],
         ['xcrun: error: invalid active<br/>developer path',
          "Les outils en ligne de commande d'Apple manquent ou ont été abîmés par une mise à "
          "jour de macOS. Tapez " + mono('xcode-select --install') + " et laissez faire."],
         ['Electron failed to install<br/>correctly',
          "Le moteur graphique (environ 270 Mo) se télécharge à part et un réseau filtrant "
          "GitHub peut bloquer. Tapez " + mono('npm run reparer-electron') + ". Si le "
          "problème persiste, copiez le dossier " + mono('node_modules/electron') + " depuis "
          "un ordinateur où l'application fonctionne."],
         ["« Electron » ne peut pas être<br/>ouvert car son développeur ne<br/>peut pas être "
          "vérifié",
          "macOS a mis le moteur graphique en quarantaine. Depuis le dossier du projet, "
          "tapez " + mono('xattr -dr com.apple.quarantine node_modules/electron/dist')
          + " puis relancez."],
         ['1 high severity vulnerability<br/>après l\'installation',
          "Message sans conséquence pour une borne hors ligne. Ignorez-le, et surtout ne "
          "lancez pas la commande proposée."],
         ['La version de Node est trop<br/>ancienne',
          "Réinstallez Node.js en version LTS depuis nodejs.org, en prenant bien "
          "l'architecture de votre Mac, puis relancez " + mono('npm install') + "."],
         ['EACCES: permission denied',
          "Une commande a été lancée avec " + mono('sudo') + " par le passé. Effacez le "
          "dossier " + mono('node_modules') + " avec " + mono('rm -rf node_modules') + " puis "
          "relancez " + mono('npm install') + " <b>sans</b> " + mono('sudo') + "."]],
        largeurs=[UTILE * 0.34, UTILE * 0.66]))

    a(PageBreak())

    # ---------------------------------------------------------------- page 9
    a(Paragraph("Mettre la borne à jour plus tard", sous_titre))
    a(Paragraph(
        "Quand une nouvelle version du contenu ou de l'application est prête, trois commandes "
        "suffisent depuis le dossier du projet.", corps_espace))
    a(commande('cd ~/borne/BorneAdmin', 'git pull', 'npm install'))

    a(Paragraph("Mémo des commandes", sous_titre))
    a(tableau(
        ['Commande', "Ce qu'elle fait"],
        [[mono('node -v'), "Vérifie que Node.js est installé (doit afficher v22.12 ou plus)"],
         [mono('git --version'), "Vérifie que Git est installé"],
         [mono('cd ~/borne/BorneAdmin'), "Se placer dans le dossier du projet"],
         [mono('npm install'), "Installer ou réparer les composants"],
         [mono('npm run appli'), "Lancer l'application"],
         [mono('git pull'), "Récupérer la dernière version du projet"],
         [mono('npm run reparer-electron'), "Retélécharger le moteur graphique"],
         [mono('open ~/borne/BorneAdmin'), "Ouvrir le dossier du projet dans le Finder"]],
        largeurs=[UTILE * 0.38, UTILE * 0.62]))

    a(Paragraph("Et ensuite ?", sous_titre))
    a(Paragraph(
        "Le guide n° 2, <i>Administrer le contenu</i>, explique comment entrer dans "
        "l'administration, créer et modifier des pages, et transporter une page d'un "
        "ordinateur à l'autre sur une clé USB. Il vaut pour Windows comme pour macOS : "
        "l'application y est exactement la même.", corps_espace))
    return p


def fabriquer(chemin):
    doc = BaseDocTemplate(
        chemin, pagesize=A4,
        leftMargin=MARGE, rightMargin=MARGE, topMargin=MARGE, bottomMargin=MARGE,
        title='Installer la borne sur un Mac — Borne du Musée des Transmissions',
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
    fabriquer(os.path.join(ICI, '1 - Installer la borne (macOS).pdf'))
