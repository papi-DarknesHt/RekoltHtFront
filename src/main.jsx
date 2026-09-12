// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './api/themeStore.js' // applique le thème (clair/sombre) avant le premier rendu
import App from './App.jsx'
import { GoogleOAuthProvider } from "@react-oauth/google";
// PWA : enregistre le service worker généré par vite-plugin-pwa (voir
// vite.config.js). registerType "autoUpdate" -> la nouvelle version prend le
// relais toute seule (aucune bannière "mettre à jour" à gérer côté UI). Ce
// module virtuel n'existe qu'avec le plugin actif (build, ou `npm run dev`
// grâce à devOptions.enabled) — voir README.md > PWA.
if ("serviceWorker" in navigator) {
    import("virtual:pwa-register").then(({ registerSW }) => {
        registerSW({ immediate: true });
    });
}

createRoot(document.getElementById('root')).render(
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <App />
    </GoogleOAuthProvider>
)
