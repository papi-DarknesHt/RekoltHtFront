import { api } from "./client";

// toutes les routes sont réservées aux admins ayant le droit gestion_sauvegardes
// (restaurer/analyser et restaurer/confirmer exigent en plus super_admin — voir
// Sauvegarde/views.py côté backend, même règle appliquée côté serveur)
export const SauvegardeApi = {
  obtenirConfiguration: () => api.get("/Sauvegarde/configuration/"),
  modifierConfiguration: (data) => api.put("/Sauvegarde/configuration/", data),

  listerHistorique: () => api.get("/Sauvegarde/historique/"),

  // type_sauvegarde/destination optionnels — omis, reprend la configuration
  // courante ; fournis, essai ponctuel indépendant de la configuration
  declencherSauvegarde: (data) => api.post("/Sauvegarde/declencher/", data || {}),

  // fichier .rhtbackup chiffré tel quel (aucun déchiffrement côté client
  // possible — la clé maître ne quitte jamais le serveur)
  telechargerSauvegarde: (id) => api.getBlob(`/Sauvegarde/historique/${id}/telecharger/`),

  // aperçu sans écriture — fichier envoyé en multipart/form-data (voir
  // client.js, qui détecte automatiquement un body FormData)
  analyserRestauration: (fichier) => {
    const formData = new FormData();
    formData.append("fichier", fichier);
    return api.post("/Sauvegarde/restaurer/analyser/", formData);
  },

  // restauration réelle — même fichier renvoyé après confirmation explicite
  // côté utilisateur (voir useConfirmStore, AdminDashboard.jsx)
  confirmerRestauration: (fichier) => {
    const formData = new FormData();
    formData.append("fichier", fichier);
    return api.post("/Sauvegarde/restaurer/confirmer/", formData);
  },

  // ouvre l'URL renvoyée dans un nouvel onglet — le callback OAuth2 (appelé
  // directement par Google, pas par ce frontend) redirige ensuite vers
  // /admin/dashboard?tab=sauvegarde&google=connecte|refuse|erreur
  obtenirUrlAutorisationGoogle: () => api.get("/Sauvegarde/google/autoriser/"),

  deconnecterGoogleDrive: () => api.post("/Sauvegarde/google/deconnecter/"),
};
