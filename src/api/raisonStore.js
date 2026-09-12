import { create } from "zustand";

// même principe que confirmStore.js, mais pour demander une justification
// texte AVANT la confirmation elle-même (voir RaisonModal.jsx) — utilisé
// pour toute décision de modération sur un signalement (AdminDashboard.jsx) :
// l'admin doit d'abord expliquer sa décision, ensuite seulement confirmer.
// demanderRaison() résout le texte saisi, ou null si l'admin annule.
export const useRaisonStore = create((set, get) => ({
  requete: null, // { message, danger, resolve }

  demanderRaison: (message, { danger = false } = {}) =>
    new Promise((resolve) => {
      set({ requete: { message, danger, resolve } });
    }),

  repondre: (raison) => {
    get().requete?.resolve(raison);
    set({ requete: null });
  },
}));
