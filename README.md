# RekoltHt — Frontend (React + Vite)

Frontend React (Vite) de **RekoltHt**, une plateforme qui met en relation
acheteurs et vendeurs de produits agricoles en Haïti. Propose une page
d'accueil multilingue (Kreyòl / Français / English), l'authentification
(classique ou Google), la gestion du profil utilisateur, un parcours de
vérification vendeur (KYC), une carte Google Maps, des notifications en
temps réel et une installation en PWA (voir section dédiée plus bas).
Consomme une API REST + WebSocket externe (URL configurée via
`VITE_API_URL`).

## Prérequis

- Node.js 18+ et npm
- Une API backend compatible, accessible à l'URL renseignée dans `VITE_API_URL`
- Des clés API : Google Maps, Google OAuth Client ID, reCAPTCHA (voir étape 2)

## Installation étape par étape

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer les variables d'environnement

Créer un fichier `.env` à la racine du projet (non commité) :

```
VITE_API_URL=http://127.0.0.1:8000
VITE_GOOGLE_MAPS_KEY=
VITE_GOOGLE_CLIENT_ID=
VITE_RECAPTCHA_KEY=
```

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL de l'API (REST + WebSocket) consommée par le frontend |
| `VITE_GOOGLE_MAPS_KEY` | clé API Google Maps (cartes de localisation) |
| `VITE_GOOGLE_CLIENT_ID` | Client ID OAuth2 Google (connexion/inscription Google) |
| `VITE_RECAPTCHA_KEY` | clé site reCAPTCHA (protection du formulaire d'inscription) |

## Lancer le projet

```bash
npm run dev
```

Ouvrir l'URL affichée dans le terminal (par défaut **http://localhost:5173**).
Vérifier que l'API est bien joignable à l'URL renseignée dans
`VITE_API_URL`, sinon les appels API et le WebSocket échoueront.

## Autres scripts

```bash
npm run build     # build de production -> dist/
npm run preview   # prévisualise le build de production
npm run lint      # eslint
```

## Structure

```
src/
├── Acceuil/            # page d'accueil
├── Registration/       # authentification, profil, devenir vendeur (KYC)
├── Profil/             # store et pages du profil utilisateur
├── api/                # client HTTP (client.js), stores Zustand, WebSocket
├── components/         # composants partagés (cartes, selfie, chatbot, ...)
├── assets/
│   ├── CSS/            # feuilles de style par page/fonctionnalité
│   ├── Translate/      # i18n (fr.json, en.json, ht.json, i18n.jsx)
│   └── Departements/   # données géographiques Haïti (cascade département/commune/section)
├── pages/
└── hooks/
```

---

## PWA (Progressive Web App)

L'application est installable depuis le navigateur (bureau et mobile),
fonctionne partiellement hors-ligne, et apparaît sur l'écran d'accueil du
téléphone comme une app native. Mis en place via
[`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (Workbox), voir
`vite.config.js`.

### Ce que ça couvre

- **Installable** : icône + bannière "Installer l'application" dans Chrome/Edge
  (desktop et Android) et "Ajouter à l'écran d'accueil" sur Safari iOS. Ouvre
  l'app en plein écran (`display: standalone`), sans barre d'adresse.
- **Fonctionne partiellement hors-ligne** : le service worker précache l'app
  shell (JS/CSS/HTML/icônes) au premier chargement, donc l'app se réouvre
  même sans connexion. Les appels à l'API backend (`VITE_API_URL`) sont mis en
  cache en `NetworkFirst` (réseau si dispo, sinon la dernière réponse connue),
  et les images servies par le backend (photos produits, profils, ...) en
  `CacheFirst`. **Limite assumée** : seul ce qui a déjà été vu une fois reste
  consultable hors-ligne — envoyer un message, publier un produit, se
  connecter, etc. nécessitent toujours une connexion.
- **Mise à jour automatique** : `registerType: 'autoUpdate'` — une nouvelle
  version déployée est appliquée toute seule au prochain chargement, sans
  bannière "mettre à jour" à gérer côté UI.

### Fichiers concernés

- `vite.config.js` — configuration du plugin (`manifest`, règles de cache
  `workbox.runtimeCaching`, précaching de l'app shell).
- `src/main.jsx` — enregistrement du service worker
  (`import('virtual:pwa-register')`).
- `index.html` — balises `theme-color`, `apple-touch-icon`,
  `apple-mobile-web-app-*` (le `<link rel="manifest">` est injecté
  automatiquement au build).
- `public/pwa-192x192.png`, `public/pwa-512x512.png`,
  `public/maskable-icon-512x512.png`, `public/apple-touch-icon.png` — icônes
  générées à partir de `src/assets/Images/Icon.jpg` (logo "RH").

### Comment tester

⚠️ **`npm run dev` seul ne suffit pas pour un vrai test d'installabilité** :
`devOptions.enabled: true` permet bien d'avoir un service worker actif en dev
(pratique pour développer), mais il ne précache pas le build de production —
pour tester l'installation et le mode hors-ligne dans les conditions réelles,
utiliser le build de production :

```bash
npm run build
npm run preview
```

Puis ouvrir l'URL affichée (par défaut **http://localhost:4173**) :

- **Desktop (Chrome/Edge)** : icône d'installation dans la barre d'adresse,
  ou menu ⋮ → "Installer RekoltHt".
- **Android (Chrome)** : bannière "Ajouter à l'écran d'accueil" ou menu ⋮ →
  "Installer l'application".
- **iOS (Safari)** : bouton Partager → "Sur l'écran d'accueil" (Safari
  n'affiche jamais de bannière automatique — c'est une limite d'iOS, pas de
  cette configuration).
- **Tester le hors-ligne** : une fois l'app ouverte au moins une fois,
  couper le réseau (onglet Réseau des DevTools → "Offline", ou mode avion sur
  mobile) puis recharger : l'app shell doit toujours s'afficher.

**Sur un téléphone physique** : un service worker exige HTTPS, sauf sur
`localhost`. Pour tester `npm run preview` depuis un téléphone sur le même
réseau Wi-Fi, soit servir l'app derrière un tunnel HTTPS (ex. `ngrok`), soit
tester directement sur le domaine de déploiement (déjà en HTTPS).

---

## Vérification vendeur (KYC) — nouveau sur cette branche (`become-seller`)

Transforme `Registration/DevenirVendeur.jsx` (ancien formulaire à plat) en
wizard à 6 étapes, branché sur les vrais endpoints KYC du backend
(`/Registration/verification/...`).

### Étapes du wizard

1. **Type de compte + choix du document** — détecte automatiquement
   individuel/entreprise via `profil.est_entreprise` (jamais via `role`, qui
   ne vaut jamais `"entreprise"`). Choix passeport / permis / carte
   d'identité pour un individuel.
2. **Upload des documents** — recto (+ verso si carte d'identité), ou
   certificat de patente pour une entreprise ; **numéro de la pièce saisi
   manuellement** (Paspò nimewo, Numéro de carte, NIF ou Numéro de patente
   selon le type), comparé côté serveur à ce que l'OCR extrait.
3. **Selfie** (individuel uniquement) — `components/CaptureSelfie.jsx`,
   capture via `getUserMedia`, repli sur `<input type="file" capture="user">`
   si la caméra est refusée/indisponible.
4. **Localisation** — cascade département/commune/section (inchangée) + point
   GPS précis via `components/MapSelectionGPS.jsx` (variante cliquable de
   `MapHaiti.jsx` : centre sur la géolocalisation navigateur ou une recherche
   d'adresse Google Geocoding en repli, marqueur posé uniquement au clic).
5. **Récapitulatif** — relit toutes les informations saisies, bouton
   **Prévisualiser le contrat** (ouvre le PDF généré côté serveur sans rien
   soumettre), puis envoi réel (`FormData` multipart, vrais fichiers).
6. **Statut** — `en_attente` (poll `/verification/statut/` + WebSocket
   `verification.updated` en temps réel), puis résultat final : `verifie`
   (lien vers le contrat PDF signé) ou `echoue` (motif exact affiché).

### Autres pièces ajoutées

- **Reprise après rechargement** (`localStorage`) — restaure l'étape,
  département/commune/section, type de document et point GPS. Limite
  assumée : les fichiers (`File`) ne survivent jamais à un rechargement
  (contrainte du navigateur), donc l'étape restaurée est toujours plafonnée à
  la plus haute étape réellement valide (au mieux, l'étape d'upload).
- **`components/ChatbotVendeur.jsx`** — bulle de conseils flottante,
  contextuelle selon l'étape/le statut. Ce n'est pas un agent conversationnel
  (aucun backend de chat n'existe dans ce projet) : messages statiques
  uniquement.
- **`api/auth.js`** — `soumettreVerification(formData)`,
  `obtenirStatutVerification()`, `previsualiserContrat(formData)`.
- **`api/globalStore.js`** — le dispatch WebSocket gère désormais
  l'événement `verification.updated` en plus de `utilisateur.updated`/`profil.updated`.
- Toutes les nouvelles clés de traduction sont sous `seller.*` dans les 3
  fichiers (`fr.json`, `en.json`, `ht.json`) — aucune clé existante modifiée.

### Limites connues / hors scope de cette branche

- Le champ département/section communale reste un filtre purement côté
  client (rien n'est envoyé à l'API pour ces deux niveaux) — seule `commune`
  est réellement transmise et persistée.
- Si la vérification (reconnaissance faciale, patente) échoue côté serveur,
  le frontend affiche simplement le motif d'échec renvoyé par l'API — il n'y
  a pas de logique de repli ou de nouvelle tentative automatique côté client.
