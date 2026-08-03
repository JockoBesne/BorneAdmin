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
})
