import { create } from "zustand";

// permet de demander une confirmation depuis n'importe quel gestionnaire
// async (delete/modifier) sans dupliquer un état + un modal dans chaque
// composant — un seul <ConfirmModal /> est monté dans App.jsx et lit
// "requete" ici. demander() résout la Promise dès que l'utilisateur répond
// via repondre(), exactement comme window.confirm() mais avec un popup
// stylé cohérent avec le reste de l'app.
export const useConfirmStore = create((set, get) => ({
  requete: null, // { message, danger, resolve }

  demander: (message, { danger = false } = {}) =>
    new Promise((resolve) => {
      set({ requete: { message, danger, resolve } });
    }),

  repondre: (reponse) => {
    get().requete?.resolve(reponse);
    set({ requete: null });
  },
}));
