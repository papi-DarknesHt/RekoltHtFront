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
        default: return state;
      }
    });
  },
}));