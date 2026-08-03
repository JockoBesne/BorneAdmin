import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],

  // Electron ouvre le fichier construit depuis le disque, pas depuis un
  // serveur web. Les adresses des ressources doivent donc être relatives :
  // sans cette ligne, la page se charge mais reste blanche.
  base: './',

  // « @borne/contenu » est du TypeScript source, relié par npm workspaces et
  // non un paquet publié : Vite doit le compiler normalement plutôt que de
  // tenter de le pré-empaqueter comme une dépendance externe.
  optimizeDeps: {
    exclude: ['@borne/contenu'],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
