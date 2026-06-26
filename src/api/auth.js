import { api } from "./client";
export const AuthentificationApi = {
  inscription: (data) => api.post("/Registration/inscription/", data),
  // connexion — sauvegarde le token
  connexion: async (data) => {
    const res = await api.post("/Registration/connexion/", data);
    localStorage.setItem("token", res.token);
    localStorage.setItem("utilisateur", JSON.stringify(res.utilisateur));
    return res;
  },
  // deconnexion — supprime le token
  deconnexion: async (data) => {
    await api.post("/Registration/deconnexion/", data);
    localStorage.removeItem("token");
    localStorage.removeItem("utilisateur");
  },

  // profil (lecture uniquement — la mise à jour se fait via modifierUtilisateur / modifierProfil)
  getprofil: () => api.get("/Registration/profil/"),

  // mise à jour des informations du compte (nom, prenom, email, telephone)
  modifierUtilisateur: (data) => api.put("/Registration/modifier-utilisateur/", data),

  // mise à jour des informations du profil (bio, adresse, photo, role, ...)
  modifierProfil: (data) => api.put("/Registration/modifier-profil/", data),

  // suppression de la photo de profil déjà enregistrée
  supprimerPhotoProfil: () => api.delete("/Registration/supprimer-photo-profil/"),

  // changement de mot de passe
  modifierMotDePasse: (data) => api.put("/Registration/modifier-mdp/", data),

  // entreprise — création (compte vendeur/Antrepriz)
  creerEntreprise: (data) => api.post("/Registration/entreprise/creer/", data),

  // entreprise(s) appartenant à l'utilisateur connecté (toutes les entreprises si admin)
  listerEntreprises: () => api.get("/Registration/entreprise/lister/"),

  // tous les utilisateurs — réservé aux admins
  listerUtilisateursAdmin: () => api.get("/Registration/admin/utilisateurs/"),

  // vérifie si une entreprise (nom + numéro d'enregistrement) existe déjà — sans authentification
  verifierEntreprise: (nom_Entreprise, num_Enregistrement) => api.get(
    `/Registration/entreprise/verifier/?nom_Entreprise=${encodeURIComponent(nom_Entreprise)}&num_Enregistrement=${encodeURIComponent(num_Enregistrement)}`
  ),

  isConnected: () => !!localStorage.getItem("token"),
  googleConnexion:   (data) => api.post("/Registration/google/connexion/",   data),
  googleInscription: (data) => api.post("/Registration/google/inscription/", data),

  getUtilisateur: () => {
    const u = localStorage.getItem("utilisateur");
    return u ? JSON.parse(u) : null;
  }
};
