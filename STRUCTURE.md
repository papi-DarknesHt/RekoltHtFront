# Structure du projet — RekoltHtFront

Frontend **React (Vite)** de RekoltHt, une plateforme qui met en relation acheteurs et vendeurs de produits agricoles en Haïti. Consomme l'API REST + WebSocket du backend (`RekoltHtBackend`, voir `STRUCTURE.md` de ce dépôt).

> Note : un autre projet, `Frontend_P1` (Angular), existe sur la machine mais est **sans rapport** avec RekoltHt.

## 1. Stack technique

- **Build** : Vite 8 (`@vitejs/plugin-react`, pas d'alias/plugins supplémentaires).
- **UI** : React 19.2, composants fonctionnels + hooks uniquement (pas de classes).
- **Routing** : `react-router-dom` v7 (SPA client-side, pas de SSR).
- **Langage** : JavaScript/JSX pur (pas de TypeScript — `@types/react*` en dev seulement, pour l'IDE).
- **Gestion d'état** : Zustand (plusieurs petits stores dédiés, pas de store global unique).
- **Styles** : CSS classique par page/composant (`src/assets/CSS/`), pas de framework UI (pas de Tailwind/MUI/Bootstrap).
- Entrée : `index.html` → `src/main.jsx` (englobe `App` dans `GoogleOAuthProvider`) → `App.jsx`.

## 2. Arborescence (`src/`)

```
src/
├── main.jsx / App.jsx           # Point d'entrée, BrowserRouter, toutes les routes
├── api/                          # Client HTTP, stores liés à l'API/WebSocket
│   ├── client.js                  # Wrapper fetch (api.get/post/put/delete/postBlob)
│   ├── auth.js                    # AuthentificationApi — endpoints /Registration/*
│   ├── produits.js                 # ProduitsApi — endpoints /produits/*
│   ├── messagerie.js               # MessagerieApi — endpoints /messagerie/*
│   ├── globalStore.js              # useGlobalStore (zustand) — bus d'événements WebSocket
│   ├── useGlobalSocket.js          # Hook ouvrant/maintenant la connexion WebSocket
│   ├── messagerieBadgeStore.js     # Compteurs messages non lus / support en attente
│   └── applyListEvent.js           # Applique un événement WS (created/updated/deleted) à une liste
├── hooks/
│   └── useInactivityTimeout.js     # Déconnexion auto après 30 min d'inactivité
├── components/                    # Composants partagés
│   ├── NavBar.jsx                   # Barre de navigation (rôle admin/vendeur/acheteur, badges)
│   ├── Footer.jsx, language.jsx     # Pied de page, sélecteur de langue (ht/fr/en)
│   ├── ProductCard.jsx              # Tuile produit (listing)
│   ├── MapHaiti.jsx                 # Carte Google en lecture seule
│   ├── MapSelectionGPS.jsx          # Carte cliquable pour choisir un point GPS (wizard KYC)
│   ├── CaptureSelfie.jsx            # Capture selfie webcam (getUserMedia + fallback fichier)
│   ├── ChatbotVendeur.jsx           # Bulle de conseils statiques (PAS un vrai chat backend)
│   ├── RoutePrivee.jsx              # Garde d'authentification pour les routes
│   └── notification.jsx, copy.jsx   # Fichiers vides / non utilisés actuellement
├── Acceuil/HomePage.jsx           # Page d'accueil publique ("/")
├── Registration/                  # Authentification + onboarding vendeur
│   ├── Authentification.jsx         # Login/register (individuel/entreprise), mot de passe oublié, Google, reCAPTCHA
│   ├── AuthentificationStore.js     # useAuthStore (zustand) — état de session
│   └── DevenirVendeur.jsx           # Wizard KYC vendeur en 6 étapes (814 lignes)
├── Profil/
│   ├── ProfilAcheteur.jsx / ModifierProfil.jsx / ProfilStore.js
├── Produits/                      # Catalogue + gestion produits vendeur
│   ├── afficherProduits.jsx         # Catalogue public (filtres catégorie/département/commune)
│   ├── DetailProduit.jsx            # Détail produit public
│   ├── AjouterProduit.jsx / modifierProduits.jsx / mesProduits.jsx / suprimerProduit.jsx
│   ├── TableauDeBordVendeur.jsx     # Dashboard vendeur (historique de contacts, stats)
│   └── VendeurTabs.jsx
├── Messagerie/Messagerie.jsx      # Chat temps réel acheteur/vendeur
├── Support/ContacterAdmin.jsx     # Formulaire de support vendeur → admin
├── Admin/AdminDashboard.jsx       # Panel admin (utilisateurs, stats, revue KYC, support)
├── pages/aide.jsx, NotFound.jsx   # Aide/FAQ, 404
└── assets/
    ├── CSS/                       # Une feuille de style par page/composant
    ├── Translate/                 # i18n custom (fr.json, en.json, ht.json + i18n.jsx)
    ├── Departements/haiti_departements.json  # Cascade département → commune → section communale
    └── Produits/categorieProduits.json, Images/
```

## 3. Routing (`App.jsx`)

| Route | Composant | Accès |
|---|---|---|
| `/` | HomePage | public |
| `/auth` | Authentification (login/register/entreprise/reset) | public |
| `/profil` | ProfilAcheteur | privé |
| `/update_profil` | ModifierProfil | privé |
| `/Devenir_Vendeur` | DevenirVendeur (wizard KYC) | privé |
| `/produits` | Catalogue produits | public |
| `/produits/detail` | DetailProduit | public |
| `/produits/ajouter` | AjouterProduit | privé |
| `/produits/modifier` | ModifierProduit | privé |
| `/produits/mesProduits` | MesProduits | privé |
| `/produits/tableau-de-bord` | TableauDeBordVendeur | privé |
| `/produits/suprimerProduits` | SuprimerProduit | privé |
| `/messages` | Messagerie | privé |
| `/contacter-admin` | ContacterAdmin | privé |
| `/admin/dashboard` | AdminDashboard | privé (garde de route ; vérification de rôle gérée après connexion) |
| `/aide` | Aide | public |
| `*` | NotFound | public |

`AppContent` monte globalement `useGlobalSocket()` et `useInactivityTimeout()`, et affiche `<ChatbotVendeur/>` partout sauf sur `/messages`. À noter : `<NavBar/>` est actuellement **commenté** dans `App.jsx` — vérifier si elle est montée par page individuellement.

## 4. Communication avec le backend

- **URL de base** : variable d'env `VITE_API_URL` (fallback en dur sur `https://rekolthtbackend.onrender.com`). En local, `.env` définit `VITE_API_URL=http://localhost:8000`.
- **Client HTTP** : wrapper `fetch` fait maison dans `src/api/client.js` (pas d'axios) — `api.get/post/put/delete/postBlob`.
  - Ajoute automatiquement `Authorization: Token <token>` (style DRF token-auth, pas JWT Bearer) depuis `localStorage`.
  - `Content-Type: application/json` sauf si le body est `FormData` (upload multipart automatique).
  - Sur `401` avec un token stocké : nettoie `localStorage` (`token`, `utilisateur`, `entreprise`, `profil`) et redirige vers `/`.
- **Modules API par domaine** (`src/api/`) : `auth.js` (`/Registration/*`), `produits.js` (`/produits/*`), `messagerie.js` (`/messagerie/*`).
- **Temps réel** : WebSocket natif (pas socket.io) vers `wss://<host>/ws/global/` (dérivé de `VITE_API_URL`), token passé en query string. Géré par `src/api/useGlobalSocket.js` :
  - Reconnexion auto après 3s si coupure.
  - Dispatch des messages `{type, data}` dans `useGlobalStore`, qui les répartit par type (`verificationEvent`, `produitEvent`, `categorieEvent`, `utilisateurEvent`, `profilEvent`, `messageEvent`, `contactEvent`, `messageAdminEvent`) — chaque page s'abonne uniquement au type qui la concerne.
  - Note : `react-use-websocket` est une dépendance déclarée dans `package.json` mais la connexion réelle est une implémentation WebSocket native — vérifier si la librairie est encore utilisée ailleurs.

## 5. Authentification (côté frontend)

- **UI** : `Registration/Authentification.jsx` (onglets login/register individuel/register entreprise), flow mot de passe oublié (email → PIN 4 chiffres → nouveau mot de passe), reCAPTCHA (`react-google-recaptcha`) à l'inscription, connexion/inscription Google (`@react-oauth/google`).
- **État** : `AuthentificationStore.js` (`useAuthStore`, zustand) — `utilisateur`, `profil`, `entreprise`, `isConnected`, actions `inscription`, `connexion`, `deconnexion`, `googleConnexion`, `googleInscription`, gestion entreprise.
- **Stockage du token** : `localStorage` (`token`, `utilisateur`, `entreprise`, `profil`), pas de cookie httpOnly, pas de refresh token — un seul token DRF longue durée par session.
- **Garde de route** : `components/RoutePrivee.jsx` — redirige vers `/auth` si non connecté (vérifie juste la présence de session, pas le rôle par route ; la redirection par rôle admin se fait après connexion).
- **Déconnexion auto** : `useInactivityTimeout.js` — 30 min sans interaction → déconnexion + redirection. Revalide aussi la session (via `getprofil()`) quand l'onglet redevient visible, pour détecter une révocation de token depuis un autre navigateur.
- **Vérification KYC vendeur** : `DevenirVendeur.jsx` — wizard en 6 étapes (type de document → upload documents → selfie → localisation GPS → récap/aperçu contrat → suivi du statut par polling + WebSocket), progression persistée dans `localStorage` pour reprise après rechargement (les fichiers eux-mêmes ne survivent pas au rechargement).

## 6. Librairies tierces notables (`package.json`)

- `react-router-dom` v7 — routing.
- `zustand` — état global (plusieurs petits stores).
- `@react-google-maps/api` — cartes Google (localisation produits, sélection GPS KYC).
- `@react-oauth/google` — connexion/inscription Google.
- `react-google-recaptcha` — reCAPTCHA v2 sur les formulaires d'inscription.
- `react-use-websocket` — déclarée mais probablement inutilisée (implémentation WebSocket native à la place, à vérifier).
- `lucide-react` — icônes.

Aucune librairie de paiement, de kit UI, ni de gestion de formulaires (formulaires en `useState` manuel) ; i18n via un contexte React custom (pas i18next).

## 7. Configuration d'environnement

Variables (`.env`, non versionné) :

```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_MAPS_KEY=<clé>
VITE_RECAPTCHA_KEY=<clé>
VITE_GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
```

Consommées via `import.meta.env.VITE_*` (convention Vite). Pas de fichiers `environment.*.ts` séparés (pattern Angular, non applicable ici) — le switch dev/prod se fait uniquement via le fichier `.env` / variables au build, avec un fallback en dur sur l'URL de production.

## 8. Scripts (`package.json`)

```bash
npm run dev       # serveur de dev (http://localhost:5173)
npm run build     # build de production -> dist/
npm run lint      # eslint
npm run preview   # prévisualisation du build de production
```

## 9. Points d'attention

- **`README.md` contient actuellement des marqueurs de conflit git non résolus** (`<<<<<<< Updated upstream` / `=======` / `>>>>>>> Stashed changes`) — le fichier est dans un état de merge cassé sur disque, à nettoyer. Le contenu du côté "Stashed changes" (la version française plus complète) documente bien le projet : description, prérequis, setup, structure, et une section dédiée à la vérification vendeur (KYC).
- Limitation documentée côté frontend : les champs département/section communale de l'entreprise ne servent qu'au filtrage côté client (seule la commune est persistée côté API).
- Pas de retry/fallback automatique côté frontend si la vérification serveur (reconnaissance faciale, patente) échoue — le frontend affiche simplement la raison d'échec renvoyée par le serveur.
- `react-use-websocket` en dépendance vs. hook WebSocket natif fait main — à vérifier/nettoyer.
