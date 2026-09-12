import { create } from "zustand";

// permet de demander une confirmation depuis n'importe quel gestionnaire
// async (delete/modifier) sans dupliquer un état + un modal dans chaque
// composant — un seul <ConfirmModal /> est monté dans App.jsx et lit
// "requete" ici. demander() résout la Promise dès que l'utilisateur répond
// via repondre(), exactement comme window.confirm() mais avec un popup
// stylé cohérent avec le reste de l'app.
export const useConfirmStore = create((set, get) => ({
  requete: null, // { message, danger, resolve }
  // demandes reçues pendant qu'une confirmation est déjà affichée — sans
  // cette file, une deuxième demander() écrasait "requete" avant que
  // repondre() n'ait résolu la première (ex. double-clic rapide sur deux
  // boutons "Supprimer" différents), et la Promise du premier appel ne se
  // résolvait alors plus jamais (bouton bloqué indéfiniment)
  file: [],

  demander: (message, { danger = false } = {}) =>
    new Promise((resolve) => {
      const nouvelle = { message, danger, resolve };
      if (get().requete) {
        set((s) => ({ file: [...s.file, nouvelle] }));
      } else {
        set({ requete: nouvelle });
      }
    }),

  repondre: (reponse) => {
    get().requete?.resolve(reponse);
    const [suivante, ...reste] = get().file;
    set({ requete: suivante ?? null, file: reste });
  },
}));
