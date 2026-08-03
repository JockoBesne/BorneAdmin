/** Ce que la passerelle (electron/passerelle.cjs) met à disposition de l'interface. */

export {}

declare global {
  interface Window {
    borne: {
      lireContenu: () => Promise<unknown>
      ecrireContenu: (manifeste: unknown) => Promise<void>
      importerMedia: (
        type: 'image' | 'video',
      ) => Promise<{ chemin: string; octets: number; empreinte: string } | null>
    }
  }
}
