import { api } from "./client";
export const AuthentificationApi = {
  // étape 1 — envoie l'email d'activation, ne connecte PAS encore (voir
  // Registration/views.py::sinscrire) ; réponse : {message, email}
  inscription: (data) => api.post("/Registration/inscription/", data),
  // étape 2 — valide le token du lien d'activation reçu par email, crée
  // enfin le compte et connecte (voir confirmerInscription) ; réponse :
  // {message, token, utilisateur}, comme l'ancienne réponse de inscription()
  confirmerInscription: (token) => api.post("/Registration/inscription/confirmer/", { token }),
  // renvoie l'email d'activation si le premier lien a expiré
  renvoyerActivation: (email) => api.post("/Registration/inscription/renvoyer/", { email }),
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

  // mise à jour des informations d'une entreprise (nom, secteur, coordonnées, logo, ...)
  modifierEntreprise: (data) => api.put("/Registration/entreprise/modifier/", data),

  // suppression du logo d'une entreprise déjà enregistré
  supprimerLogoEntreprise: (id) => api.delete("/Registration/entreprise/supprimer-logo/", { id }),

  // tous les utilisateurs — réservé aux admins
  listerUtilisateursAdmin: () => api.get("/Registration/admin/utilisateurs/"),

  // bloque/débloque un compte (bascule) — réservé aux admins
  // raison obligatoire pour bloquer (email envoyé au compte, voir
  // Registration/views.py::toggleBloquerUtilisateur) — optionnelle pour débloquer
  bloquerUtilisateurAdmin: (id, raison) => api.put("/Registration/admin/utilisateurs/bloquer/", { id, raison }),

  // supprime définitivement un compte (CASCADE) — réservé aux admins
  supprimerUtilisateurAdmin: (id, raison) => api.delete("/Registration/admin/utilisateurs/supprimer/", { id, raison }),

  // demandes administratives (objet + description, distinct de la messagerie
  // support libre — voir Registration/models.py::DemandeAdministrative)
  creerDemandeAdministrative: (objet, description) => api.post("/Registration/demandes-administratives/", { objet, description }),
  mesDemandesAdministratives: () => api.get("/Registration/demandes-administratives/mes-demandes/"),
  listerDemandesAdministrativesAdmin: () => api.get("/Registration/admin/demandes-administratives/"),
  approuverDemandeAdministrative: (id, reponse) => api.put("/Registration/admin/demandes-administratives/approuver/", { id, reponse }),
  rejeterDemandeAdministrative: (id, motif) => api.put("/Registration/admin/demandes-administratives/rejeter/", { id, motif }),

  // lève la suspension automatique d'un vendeur (voir Utilisateur.desactive_par_signalements,
  // Registration/models.py, et Produits/views/signalementsViews.py::signalerVendeur) —
  // réservé aux admins ; rend aussi disponibles tous ses produits non bannis individuellement
  reactiverVendeurAdmin: (id) => api.put("/Registration/admin/utilisateurs/reactiver-vendeur/", { id }),

  // statistiques agrégées pour le tableau de bord admin — réservé aux admins
  obtenirDashboardAdmin: () => api.get("/Registration/admin/dashboard/"),
  // vues profils/produits/catégories, globales (tous vendeurs confondus),
  // filtrables par période (dateDebut/dateFin AAAA-MM-JJ, défaut serveur :
  // 7 derniers jours si omis — voir Produits/views/vuesViews.py::statistiquesVuesAdmin)
  statistiquesVuesAdmin: (dateDebut, dateFin) => {
    const params = dateDebut && dateFin ? `?date_debut=${dateDebut}&date_fin=${dateFin}` : "";
    return api.get(`/Registration/admin/statistiques-vues/${params}`);
  },

  // ── GESTION DES ADMs (droits granulaires, voir DroitsAdmin côté backend) —
  // toutes réservées au super admin (voir Registration/views.py)
  listerAdmins:        () => api.get("/Registration/admin/adms/"),
  creerAdmin:           (data) => api.post("/Registration/admin/adms/creer/", data),
  promouvoirAdmin:      (data) => api.put("/Registration/admin/adms/promouvoir/", data),
  modifierDroitsAdmin:  (data) => api.put("/Registration/admin/adms/modifier-droits/", data),
  revoquerAdmin:        (id) => api.put("/Registration/admin/adms/revoquer/", { id }),
  modifierInfosAdmin:   (data) => api.put("/Registration/admin/adms/modifier-infos/", data),
  // ne change PAS le mot de passe — force seulement un changement à la
  // prochaine connexion de l'admin visé (voir doit_changer_mot_de_passe)
  reinitialiserMotDePasseAdmin: (id) => api.put("/Registration/admin/adms/reinitialiser-mdp/", { id }),

  // rapport PDF du journal d'audit — admin_id omis = tous les admins
  genererRapportAudit: (dateDebut, dateFin, adminId) => {
    const params = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin });
    if (adminId) params.set("admin_id", adminId);
    return api.getBlob(`/Registration/admin/adms/rapport-audit/?${params.toString()}`);
  },

  // vérifie si une entreprise (nom) existe déjà — sans authentification
  verifierEntreprise: (nom_Entreprise) => api.get(
    `/Registration/entreprise/verifier/?nom_Entreprise=${encodeURIComponent(nom_Entreprise)}`
  ),

  // soumission du dossier de vérification KYC — formData en multipart (fichiers
  // réels via request.FILES côté backend, pas de base64), voir DevenirVendeur.jsx
  soumettreVerification: (formData) => api.post("/Registration/verification/soumettre/", formData),

  // statut courant (+ motif d'échec) de la demande de vérification de l'utilisateur connecté
  obtenirStatutVerification: () => api.get("/Registration/verification/statut/"),

  // aperçu PDF du contrat AVANT envoi définitif — rien n'est persisté côté serveur
  previsualiserContrat: (formData) => api.postBlob("/Registration/verification/previsualiser/", formData),

  demanderReinitialisation:      (data) => api.post("/Registration/reinitialisation/demander/",      data),
  verifierCodeReinitialisation:  (data) => api.post("/Registration/reinitialisation/verifier-code/", data),
  reinitialiserMotDePasse:       (data) => api.post("/Registration/reinitialisation/valider/",       data),

  isConnected: () => !!localStorage.getItem("token"),
  googleConnexion:   (data) => api.post("/Registration/google/connexion/",   data),
  googleInscription: (data) => api.post("/Registration/google/inscription/", data),

  getUtilisateur: () => {
    const u = localStorage.getItem("utilisateur");
    return u ? JSON.parse(u) : null;
  },

  // page "Contactez-nous" — public, aucun compte requis (voir
  // Registration/views.py::contacterNous, transmis par email à l'équipe)
  contacterNous: (data) => api.post("/Registration/contact/", data),
};
