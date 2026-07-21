# React + Vite

<<<<<<< Updated upstream
This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.
=======
Frontend React (Vite) de **RekoltHt**, une plateforme qui met en relation
acheteurs et vendeurs de produits agricoles en Haïti. Propose une page
d'accueil multilingue (Kreyòl / Français / English), l'authentification
(classique ou Google), la gestion du profil utilisateur, un parcours de
vérification vendeur (KYC), une carte Google Maps et des notifications en
temps réel. Consomme une API REST + WebSocket externe (URL configurée via
`VITE_API_URL`).
>>>>>>> Stashed changes

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

<<<<<<< Updated upstream
## React Compiler
=======
## Prérequis

- Node.js 18+ et npm
- Une API backend compatible, accessible à l'URL renseignée dans `VITE_API_URL`
- Des clés API : Google Maps, Google OAuth Client ID, reCAPTCHA (voir étape 2)

## Installation étape par étape

### 1. Installer les dépendances
>>>>>>> Stashed changes

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

<<<<<<< Updated upstream
## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
=======
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
>>>>>>> Stashed changes
