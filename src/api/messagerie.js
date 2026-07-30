import { api } from "./client";

export const MessagerieApi = {
  // mes conversations, triées par activité récente (voir Messagerie/views.py::mesConversations)
  mesConversations: () => api.get("/messagerie/conversations/"),

  // récupère/crée une conversation avec destinataire_id — produit_id optionnel
  // partage une fiche produit comme premier message (voir bouton "Contacter"
  // de ProductCard.jsx)
  demarrerConversation: (destinataire_id, produit_id) =>
    api.post("/messagerie/conversations/demarrer/", { destinataire_id, produit_id }),

  messagesConversation: (conversation_id) =>
    api.get(`/messagerie/messages/?conversation_id=${conversation_id}`),

  envoyerMessage: (conversation_id, contenu, produit_id) =>
    api.post("/messagerie/messages/envoyer/", { conversation_id, contenu, produit_id }),

  // messages vendeur -> administrateurs (pas de destinataire précis, voir
  // Messagerie/models.py::MessageSupport) : contacterAdmin (vendeur),
  // mesMessagesAdmin (historique + réponse, vendeur), listerMessagesAdminEnAttente
  // + repondreMessageAdmin (file partagée entre admins, premier arrivé
  // premier servi — voir Messagerie/views.py::repondreMessageAdmin)
  contacterAdmin: (contenu) => api.post("/messagerie/admin/contacter/", { contenu }),
  mesMessagesAdmin: () => api.get("/messagerie/admin/mes-messages/"),
  listerMessagesAdminEnAttente: () => api.get("/messagerie/admin/en-attente/"),
  repondreMessageAdmin: (id, reponse) => api.post("/messagerie/admin/repondre/", { id, reponse }),
};
