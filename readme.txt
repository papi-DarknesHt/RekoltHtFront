RekoltHT - Frontend React/Vite

Description du projet
---------------------
RekoltHT est une application frontend construite avec React et Vite pour une plateforme de mise en relation entre producteurs agricoles et acheteurs en Haïti. L'application propose une page d'accueil marketing, une interface de connexion et d'inscription, un panneau de carte Google Maps, et une communication avec un backend via API REST et WebSocket.

Fonctionnalités principales
---------------------------
- Page d'accueil avec sections : hero, produits récents, étapes du processus, carte de localisation et ressources d'aide.
- Authentification utilisateur avec onglets "Konekte" et "Enskri".
- Inscription protégée par reCAPTCHA.
- Gestion d'état utilisateur et de connexion avec Zustand.
- Communication API REST vers un backend local sur `http://localhost:8000`.
- Connexion WebSocket globale pour l'état en temps réel.
- Google Maps pour afficher des marqueurs de produits sur la carte d'Haïti.
- Composant de route privée (`RoutePrivee`) prévu pour les pages protégées.

Structure du projet
-------------------
- `package.json` : configuration du projet, dépendances et scripts.
- `vite.config.js` : configuration de Vite pour le build et le serveur de développement.
- `public/` : ressources publiques du build.
- `src/` : code source principal de l'application.
  - `src/App.jsx` : composant racine et configuration des routes.
  - `src/main.jsx` : point d'entrée qui monte l'application React.
  - `src/index.css` et `src/App.css` : styles globaux et styles d'application.
  - `src/Acceuil/` : page d'accueil et styles associés.
  - `src/Registration/` : écrans d'authentification et store côté front.
  - `src/api/` : client HTTP, API d'authentification, WebSocket et store global.
  - `src/components/` : composants réutilisables (navbar, cartes, routes privées).
  - `src/assets/` : images, styles CSS et ressources visuelles.

Détails des fichiers et rôles
----------------------------
Fichiers racine
---------------
- `package.json` : dépendances (`react`, `react-dom`, `react-router-dom`, `zustand`, `@react-google-maps/api`, `react-google-recaptcha`, etc.) et scripts : `dev`, `build`, `lint`, `preview`.
- `README.md` : documentation du template Vite + React.
- `readme.txt` : documentation du projet actuelle.

Source applicative
------------------
- `src/main.jsx` : initialise l'application React et montez `App` dans l'élément DOM `#root`.
- `src/App.jsx` : configure `BrowserRouter`, appelle `useGlobalSocket()` pour la connexion WebSocket globale, et définit les routes Actuelles `/` pour `HomePage` et `/auth` pour `RekoltHtAuth`. Le composant importe également `RoutePrivee`, `NavBar` et `TestPage` pour de futures extensions.

Page d'accueil
---------------
- `src/Acceuil/HomePage.jsx` : page d'accueil principale.
  - Affiche `NavBar` et un hero marketing.
  - Propose un champ de recherche sur la page.
  - Affiche un carrousel de produits récents avec navigation précédente/suivante.
  - Présente les étapes du processus utilisateur.
  - Montre une carte avec `MapHaiti` et une légende de proximité.
  - Affiche une section "Sant Ed" pour les guides d'aide.
  - Inclut un footer avec liens de navigation et informations de contact.

Authentification
----------------
- `src/Registration/Authentification.jsx` : composant de connexion et d'inscription.
  - Bascule entre les onglets "Konekte" et "Enskri".
  - Gère les champs de formulaire : nom, prénom, e-mail, mot de passe, téléphone, rôle, et confirmation de mot de passe.
  - Intègre reCAPTCHA pour la validation de l'inscription.
  - Appelle `connexion` ou `inscription` via `useAuthStore`.
  - Affiche un message de succès puis redirige vers la page d'accueil.
- `src/Registration/AuthentificationStore.js` : store Zustand pour l'authentification.
  - Contient l'utilisateur actuel (`utilisateur`), le statut de connexion (`isConnected`), `loading` et `error`.
  - Définit les actions `inscription`, `connexion`, `deconnexion` et `clearError`.
  - Met à jour le store en fonction de la réponse du backend.

API et communication
--------------------
- `src/api/client.js` : client HTTP générique.
  - Définit `BASE_URL = http://localhost:8000`.
  - Gère les requêtes `GET`, `POST`, `PUT` et `DELETE` via `fetch`.
  - Ajoute un en-tête `Authorization: Token <token>` si un token est présent dans `localStorage`.
  - Retourne le JSON du backend ou lève une erreur si la requête échoue.
- `src/api/auth.js` : API d'authentification.
  - `inscription(data)` : envoie les données d'inscription.
  - `connexion(data)` : envoie les identifiants, stocke le token et les informations utilisateur.
  - `deconnexion()` : vide le token et les informations utilisateur de `localStorage`.
  - `getprofil()` et `updateprofil(data)` : endpoints pour gérer le profil utilisateur.
  - `isConnected()` : vérifie si un token est présent.
  - `getUtilisateur()` : récupère l'utilisateur stocké.
- `src/api/useGlobalSocket.js` : hook de connexion WebSocket.
  - Se connecte à `ws://127.0.0.1:8000/ws/global/`.
  - Met à jour l'état `connected` via `useGlobalStore`.
  - Réessaie automatiquement la connexion après une fermeture.
  - Traite les messages entrants en appelant `dispatch(JSON.parse(event.data))`.
- `src/api/globalStore.js` : store global Zustand.
  - Stocke l'état de connexion WebSocket (`connected`).
  - Offre une fonction `dispatch` pour traiter les messages WebSocket.
  - Prépare le store à étendre la logique de traitement selon `type`.

Composants réutilisables
------------------------
- `src/components/NavBar.jsx` : barre de navigation.
  - Affiche le logo et des liens vers les sections principales.
  - Affiche un bouton de connexion/déconnexion selon l'état utilisateur.
  - Affiche le prénom de l'utilisateur connecté.
- `src/components/MapHaiti.jsx` : composant de carte Google Maps.
  - Charge l'API Google Maps avec `VITE_GOOGLE_MAPS_KEY`.
  - Centre la carte sur Haïti et affiche des marqueurs de produits.
  - Utilise des couleurs de marqueur pour indiquer la distance.
  - Affiche un badge du nombre de produits actifs.
- `src/components/RoutePrivee.jsx` : route protégée.
  - Redirige vers `/auth` si l'utilisateur n'est pas connecté.
  - Vu que le composant n'est pas encore utilisé dans `App.jsx`, il sert de base pour des routes futures.

Pages et tests
---------------
- `src/testpage.jsx` : page de test et exemple.
  - Interroge l'endpoint `/test/` toutes les 3 secondes.
  - Affiche l'état de la connexion WebSocket et les données reçues.
  - Utile pour vérifier la communication backend et le store global.

Ressources et styles
---------------------
- `src/index.css` : styles globaux de base.
- `src/App.css` : styles généraux de l'application.
- `src/assets/CSS/Authentification.css` : styles du formulaire d'authentification.
- `src/assets/CSS/HomePage.css` : styles de la page d'accueil.
- `src/assets/Images/Asset5.svg` : logo principal utilisé dans le header et l'authentification.
- `src/assets/Images/Logo.png` : logo supplémentaire.
- `src/assets/hero.png`, `src/assets/vite.svg`, `src/assets/react.svg` : ressources d'assets du projet.

Notes de déploiement
--------------------
- Le backend attendu est sur `http://localhost:8000`.
- La carte Google Maps requiert la variable d'environnement `VITE_GOOGLE_MAPS_KEY`.
- Les endpoints d'authentification attendus sont :
  `/Registration/inscription/`, `/Registration/connexion/`,
  `/Registration/deconnexion/`, `/Registration/profil`.
- Le frontend stocke le token et l'utilisateur connecté dans `localStorage`.
- `RoutePrivee` existe pour sécuriser des pages futures mais n'est pas activée aujourd'hui.

Comment lancer le projet
-----------------------
1. Installer les dépendances : `npm install`
2. Démarrer le serveur de développement : `npm run dev`
3. Ouvrir l'application dans le navigateur via l'URL affichée par Vite.

Résumé
------
Ce projet est un frontend React/Vite pour une plateforme agricole haïtienne. Il combine une page d'accueil visuelle, une authentification sécurisée avec reCAPTCHA, une communication API/WebSocket, et une carte Google Maps pour localiser les produits.
