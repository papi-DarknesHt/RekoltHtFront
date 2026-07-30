import { create } from "zustand";

export const useGlobalStore = create((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // dernier évènement "verification.updated" reçu (KYC vendeur, voir
  // Registration/signals.py côté backend) — DevenirVendeur.jsx s'y abonne
  // pour rafraîchir l'écran de statut sans dépendre uniquement du polling
  verificationEvent: null,

  // dernier évènement produit/catégorie reçu (voir Produits/signals.py côté
  // backend) — { type: "produit.created"|"produit.updated"|"produit.deleted"
  // |"categorie.created"|"categorie.updated"|"categorie.deleted", data }.
  // Les composants qui affichent une liste de produits/catégories (dashboard
  // admin, formulaire d'ajout de produit) s'y abonnent pour patcher leur état
  // local en place plutôt que d'exiger un rechargement de page — un nouvel
  // objet à chaque évènement (même si le type se répète) pour que useEffect
  // le détecte à chaque fois.
  produitEvent: null,
  categorieEvent: null,

  // dernier évènement sous-catégorie reçu (voir Produits/signals.py) —
  // même logique que categorieEvent ci-dessus
  sousCategorieEvent: null,

  // dernier évènement utilisateur/profil reçu (voir Registration/signals.py) —
  // AdminDashboard.jsx s'y abonne pour patcher sa liste "utilisateurs" sans
  // exiger un rechargement de page (ex: un nouveau compte créé par un autre
  // utilisateur pendant que le dashboard admin est déjà ouvert)
  utilisateurEvent: null,
  profilEvent: null,

  // dernier message reçu (voir Messagerie/signals.py côté backend, groupe
  // WebSocket personnel "user_<id>" — pas "global") — Messagerie.jsx s'y
  // abonne pour ajouter le message au fil actif et faire remonter la
  // conversation concernée en tête de liste
  messageEvent: null,

  // dernier contact reçu (voir Produits/signals.py::broadcast_contact_produit
  // côté backend, groupe WebSocket personnel "user_<id>") — TableauDeBordVendeur.jsx
  // s'y abonne pour ajouter la ligne à l'historique sans recharger la page
  contactEvent: null,

  // dernier évènement message vendeur->admins reçu (voir Messagerie/signals.py
  // et Messagerie/views.py::repondreMessageAdmin côté backend) — { type:
  // "message_admin.created"|"message_admin.repondu", data }. "created" est
  // diffusé au groupe WebSocket "admins" (tous les admins connectés),
  // "repondu" à la fois à "admins" (retire le message de leur file) et au
  // vendeur concerné (groupe personnel "user_<id>")
  messageAdminEvent: null,

  dispatch: ({ type, data }) => {
    set((state) => {
      switch (type) {
        case "verification.updated":
          return { ...state, verificationEvent: data };
        case "produit.created":
        case "produit.updated":
        case "produit.deleted":
          return { ...state, produitEvent: { type, data, recu: Date.now() } };
        case "categorie.created":
        case "categorie.updated":
        case "categorie.deleted":
          return { ...state, categorieEvent: { type, data, recu: Date.now() } };
        case "sous_categorie.created":
        case "sous_categorie.updated":
        case "sous_categorie.deleted":
          return { ...state, sousCategorieEvent: { type, data, recu: Date.now() } };
        case "utilisateur.created":
        case "utilisateur.updated":
        case "utilisateur.deleted":
          return { ...state, utilisateurEvent: { type, data, recu: Date.now() } };
        case "profil.updated":
        case "profil.deleted":
          return { ...state, profilEvent: { type, data, recu: Date.now() } };
        case "message.created":
          return { ...state, messageEvent: { type, data, recu: Date.now() } };
        case "contact.created":
          return { ...state, contactEvent: { type, data, recu: Date.now() } };
        case "message_admin.created":
        case "message_admin.repondu":
          return { ...state, messageAdminEvent: { type, data, recu: Date.now() } };
        default: return state;
      }
    });
  },
}));