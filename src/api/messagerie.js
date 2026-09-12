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

  // contenu part en clair (HTTPS) — chiffré au repos côté SERVEUR (voir
  // Messagerie/services/messages_chiffrement_service.py, MESSAGES_MASTER_KEY),
  // jamais de chiffrement/déchiffrement côté client. repond_a_id : id du
  // message auquel celui-ci répond (voir bouton "Répondre" du menu
  // contextuel, Messagerie.jsx), optionnel
  envoyerMessage: (conversation_id, contenu, produit_id, repond_a_id) =>
    api.post("/messagerie/messages/envoyer/", { conversation_id, contenu, produit_id, repond_a_id }),

  // suppression "pour moi seulement" (voir Messagerie/views.py::
  // supprimerMessagePourMoi/supprimerConversationPourMoi) — l'autre
  // participant continue de tout voir normalement, rien n'est supprimé en base
  supprimerMessagePourMoi: (id) => api.delete("/messagerie/messages/supprimer-pour-moi/", { id }),
  supprimerConversationPourMoi: (id) => api.delete("/messagerie/conversations/supprimer-pour-moi/", { id }),

  // messages vendeur -> administrateurs (pas de destinataire précis, voir
  // Messagerie/models.py::MessageSupport) : contacterAdmin (vendeur),
  // mesMessagesAdmin (historique + réponse, vendeur), listerMessagesAdminEnAttente
  // + repondreMessageAdmin (file partagée entre admins, premier arrivé
  // premier servi — voir Messagerie/views.py::repondreMessageAdmin).
  // Chiffré côté SERVEUR ("coffre support", voir Messagerie/services/
  // support_chiffrement_service.py) — même principe désormais appliqué à la
  // messagerie privée 1:1 (voir messages_chiffrement_service.py) : n'importe
  // quel admin gestion_support peut lire ces messages, même attribué après
  // l'envoi. Le contenu part en clair vers le serveur ici (HTTPS), aucun
  // chiffrement client nécessaire pour un nouveau message.
  contacterAdmin: (contenu) =>
    api.post("/messagerie/admin/contacter/", { contenu }),

  // assistant IA du chatbot (voir ChatbotVendeur.jsx, Messagerie/views.py::
  // chatbotRepondre) — accessible SANS connexion, contrairement à
  // contacterAdmin ci-dessus. contexte : bloc de Q/R du Centre d'aide déjà
  // assemblé côté frontend (voir faqSections.js) ; historique : tours
  // précédents [{role, contenu}, ...] pour la continuité de la conversation.
  // Réponse : { reponse, hors_sujet }.
  demanderReponseChatbotIA: (question, contexte, historique) =>
    api.post("/messagerie/chatbot/repondre/", { question, contexte, historique }),
  mesMessagesAdmin: () => api.get("/messagerie/admin/mes-messages/"),
  listerMessagesAdminEnAttente: () => api.get("/messagerie/admin/en-attente/"),
  // historique des messages déjà répondus — MOI SEUL, sauf "Tous les droits"/
  // propriétaire qui voient aussi ceux des autres admins (voir
  // Messagerie/views.py::listerMessagesAdminRepondus)
  listerMessagesAdminRepondus: () => api.get("/messagerie/admin/repondus/"),
  // supprime définitivement des entrées de l'historique (ids : liste) — même
  // portée que listerMessagesAdminRepondus (voir Messagerie/views.py::
  // supprimerHistoriqueMessagesSupport)
  supprimerHistoriqueMessagesSupport: (ids) => api.delete("/messagerie/admin/repondus/supprimer/", { ids }),
  repondreMessageAdmin: (id, reponse) =>
    api.post("/messagerie/admin/repondre/", { id, reponse }),
  // fait basculer un message legacy (chiffré en enveloppe E2E côté client,
  // voir format_chiffrement) vers le coffre support, une fois qu'un admin est
  // parvenu à le déchiffrer lui-même — voir AdminDashboard.jsx. payload :
  // {id, contenu_dechiffre?, reponse_dechiffree?} (l'un des deux ou les deux)
  migrerMessageVersCoffre: (payload) => api.post("/messagerie/admin/migrer-vers-coffre/", payload),
  // rapport PDF d'audit — message + réponse donnée, sur une période, filtrable
  // par admin (admin_id omis = tous) — réservé à "Tous les droits"/propriétaire
  // (voir Messagerie/views.py::genererRapportSupport)
  genererRapportSupport: (dateDebut, dateFin, adminId) => {
    const params = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin });
    if (adminId) params.set("admin_id", adminId);
    return api.getBlob(`/messagerie/admin/rapport-audit/?${params.toString()}`);
  },

  // signalements de messages — signaler un message privé (participant de la
  // conversation, transmis directement aux admins) ; lister/traiter/supprimer
  // réservés aux admins (voir Messagerie/views.py). La copie en clair prise
  // au moment du signalement est déchiffrée côté SERVEUR (voir
  // Messagerie/views.py::signalerMessage/_serialiseSignalementMessage).
  signalerMessage: (message_id, type_probleme, motif) =>
    api.post("/messagerie/messages/signaler/", { message_id, type_probleme, motif }),
  listerSignalementsMessagesAdmin: () => api.get("/messagerie/messages/signalements/en-attente/"),
  // historique — MOI SEUL, sauf "Tous les droits"/propriétaire (voir listerMessagesAdminRepondus)
  listerSignalementsMessagesTraites: () => api.get("/messagerie/messages/signalements/traites/"),
  supprimerHistoriqueSignalementsMessages: (ids) => api.delete("/messagerie/messages/signalements/traites/supprimer/", { ids }),
  // traitement groupé — voir Produits/api produits.js::traiterSignalement, même principe
  traiterSignalementMessage: (ids, explication) => api.post("/messagerie/messages/signalements/traiter/", { ids, explication }),
  supprimerMessageAdmin: (id) => api.delete("/messagerie/messages/supprimer/", { id }),
};
