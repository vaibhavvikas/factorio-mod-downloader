import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Bundled offline fonts
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'

import './index.css'
import App from './App.tsx'

// Disable default web browser context menu globally for desktop native feel
if (typeof window !== 'undefined') {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  }, false);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
