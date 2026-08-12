'use strict'

/**
 * Passerelle entre le processus principal (qui a accès au disque) et
 * l'interface (qui n'y a pas accès).
 *
 * Tout ce que l'interface peut demander est listé ici, nommément. Ajouter une
 * capacité, c'est ajouter une ligne dans ce fichier — jamais ailleurs. C'est
 * volontaire : ce fichier se lit en dix secondes et dit exactement ce que
 * l'interface a le droit de faire.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('borne', {
  /** Lit le contenu.json du dossier de contenu et le renvoie tel quel. */
  lireContenu: () => ipcRenderer.invoke('contenu:lire'),
  /** Remplace le contenu.json (écriture atomique, voir principal.cjs). */
  ecrireContenu: (manifeste) => ipcRenderer.invoke('contenu:ecrire', manifeste),
  /** Fenêtre de choix de fichier puis copie dans medias/. Null si annulé. */
  importerMedia: (type) => ipcRenderer.invoke('medias:importer', type),
  /** Écrit dans medias/ une image fabriquée par l'interface (couverture vidéo). */
  enregistrerImage: (nom, donneesBase64) =>
    ipcRenderer.invoke('medias:enregistrer-image', nom, donneesBase64),
  /** Dépose un dossier « .bornepage » à l'endroit choisi. Null si annulé. */
  exporterPage: (donnees, fichiers) => ipcRenderer.invoke('page:exporter', donnees, fichiers),
  /** Ouvre un dossier « .bornepage » et rend son page.json. Null si annulé. */
  lireExportPage: () => ipcRenderer.invoke('page:lire-export'),
  /** Copie dans medias/ les fichiers d'un import ; rend les noms retenus. */
  importerMediasPage: (dossier, fichiers) =>
    ipcRenderer.invoke('page:importer-medias', dossier, fichiers),
  /** Ferme l'application. Appelé par l'administration seule (Ctrl + Maj + A). */
  quitter: () => ipcRenderer.invoke('app:quitter'),
})
