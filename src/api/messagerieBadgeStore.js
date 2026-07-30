import { create } from "zustand";
import { MessagerieApi } from "./messagerie";

// Compteur de messages non lus partagé entre NavBar.jsx (pastille sur la
// sonnette) et Messagerie.jsx (source la plus à jour pendant que la page de
// messagerie est ouverte) — un zustand séparé plutôt qu'un état local à
// NavBar, car NavBar est remonté à chaque page (voir App.jsx : chaque page
// rend son propre <NavBar/>, il n'y a pas d'instance unique persistante).
export const useMessagerieBadgeStore = create((set) => ({
  nonLus: 0,
  setNonLus: (n) => set({ nonLus: n }),
  rafraichir: async () => {
    try {
      const res = await MessagerieApi.mesConversations();
      const total = (res.conversations || []).reduce((somme, c) => somme + (c.non_lus || 0), 0);
      set({ nonLus: total });
    } catch {
      // pastille non critique : un échec silencieux vaut mieux qu'une erreur affichée
    }
  },

  // messages vendeur -> admins en attente de réponse (voir Messagerie/models.py
  // ::MessageSupport) — admin uniquement ; même principe que nonLus ci-dessus :
  // NavBar.jsx s'y abonne pour la pastille de la sonnette, AdminDashboard.jsx
  // pousse sa propre liste (déjà à jour en temps réel pendant qu'il est ouvert)
  messagesSupportEnAttente: 0,
  setMessagesSupportEnAttente: (n) => set({ messagesSupportEnAttente: n }),
  rafraichirSupport: async () => {
    try {
      const res = await MessagerieApi.listerMessagesAdminEnAttente();
      set({ messagesSupportEnAttente: (res.messages_admin || []).length });
    } catch {
      // réservé aux admins : un vendeur/acheteur reçoit un 403, on ignore silencieusement
    }
  },
}));
