import React from 'react'
import { createRoot } from 'react-dom/client'
import Settings from './pages/Settings'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Settings />
  </React.StrictMode>,
)
