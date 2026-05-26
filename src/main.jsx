// Apply saved theme BEFORE React mounts so there's no flash-of-wrong-theme.
// The CSS treats DARK as the :root default and [data-theme="light"] as the
// LIGHT override, so we always set the attribute explicitly.
try {
  const saved = localStorage.getItem("ddc.theme");
  const theme = saved === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
} catch {}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
