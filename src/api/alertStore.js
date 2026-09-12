import { create } from "zustand";

export const useAlertStore = create((set) => ({
  requete: null, // { titre, message, actionLabel, actionHref, danger }

  afficher: (requete) => set({ requete }),

  fermer: () => set({ requete: null }),
}));
