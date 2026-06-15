RekoltHT - Frontend React/Vite

Description du projet
---------------------
RekoltHT est une application frontend construite avec React et Vite pour une plateforme de mise en relation entre producteurs agricoles et acheteurs en Haïti. L'application propose une page d'accueil marketing, une interface de connexion et d'inscription (avec authentification classique et Google OAuth), une gestion complète du profil utilisateur, une interface multilingue (Kreyòl, Français, English), un panneau de carte Google Maps, et une communication avec un backend via API REST et WebSocket.

Fonctionnalités principales
---------------------------
- Page d'accueil avec sections : hero, produits récents, étapes du processus, carte de localisation et ressources d'aide.
- Authentification utilisateur avec onglets "Konekte" et "Enskri".
- Connexion et inscription via Google OAuth (en plus du formulaire classique).
- Inscription protégée par reCAPTCHA, avec géolocalisation GPS et validation en temps réel de la confirmation du mot de passe.
- Gestion d'état utilisateur et de connexion avec Zustand.
- Page de profil (consultation) et page de modification du profil (informations personnelles, adresse via carte, photo de profil, changement de mot de passe).
- Système multilingue (Kreyòl Ayisyen, Français, English) avec sélecteur de langue persistant.
- Pied de page (Footer) réutilisable et traduit, affiché sur les pages principales.
- Communication API REST vers un backend local sur `http://localhost:8000`.
- Connexion WebSocket globale pour l'état en temps réel.
- Google Maps pour afficher des marqueurs de produits sur la carte d'Haïti et pour choisir une adresse dans le profil.
- Composant de route privée (`RoutePrivee`) prévu pour les pages protégées.

Structure du projet
-------------------
- `package.json` : configuration du projet, dépendances et scripts.
- `vite.config.js` : configuration de Vite pour le build et le serveur de développement.
- `public/` : ressources publiques du build.
- `src/` : code source principal de l'application.
  - `src/App.jsx` : composant racine et configuration des routes.
  - `src/main.jsx` : point d'entrée qui monte l'application React (avec le fournisseur Google OAuth).
  - `src/index.css` et `src/App.css` : styles globaux et styles d'application.
  - `src/Acceuil/` : page d'accueil et styles associés.
  - `src/Registration/` : écrans d'authentification et store côté front.
  - `src/Profil/` : pages et store de gestion du profil utilisateur (consultation et modification).
  - `src/api/` : client HTTP, API d'authentification, WebSocket et store global.
  - `src/components/` : composants réutilisables (navbar, footer, sélecteur de langue, cartes, routes privées).
  - `src/assets/` : images, styles CSS, ressources visuelles et fichiers de traduction (i18n).

Détails des fichiers et rôles
----------------------------
Fichiers racine
---------------
- `package.json` : dépendances (`react`, `react-dom`, `react-router-dom`, `zustand`, `@react-google-maps/api`, `@react-oauth/google`, `react-google-recaptcha`, `lucide-react`, `react-use-websocket`, etc.) et scripts : `dev`, `build`, `lint`, `preview`.
- `README.md` : documentation du template Vite + React.
- `readme.txt` : documentation du projet actuelle.

Source applicative
------------------
- `src/main.jsx` : initialise l'application React, monte `App` dans l'élément DOM `#root` et l'enveloppe dans `GoogleOAuthProvider` (clé `VITE_GOOGLE_CLIENT_ID`) pour activer la connexion/inscription Google.
- `src/App.jsx` : configure `BrowserRouter`, enveloppe l'application dans `TranslationProvider` (i18n), appelle `useGlobalSocket()` pour la connexion WebSocket globale, et définit les routes `/` pour `HomePage`, `/auth` pour `RekoltHtAuth`, `/profil` pour `ProfilAcheteur` et `/update_profil` pour `ModifierProfil`. La `NavBar` est désormais affichée directement par chaque page plutôt qu'au niveau racine. Le composant importe également `RoutePrivee` et `TestPage` pour de futures extensions (route `/test` désactivée).

Page d'accueil
---------------
- `src/Acceuil/HomePage.jsx` : page d'accueil principale.
  - Affiche `NavBar` et un hero marketing.
  - Propose un champ de recherche sur la page.
  - Affiche un carrousel de produits récents avec navigation précédente/suivante.
  - Présente les étapes du processus utilisateur.
  - Montre une carte avec `MapHaiti` et une légende de proximité.
  - Affiche une section "Sant Ed" pour les guides d'aide.
  - Tous les textes affichés passent par `useTranslation()` (i18n) pour s'adapter à la langue choisie.
  - Inclut le composant `Footer` avec liens de navigation et informations de contact.

Authentification
----------------
- `src/Registration/Authentification.jsx` : composant de connexion et d'inscription.
  - Bascule entre les onglets "Konekte" et "Enskri".
  - Gère les champs de formulaire : nom, prénom, e-mail, mot de passe, téléphone, commune, ville, pays, et confirmation de mot de passe.
  - Valide en temps réel la correspondance entre le mot de passe et sa confirmation.
  - Récupère automatiquement la position GPS de l'utilisateur lors de l'inscription (latitude/longitude).
  - Intègre reCAPTCHA pour la validation de l'inscription.
  - Propose la connexion et l'inscription via Google OAuth (`useGoogleLogin`), en plus du formulaire classique.
  - Appelle `connexion`, `inscription`, `googleConnexion` ou `googleInscription` via `useAuthStore`.
  - Affiche un message de succès puis redirige vers la page d'accueil.
- `src/Registration/AuthentificationStore.js` : store Zustand pour l'authentification.
  - Contient l'utilisateur actuel (`utilisateur`), le profil (`profil`), le statut de connexion (`isConnected`), `loading` et `error`.
  - Définit les actions `inscription`, `connexion`, `deconnexion`, `googleConnexion`, `googleInscription`, `modifierUtilisateur`, `modifierMotDePasse` et `clearError`.
  - Met à jour le store et le `localStorage` en fonction de la réponse du backend.

Profil utilisateur
-------------------
- `src/Profil/ProfilAcheteur.jsx` : page de consultation du profil (route `/profil`).
  - Affiche `NavBar` et une barre latérale avec l'utilisateur connecté et un bouton de déconnexion.
  - Récupère le profil réel (bio, adresse, photo de profil, rôle, ...) via `useProfilStore.afficherProfil()` au montage.
  - Affiche la carte d'identité (photo, nom, rôle, localisation), les informations de contact (email, téléphone, adresse de livraison), la liste des vendeurs contactés, une section "Avis et Commentaires" et la gestion du compte (e-mail, sécurité, notifications).
  - Bouton "Modifier le profil" qui redirige vers `/update_profil`.
  - Affiche le composant `Footer` en bas de page.
- `src/Profil/ModifierProfil.jsx` : page de modification du profil (route `/update_profil`).
  - Affiche `NavBar`, une barre latérale avec deux onglets : "Personal Info" et "Sécurité".
  - Onglet "Personal Info" : modification de la photo de profil (aperçu local + envoi en base64), du nom, prénom, bio, e-mail, téléphone et adresse de livraison (avec sélection sur `MapHaiti`).
  - Onglet "Sécurité" : changement de mot de passe (ancien, nouveau, confirmation) avec vérification de correspondance.
  - Synchronise le formulaire avec les données de `useAuthStore` (utilisateur) et `useProfilStore` (profil) au chargement.
  - Enregistre via `modifierUtilisateur` et `modifierProfil` (bouton "Sauvegarder les modifications") et via `modifierMotDePasse` (bouton "Changer le mot de passe"), avec affichage de messages de succès/erreur.
  - Affiche le composant `Footer` en bas de page.
- `src/Profil/ProfilStore.js` : store Zustand pour le profil utilisateur.
  - Contient `profil` (initialisé depuis `localStorage`), `loading` et `error`.
  - Définit les actions `afficherProfil` (GET du profil) et `modifierProfil` (mise à jour bio/adresse/photo/rôle, ...), qui synchronisent le store et `localStorage`.
  - Définit `clearError` pour réinitialiser les erreurs.

Internationalisation (i18n)
----------------------------
- `src/assets/Translate/i18n.jsx` : fournit `TranslationProvider` et le hook `useTranslation()`.
  - Gère la langue active (`ht` par défaut), persistée dans `localStorage`.
  - Expose `t(path, params)` pour récupérer une traduction à partir d'un chemin de clés (ex. `"home.heroTitleLine1"`), avec interpolation de paramètres (ex. `{prenom}`).
  - Expose la liste des langues disponibles (`ht`, `fr`, `en`).
- `src/assets/Translate/ht.json`, `fr.json`, `en.json` : dictionnaires de traduction (Kreyòl Ayisyen, Français, English) pour la navigation, la page d'accueil et le pied de page.
- `src/components/language.jsx` : sélecteur de langue (menu déroulant) affiché dans la `NavBar`, basé sur `useTranslation()`.

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
  - `googleConnexion(data)` et `googleInscription(data)` : authentification via Google OAuth.
  - `getprofil()` : récupère le profil de l'utilisateur connecté (lecture uniquement).
  - `modifierUtilisateur(data)` : met à jour nom, prénom, e-mail et téléphone.
  - `modifierProfil(data)` : met à jour bio, adresse, commune, ville, pays, photo de profil et rôle.
  - `modifierMotDePasse(data)` : change le mot de passe de l'utilisateur.
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
  - Affiche le logo, les liens de navigation traduits (`useTranslation`) et le sélecteur de langue (`Language`).
  - Affiche un menu utilisateur déroulant (nom, e-mail, lien vers le profil, déconnexion) si l'utilisateur est connecté, sinon un bouton de connexion.
- `src/components/Footer.jsx` : pied de page réutilisable et traduit.
  - Affiche le logo, un slogan, des liens de navigation et une colonne d'informations (à propos, aide, conditions, contact).
  - Utilisé par `HomePage`, `ProfilAcheteur` et `ModifierProfil`.
- `src/components/language.jsx` : sélecteur de langue (voir section "Internationalisation").
- `src/components/MapHaiti.jsx` : composant de carte Google Maps.
  - Charge l'API Google Maps avec `VITE_GOOGLE_MAPS_KEY`.
  - Centre la carte sur Haïti et affiche des marqueurs de produits.
  - Utilise des couleurs de marqueur pour indiquer la distance.
  - Affiche un badge du nombre de produits actifs.
  - Également intégré dans `ModifierProfil` pour choisir l'adresse de livraison.
- `src/components/RoutePrivee.jsx` : route protégée.
  - Censé rediriger vers `/auth` si l'utilisateur n'est pas connecté.
  - N'est pas encore utilisé dans `App.jsx` ; sert de base pour des routes futures (à corriger : il référence `AuthentificationApi` comme un store).
- `src/components/copy.jsx` : ancienne version de `NavBar.jsx` conservée comme sauvegarde, non utilisée par l'application.
- `src/components/notification.jsx` : fichier vide réservé pour une future fonctionnalité de notifications.

Pages et tests
---------------
- `src/testpage.jsx` : page de test et exemple.
  - Interroge l'endpoint `/test/` toutes les 3 secondes.
  - Affiche l'état de la connexion WebSocket et les données reçues.
  - Utile pour vérifier la communication backend et le store global.
  - Route `/test` non activée dans `App.jsx`.

Ressources et styles
---------------------
- `src/index.css` : styles globaux de base.
- `src/App.css` : styles généraux de l'application.
- `src/assets/CSS/Authentification.css` : styles du formulaire d'authentification.
- `src/assets/CSS/HomePage.css` : styles de la page d'accueil.
- `src/assets/CSS/NavBar.css` : styles de la barre de navigation et du menu utilisateur.
- `src/assets/CSS/Footer.css` : styles du pied de page.
- `src/assets/CSS/ProfilAcheteur.css` : styles de la page de consultation du profil.
- `src/assets/CSS/ModifierProfil.css` : styles de la page de modification du profil.
- `src/assets/CSS/langue.css` : styles du sélecteur de langue.
- `src/assets/Translate/` : fichiers de traduction et logique i18n (voir section "Internationalisation").
- `src/assets/Images/Asset5.svg` : logo principal utilisé dans le header, le footer et l'authentification.
- `src/assets/Images/Logo.png` : logo supplémentaire.
- `src/assets/hero.png`, `src/assets/vite.svg`, `src/assets/react.svg` : ressources d'assets du projet.

Notes de déploiement
--------------------
- Le backend attendu est sur `http://localhost:8000`.
- La carte Google Maps requiert la variable d'environnement `VITE_GOOGLE_MAPS_KEY`.
- Le reCAPTCHA requiert la variable d'environnement `VITE_RECAPTCHA_KEY`.
- L'authentification Google requiert la variable d'environnement `VITE_GOOGLE_CLIENT_ID` (utilisée par `GoogleOAuthProvider` dans `src/main.jsx`).
- Ces variables doivent être définies dans un fichier `.env` à la racine du projet.
- Les endpoints d'authentification et de profil attendus sont :
  `/Registration/inscription/`, `/Registration/connexion/`,
  `/Registration/deconnexion/`, `/Registration/profil/`,
  `/Registration/modifier-utilisateur/`, `/Registration/modifier-profil/`,
  `/Registration/modifier-mdp/`, `/Registration/google/connexion/`,
  `/Registration/google/inscription/`.
- Le frontend stocke le token, l'utilisateur connecté, le profil et la langue choisie dans `localStorage`.
- `RoutePrivee` existe pour sécuriser des pages futures mais n'est pas activée aujourd'hui.

Comment lancer le projet
-----------------------
1. Créer un fichier `.env` à la racine avec `VITE_GOOGLE_MAPS_KEY`, `VITE_RECAPTCHA_KEY` et `VITE_GOOGLE_CLIENT_ID`.
2. Installer les dépendances : `npm install`
3. Démarrer le serveur de développement : `npm run dev`
4. Ouvrir l'application dans le navigateur via l'URL affichée par Vite.

Résumé
------
Ce projet est un frontend React/Vite pour une plateforme agricole haïtienne. Il combine une page d'accueil visuelle multilingue, une authentification sécurisée (classique et Google OAuth) avec reCAPTCHA, une gestion complète du profil utilisateur (consultation, modification, photo, mot de passe), une communication API/WebSocket, et une carte Google Maps pour localiser et choisir des adresses.
