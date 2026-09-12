import { api } from "./client";
export const AuthentificationApi = {
  // étape 1: envoie l'email d'activation, ne connecte PAS encore 
  inscription: (data) => api.post("/Registration/inscription/", data),
  // étape 2 : valide le token du lien d'activation reçu par email, crée
  // enfin le compte et connecte 
  confirmerInscription: (token) => api.post("/Registration/inscription/confirmer/", { token }),
  // renvoie l'email d'activation si le premier lien a expiré
  renvoyerActivation: (email) => api.post("/Registration/inscription/renvoyer/", { email }),
  // connexion: sauvegarde le token
  connexion: async (data) => {
    const res = await api.post("/Registration/connexion/", data);
    localStorage.setItem("token", res.token);
    localStorage.setItem("utilisateur", JSON.stringify(res.utilisateur));
    return res;
  },
  // deconnexion : supprime le token
  deconnexion: async (data) => {
    await api.post("/Registration/deconnexion/", data);
    localStorage.removeItem("token");
    localStorage.removeItem("utilisateur");
  },

  // profil de l'utilisateur connecté (nom, prenom, email, telephone, bio, adresse, photo, role, ...)
  getprofil: () => api.get("/Registration/profil/"),

  // mise à jour des informations du compte (nom, prenom, email, telephone)
  modifierUtilisateur: (data) => api.put("/Registration/modifier-utilisateur/", data),

  // mise à jour des informations du profil (bio, adresse, photo, role, ...)
  modifierProfil: (data) => api.put("/Registration/modifier-profil/", data),

  // suppression de la photo de profil déjà enregistrée
  supprimerPhotoProfil: () => api.delete("/Registration/supprimer-photo-profil/"),

  // changement de mot de passe
  modifierMotDePasse: (data) => api.put("/Registration/modifier-mdp/", data),

  // entreprise,  étape 1 : envoie l'email d'activation, ne crée PAS encore le
  // compte. l'email de l'entreprise doit lui aussi être opérationnel avant que son compte
  // n'existe. Étape 2 : même endpoint confirmerInscription/renvoyerActivation
  // que le flux individuel.
  creerEntreprise: (data) => api.post("/Registration/entreprise/creer/", data),

  // entreprise(s) appartenant à l'utilisateur connecté (toutes les entreprises si admin)
  listerEntreprises: () => api.get("/Registration/entreprise/lister/"),

  // mise à jour des informations d'une entreprise (nom, secteur, coordonnées, logo, ...)
  modifierEntreprise: (data) => api.put("/Registration/entreprise/modifier/", data),

  // suppression du logo d'une entreprise déjà enregistré
  supprimerLogoEntreprise: (id) => api.delete("/Registration/entreprise/supprimer-logo/", { id }),

  // tous les utilisateurs 
  listerUtilisateursAdmin: () => api.get("/Registration/admin/utilisateurs/"),

  // bloque/débloque un compte 
  bloquerUtilisateurAdmin: (id, raison) => api.put("/Registration/admin/utilisateurs/bloquer/", { id, raison }),

  // bloque un compte DEPUIS UN SIGNALEMENT 
  bloquerDepuisSignalementAdmin: (id, raison) =>
    api.put("/Registration/admin/utilisateurs/bloquer-depuis-signalement/", { id, raison }),

  // supprime définitivement un compte (CASCADE) 
  supprimerUtilisateurAdmin: (id, raison) => api.delete("/Registration/admin/utilisateurs/supprimer/", { id, raison }),

  // demandes administratives (objet + description, distinct de la messagerie support libre 
  creerDemandeAdministrative: (objet, description) => api.post("/Registration/demandes-administratives/", { objet, description }),
  mesDemandesAdministratives: () => api.get("/Registration/demandes-administratives/mes-demandes/"),
  listerDemandesAdministrativesAdmin: () => api.get("/Registration/admin/demandes-administratives/"),
  approuverDemandeAdministrative: (id, reponse) => api.put("/Registration/admin/demandes-administratives/approuver/", { id, reponse }),
  rejeterDemandeAdministrative: (id, motif) => api.put("/Registration/admin/demandes-administratives/rejeter/", { id, motif }),

  // lève la suspension automatique d'un vendeur rend aussi disponibles tous ses produits non bannis individuellement
  reactiverVendeurAdmin: (id) => api.put("/Registration/admin/utilisateurs/reactiver-vendeur/", { id }),

  // statistiques agrégées pour le tableau de bord admin. 
  obtenirDashboardAdmin: () => api.get("/Registration/admin/dashboard/"),
  
  statistiquesVuesAdmin: (dateDebut, dateFin) => {
    const params = dateDebut && dateFin ? `?date_debut=${dateDebut}&date_fin=${dateFin}` : "";
    return api.get(`/Registration/admin/statistiques-vues/${params}`);
  },

  // GESTION DES ADMs
  listerAdmins: () => api.get("/Registration/admin/adms/"),
  creerAdmin: (data) => api.post("/Registration/admin/adms/creer/", data),
  promouvoirAdmin: (data) => api.put("/Registration/admin/adms/promouvoir/", data),
  modifierDroitsAdmin: (data) => api.put("/Registration/admin/adms/modifier-droits/", data),
  revoquerAdmin: (id) => api.put("/Registration/admin/adms/revoquer/", { id }),
  modifierInfosAdmin: (data) => api.put("/Registration/admin/adms/modifier-infos/", data),

  reinitialiserMotDePasseAdmin: (id) => api.put("/Registration/admin/adms/reinitialiser-mdp/", { id }),

  // rapport PDF du journal d'audit 
  genererRapportAudit: (dateDebut, dateFin, adminId) => {
    const params = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin });
    if (adminId) params.set("admin_id", adminId);
    return api.getBlob(`/Registration/admin/adms/rapport-audit/?${params.toString()}`);
  },

  // vérifie si une entreprise (nom) existe déjà 
  verifierEntreprise: (nom_Entreprise) => api.get(
    `/Registration/entreprise/verifier/?nom_Entreprise=${encodeURIComponent(nom_Entreprise)}`
  ),

  // soumission du dossier de vérification KYC
  soumettreVerification: (formData) => api.post("/Registration/verification/soumettre/", formData),

  // statut courant (+ motif d'échec) de la demande de vérification de l'utilisateur connecté
  obtenirStatutVerification: () => api.get("/Registration/verification/statut/"),

  // aperçu PDF du contrat AVANT envoi définitif 
  previsualiserContrat: (formData) => api.postBlob("/Registration/verification/previsualiser/", formData),

  // demandes de vérification KYC en revue manuelle 
  listerDemandesRevueManuelleAdmin: () => api.get("/Registration/admin/verifications-revue-manuelle/"),

  // approuve/rejette une demande en revue manuelle
  traiterDemandeRevueManuelleAdmin: (id, decision, motif) =>
    api.put("/Registration/admin/verifications-revue-manuelle/traiter/", { id, decision, motif }),

  demanderReinitialisation: (data) => api.post("/Registration/reinitialisation/demander/", data),
  verifierCodeReinitialisation: (data) => api.post("/Registration/reinitialisation/verifier-code/", data),
  reinitialiserMotDePasse: (data) => api.post("/Registration/reinitialisation/valider/", data),

  isConnected: () => !!localStorage.getItem("token"),
  googleConnexion: (data) => api.post("/Registration/google/connexion/", data),
  googleInscription: (data) => api.post("/Registration/google/inscription/", data),

  getUtilisateur: () => {
    const u = localStorage.getItem("utilisateur");
    return u ? JSON.parse(u) : null;
  },

  contacterNous: (data) => api.post("/Registration/contact/", data),
};
