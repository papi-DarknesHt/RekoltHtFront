import { create } from "zustand";

export const useGlobalStore = create((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // dernier évènement "verification.updated" reçu (KYC vendeur, voir
  // Registration/signals.py côté backend) — DevenirVendeur.jsx s'y abonne
  // pour rafraîchir l'écran de statut sans dépendre uniquement du polling
  verificationEvent: null,

  // dernier évènement produit/catégorie reçu (voir Produits/signals.py côté
  // backend) — { type: "produit.created"|"produit.updated"|"produit.deleted"
  // |"categorie.created"|"categorie.updated"|"categorie.deleted", data }.
  // Les composants qui affichent une liste de produits/catégories (dashboard
  // admin, formulaire d'ajout de produit) s'y abonnent pour patcher leur état
  // local en place plutôt que d'exiger un rechargement de page — un nouvel
  // objet à chaque évènement (même si le type se répète) pour que useEffect
  // le détecte à chaque fois.
  produitEvent: null,
  categorieEvent: null,

  // dernier évènement sous-catégorie reçu (voir Produits/signals.py) —
  // même logique que categorieEvent ci-dessus
  sousCategorieEvent: null,

  // dernier évènement utilisateur/profil reçu (voir Registration/signals.py) —
  // AdminDashboard.jsx s'y abonne pour patcher sa liste "utilisateurs" sans
  // exiger un rechargement de page (ex: un nouveau compte créé par un autre
  // utilisateur pendant que le dashboard admin est déjà ouvert)
  utilisateurEvent: null,
  profilEvent: null,

  // dernier message créé OU supprimé reçu (voir Messagerie/signals.py côté
  // backend, groupe WebSocket personnel "user_<id>" — pas "global") —
  // Messagerie.jsx s'y abonne pour ajouter/retirer le message du fil actif
  // et faire remonter la conversation concernée en tête de liste. "deleted"
  // ne peut venir que d'un admin (voir supprimerMessageAdmin). "supprime_pour_moi"
  // (message ou conversation) vient d'une suppression volontaire de
  // l'utilisateur connecté lui-même (voir supprimerMessagePourMoi/
  // supprimerConversationPourMoi, Messagerie/views.py) — sert à synchroniser
  // ses propres autres onglets/sessions ouverts, jamais diffusé à l'autre
  // participant.
  messageEvent: null,

  // dernier contact reçu (voir Produits/signals.py::broadcast_contact_produit
  // côté backend, groupe WebSocket personnel "user_<id>") — TableauDeBordVendeur.jsx
  // s'y abonne pour ajouter la ligne à l'historique sans recharger la page
  contactEvent: null,

  // dernier évènement message vendeur->admins reçu (voir Messagerie/signals.py
  // et Messagerie/views.py::repondreMessageAdmin côté backend) — { type:
  // "message_admin.created"|"message_admin.repondu", data }. "created" est
  // diffusé au groupe WebSocket "admins" (tous les admins connectés),
  // "repondu" à la fois à "admins" (retire le message de leur file) et au
  // vendeur concerné (groupe personnel "user_<id>")
  messageAdminEvent: null,

  // dernier évènement de signalement produit reçu (voir Produits/views/signalementsViews.py
  // côté backend) — { type: "signalement.created"|"signalement.traite", data }.
  // "created" diffusé au groupe "admins", "traite" aussi (retire le
  // signalement de la file des autres admins) — AdminDashboard.jsx s'y abonne.
  signalementEvent: null,

  // dernier évènement de signalement vendeur reçu (voir Produits/views/signalementsViews.py
  // côté backend) — { type: "signalement_vendeur.created"|"signalement_vendeur.traite",
  // data }, même diffusion au groupe "admins" que signalementEvent ci-dessus.
  signalementVendeurEvent: null,

  // dernier évènement de signalement de message reçu (voir Messagerie/views.py) —
  // { type: "signalement_message.created"|"signalement_message.traite", data }.
  // "created" diffusé au groupe "admins", "traite" aussi (retire le
  // signalement de la file des autres admins, y compris quand le message
  // lui-même est supprimé) — AdminDashboard.jsx s'y abonne.
  signalementMessageEvent: null,

  // dernier évènement d'avis produit reçu (voir Produits/views/avisViews.py
  // + Produits/signals.py côté backend) — { type: "avis.created"|"avis.updated"
  // |"avis.deleted", data }. Diffusé à "global" : note_moyenne/nombre_avis du
  // produit concerné se mettent aussi à jour via produitEvent (même broadcast).
  avisEvent: null,

  // dernier évènement de signalement d'avis reçu (voir Produits/views/
  // signalementsViews.py::signalerAvis côté backend) — { type:
  // "signalement_avis.created"|"signalement_avis.traite", data }, même
  // diffusion au groupe "admins" que signalementEvent ci-dessus.
  signalementAvisEvent: null,

  dispatch: ({ type, data }) => {
    set((state) => {
      switch (type) {
        case "verification.updated":
          return { ...state, verificationEvent: data };
        case "produit.created":
        case "produit.updated":
        case "produit.deleted":
          return { ...state, produitEvent: { type, data, recu: Date.now() } };
        case "categorie.created":
        case "categorie.updated":
        case "categorie.deleted":
          return { ...state, categorieEvent: { type, data, recu: Date.now() } };
        case "sous_categorie.created":
        case "sous_categorie.updated":
        case "sous_categorie.deleted":
          return { ...state, sousCategorieEvent: { type, data, recu: Date.now() } };
        case "utilisateur.created":
        case "utilisateur.updated":
        case "utilisateur.deleted":
          return { ...state, utilisateurEvent: { type, data, recu: Date.now() } };
        case "profil.updated":
        case "profil.deleted":
          return { ...state, profilEvent: { type, data, recu: Date.now() } };
        case "message.created":
        case "message.deleted":
        case "message.supprime_pour_moi":
        case "conversation.supprime_pour_moi":
          return { ...state, messageEvent: { type, data, recu: Date.now() } };
        case "contact.created":
          return { ...state, contactEvent: { type, data, recu: Date.now() } };
        case "message_admin.created":
        case "message_admin.repondu":
          return { ...state, messageAdminEvent: { type, data, recu: Date.now() } };
        case "signalement.created":
        case "signalement.traite":
          return { ...state, signalementEvent: { type, data, recu: Date.now() } };
        case "signalement_vendeur.created":
        case "signalement_vendeur.traite":
          return { ...state, signalementVendeurEvent: { type, data, recu: Date.now() } };
        case "signalement_message.created":
        case "signalement_message.traite":
          return { ...state, signalementMessageEvent: { type, data, recu: Date.now() } };
        case "avis.created":
        case "avis.updated":
        case "avis.deleted":
          return { ...state, avisEvent: { type, data, recu: Date.now() } };
        case "signalement_avis.created":
        case "signalement_avis.traite":
          return { ...state, signalementAvisEvent: { type, data, recu: Date.now() } };
        default: return state;
      }
    });
  },
}));