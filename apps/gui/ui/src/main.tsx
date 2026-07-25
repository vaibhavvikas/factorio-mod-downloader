import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
