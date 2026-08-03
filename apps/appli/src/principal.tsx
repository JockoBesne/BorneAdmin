import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@borne/contenu/rendu/modeles.css'
import './appli.css'
import { App } from './App.jsx'

const racine = document.getElementById('racine')
if (!racine) throw new Error('élément #racine introuvable')

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
