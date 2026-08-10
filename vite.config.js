import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // même valeur par défaut que src/api/client.js::BASE_URL — sert à savoir
  // quelles requêtes (API backend) le service worker doit mettre en cache
  const apiOrigin = new URL(env.VITE_API_URL || 'https://rekolthtbackend.onrender.com').origin

  return {
    plugins: [
      react(),
      VitePWA({
        // le service worker se met à jour tout seul en arrière-plan et prend
        // le relais au prochain chargement — pas de bannière "nouvelle
        // version disponible" à gérer côté UI
        registerType: 'autoUpdate',
        // enregistrement fait à la main dans src/main.jsx (virtual:pwa-register)
        // plutôt que par l'injection automatique du plugin
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'RekoltHt',
          short_name: 'RekoltHt',
          description:
            "RekoltHt met en relation acheteurs et vendeurs de produits agricoles en Haïti.",
          lang: 'fr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait-primary',
          // couleurs alignées sur --rk-bg / --rk-green (src/index.css)
          background_color: '#f6f4f1',
          theme_color: '#2f4a3c',
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        // permet de tester l'installation/le service worker directement en
        // `npm run dev` (sinon seul `npm run build` + `npm run preview`
        // génère un vrai service worker précaché — voir README.md > PWA)
        devOptions: { enabled: true, type: 'module' },
        workbox: {
          // précache l'app shell (JS/CSS/HTML/images locales) — ce qui rend
          // l'app installable et utilisable hors-ligne pour tout ce qui a déjà
          // été chargé une fois
          globPatterns: ['**/*.{js,css,html,ico,svg,png,jpg,jpeg,webp,woff2}'],
          // SPA (react-router) : toute navigation non précachée retombe sur
          // l'app shell plutôt que sur une erreur réseau hors-ligne
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/(assets)\//],
          runtimeCaching: [
            {
              // réponses JSON de l'API backend (produits, conversations, profil…) :
              // réseau en priorité, mais on retombe sur la dernière copie
              // connue si hors-ligne/backend injoignable — permet de
              // re-consulter ce qu'on a déjà vu sans connexion
              urlPattern: ({ url, request }) =>
                url.origin === apiOrigin && request.method === 'GET',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'rekoltht-api',
                networkTimeoutSeconds: 8,
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }, // 24h
              },
            },
            {
              // photos produits/profil/KYC servies par le backend (media/)
              urlPattern: ({ url, request }) =>
                url.origin === apiOrigin && request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'rekoltht-media',
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30j
              },
            },
          ],
        },
      }),
    ],
  }
})
