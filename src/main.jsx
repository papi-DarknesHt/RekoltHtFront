// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './api/themeStore.js' // applique le thème (clair/sombre) avant le premier rendu
import App from './App.jsx'
import { GoogleOAuthProvider } from "@react-oauth/google";

createRoot(document.getElementById('root')).render(
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <App />
    </GoogleOAuthProvider>
)
