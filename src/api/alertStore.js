import { create } from "zustand";

// popup d'information non-bloquante (juste un bouton "OK", contrairement à
// confirmStore.js qui attend Annuler/Confirmer) — utilisé notamment pour
// expliquer à un utilisateur pourquoi sa connexion vient d'être refusée
// (compte bloqué/supprimé, voir Authentification.jsx), avec une action
// secondaire optionnelle (ex: aller vers /contact). Un seul <AlertModal />
// est monté dans App.jsx et lit "requete" ici.
export const useAlertStore = create((set) => ({
  requete: null, // { titre, message, actionLabel, actionHref, danger }

  afficher: (requete) => set({ requete }),

  fermer: () => set({ requete: null }),
}));
