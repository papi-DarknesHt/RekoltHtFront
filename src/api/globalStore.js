import { create } from "zustand";

export const useGlobalStore = create((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // dernier évènement "verification.updated" reçu (KYC vendeur, voir
  // Registration/signals.py côté backend) — DevenirVendeur.jsx s'y abonne
  // pour rafraîchir l'écran de statut sans dépendre uniquement du polling
  verificationEvent: null,

  dispatch: ({ type, data }) => {
    set((state) => {
      switch (type) {
        case "verification.updated": return { ...state, verificationEvent: data };
        default: return state;
      }
    });
  },
}));