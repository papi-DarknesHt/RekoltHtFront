# RekoltHtFront

Frontend React (Vite) de la plateforme RekoltHt — mise en relation
acheteurs/vendeurs en Haïti. Communique avec le backend Django
(`RekoltHtBackend`) via API REST + WebSocket.

## Stack

- React 19 + Vite 8
- Zustand — stores (`useAuthStore`, `useProfilStore`, `useGlobalStore`)
- react-router-dom 7
- `@react-google-maps/api` — cartes (localisation, sélection GPS)
- `@react-oauth/google` — connexion/inscription Google
- WebSocket natif (`useGlobalSocket.js`) — notifications temps réel, avec repli
  automatique sur polling si la connexion échoue
- i18n maison (`src/assets/Translate/i18n.jsx`) — fr / en / ht (Kreyòl Ayisyen)

## Installation

```bash
npm install
```

Créer un fichier `.env` à la racine (non commité) :
```
VITE_API_URL=http://127.0.0.1:8000
VITE_GOOGLE_MAPS_KEY=
VITE_GOOGLE_CLIENT_ID=
VITE_RECAPTCHA_KEY=
```

## Scripts

```bash
npm run dev       # serveur de développement (HMR)
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
  client (aucun champ backend correspondant n'existe, avant ou après cette
  branche) — seule `commune` est réellement persistable.
- La reconnaissance faciale et la vérification patente (backend) dépendent
  d'une infrastructure optionnelle (voir `RekoltHtBackend/README.txt`, section
  6) — si elle n'est pas configurée côté serveur, la demande échoue proprement
  avec un motif clair plutôt que de rester bloquée.
