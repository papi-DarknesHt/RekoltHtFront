import { api } from "./client";

export const MessagerieApi = {
  // mes conversations, triées par activité récente (voir Messagerie/views.py::mesConversations)
  mesConversations: () => api.get("/messagerie/conversations/"),

  // récupère/crée une conversation avec destinataire_id — n'envoie jamais de
  // message : le produit d'origine (bouton "Contacter" de ProductCard.jsx)
  // est proposé comme aperçu "en réponse à" côté frontend, voir
  // Messagerie.jsx, et n'est envoyé que via envoyerMessage (produit_id)
  demarrerConversation: (destinataire_id) =>
    api.post("/messagerie/conversations/demarrer/", { destinataire_id }),

  messagesConversation: (conversation_id) =>
    api.get(`/messagerie/messages/?conversation_id=${conversation_id}`),

  // iv : présent uniquement pour un message chiffré de bout en bout (voir
  // src/utils/e2eCrypto.js) — contenu porte alors le ciphertext base64.
  // repond_a_id : id du message auquel celui-ci répond (voir bouton
  // "Répondre" du menu contextuel, Messagerie.jsx), optionnel
  envoyerMessage: (conversation_id, contenu, produit_id, iv, repond_a_id) =>
    api.post("/messagerie/messages/envoyer/", { conversation_id, contenu, produit_id, iv, repond_a_id }),

  // suppression "pour moi seulement" (voir Messagerie/views.py::
  // supprimerMessagePourMoi/supprimerConversationPourMoi) — l'autre
  // participant continue de tout voir normalement, rien n'est supprimé en base
  supprimerMessagePourMoi: (id) => api.delete("/messagerie/messages/supprimer-pour-moi/", { id }),
  supprimerConversationPourMoi: (id) => api.delete("/messagerie/conversations/supprimer-pour-moi/", { id }),

  // messages vendeur -> administrateurs (pas de destinataire précis, voir
  // Messagerie/models.py::MessageSupport) : contacterAdmin (vendeur),
  // mesMessagesAdmin (historique + réponse, vendeur), listerMessagesAdminEnAttente
  // + repondreMessageAdmin (file partagée entre admins, premier arrivé
  // premier servi — voir Messagerie/views.py::repondreMessageAdmin)
  // iv_contenu/cles_contenu, iv_reponse/cles_reponse : chiffrement en
  // enveloppe multi-destinataires, voir e2eStore.js::obtenirClesAdmins et
  // src/utils/e2eCrypto.js::chiffrerEnEnveloppe
  contacterAdmin: (contenu, iv_contenu, cles_contenu) =>
    api.post("/messagerie/admin/contacter/", { contenu, iv_contenu, cles_contenu }),
  mesMessagesAdmin: () => api.get("/messagerie/admin/mes-messages/"),
  listerMessagesAdminEnAttente: () => api.get("/messagerie/admin/en-attente/"),
  repondreMessageAdmin: (id, reponse, iv_reponse, cles_reponse) =>
    api.post("/messagerie/admin/repondre/", { id, reponse, iv_reponse, cles_reponse }),

  // signalements de messages — signaler un message privé (participant de la
  // conversation, transmis directement aux admins) ; lister/traiter/supprimer
  // réservés aux admins (voir Messagerie/views.py). contenu_dechiffre : copie
  // en clair déjà déchiffrée côté client, pour un message chiffré — voir
  // Registration/views.py::_serialiseSignalementMessage
  signalerMessage: (message_id, type_probleme, motif, contenu_dechiffre) =>
    api.post("/messagerie/messages/signaler/", { message_id, type_probleme, motif, contenu_dechiffre }),
  listerSignalementsMessagesAdmin: () => api.get("/messagerie/messages/signalements/en-attente/"),
  traiterSignalementMessage: (id) => api.post("/messagerie/messages/signalements/traiter/", { id }),
  supprimerMessageAdmin: (id) => api.delete("/messagerie/messages/supprimer/", { id }),
};
