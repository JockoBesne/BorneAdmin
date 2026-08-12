/** Ce que la passerelle (electron/passerelle.cjs) met à disposition de l'interface. */

export {}

declare global {
  interface Window {
    borne: {
      lireContenu: () => Promise<unknown>
      ecrireContenu: (manifeste: unknown) => Promise<void>
      /** Plusieurs fichiers peuvent être choisis d'un coup : liste, vide si annulé. */
      importerMedia: (
        type: 'image' | 'video',
      ) => Promise<{ chemin: string; octets: number; empreinte: string }[]>
      enregistrerImage: (
        nom: string,
        donneesBase64: string,
      ) => Promise<{ chemin: string; octets: number } | null>
      /** Ferme l'application (administration seule). */
      quitter: () => Promise<void>
    }
  }
}
