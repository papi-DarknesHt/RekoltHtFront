import { api } from "./client";

export const ProduitsApi = {
  // catégories — lecture publique, écriture réservée aux admins (voir Produits/views/categoriesViews.py)
  listerCategories:   () => api.get("/produits/categories/"),
  creerCategorie:     (data) => api.post("/produits/categories/creer/", data),
  modifierCategorie:  (data) => api.put("/produits/categories/modifier/", data),
  supprimerCategorie: (id) => api.delete("/produits/categories/supprimer/", { id }),

  // catégories choisies par le vendeur connecté (étape obligatoire avant de
  // pouvoir publier un produit, voir Registration/models.py::Profil.categories_produits)
  mesCategoriesVendeur:     () => api.get("/produits/categories/mes-categories/"),
  choisirCategoriesVendeur: (categorie_ids) => api.post("/produits/categories/choisir/", { categorie_ids }),

  // sous-catégories — lecture publique (filtre optionnel ?categorie_id=),
  // écriture réservée aux admins (voir Produits/views/sousCategoriesViews.py)
  listerSousCategories:   (categorie_id) => api.get(`/produits/sous-categories/${categorie_id ? `?categorie_id=${categorie_id}` : ""}`),
  creerSousCategorie:     (data) => api.post("/produits/sous-categories/creer/", data),
  modifierSousCategorie:  (data) => api.put("/produits/sous-categories/modifier/", data),
  supprimerSousCategorie: (id) => api.delete("/produits/sous-categories/supprimer/", { id }),

  // produits — lecture publique (filtres optionnels en query string, voir
  // Produits/views/produitsViews.py::listerProduits : categorie_id,
  // departement, commune, disponible)
  listerProduits: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/produits/lister/${qs ? `?${qs}` : ""}`);
  },
  creerProduit:    (data) => api.post("/produits/creer/", data),
  mesProduits:     () => api.get("/produits/mes-produits/"),
  // rapport statistique PDF du vendeur connecté (résumé, produits les plus
  // consultés/contactés, détail par produit) — voir Produits/views/
  // produitsViews.py::statistiquesVendeurPdf et Produits/services/rapport_service.py
  statistiquesVendeurPdf: () => api.getBlob("/produits/statistiques/rapport-pdf/"),
  // vues profil/produits/catégories du vendeur connecté, filtrables par
  // période (dateDebut/dateFin AAAA-MM-JJ, défaut serveur : 7 derniers
  // jours si omis — voir Produits/views/vuesViews.py::statistiquesVuesVendeur)
  statistiquesVuesVendeur: (dateDebut, dateFin) => {
    const params = dateDebut && dateFin ? `?date_debut=${dateDebut}&date_fin=${dateFin}` : "";
    return api.get(`/produits/vendeur/statistiques-vues/${params}`);
  },
  detailProduit:   (id) => api.get(`/produits/detail/?id=${id}`),
  // infos publiques d'un vendeur (page détail produit) — pas d'email/téléphone,
  // le contact passe par contacterProduit/la messagerie (voir Produits/views/produitsViews.py::infoVendeur)
  infoVendeur:     (vendeurId) => api.get(`/produits/vendeur/?vendeur_id=${vendeurId}`),
  // vendeurs à positionner sur la carte d'accueil (public, voir MapHaiti.jsx
  // et Produits/views/produitsViews.py::listerVendeursCarte)
  listerVendeursCarte: () => api.get("/produits/vendeurs-carte/"),
  modifierProduit: (data) => api.put("/produits/modifier/", data),
  supprimerProduit: (id) => api.delete("/produits/supprimer/", { id }),
  toggleDisponibiliteProduit: (id) => api.put("/produits/toggle-disponibilite/", { id }),
  // réactive un produit désactivé automatiquement après 5 signalements —
  // réservé aux admins (voir Produits/views/produitsViews.py::reactiverProduitAdmin)
  reactiverProduitAdmin: (id) => api.put("/produits/admin/reactiver/", { id }),

  // désactivation manuelle depuis un signalement — réservé aux admins (voir
  // Produits/views/produitsViews.py::desactiverProduitAdmin)
  desactiverProduitAdmin: (id, raison) => api.put("/produits/admin/desactiver/", { id, raison }),
  // suppression définitive de N'IMPORTE QUEL produit — réservé aux admins
  // (voir Produits/views/produitsViews.py::supprimerProduitAdmin), distinct
  // de supprimerProduit ci-dessus qui reste réservé au vendeur propriétaire
  supprimerProduitAdmin: (id, raison) => api.delete("/produits/admin/supprimer/", { id, raison }),
  // enregistre qu'un acheteur connecté a manifesté son intérêt pour un
  // produit — nécessite d'être connecté, alimente nombre_contacts affiché
  // au vendeur (voir mesProduits.jsx)
  contacterProduit: (id) => api.post("/produits/contacter/", { id }),
  // historique détaillé (qui, quel produit, quand) — vendeur connecté, voir
  // TableauDeBordVendeur.jsx
  historiqueContactsVendeur: () => api.get("/produits/contacts/historique/"),

  // photos — ajout réservé au propriétaire, multipart (voir
  // Produits/views/photoProduits.py::ajouterPhotosProduit) : champ texte
  // produit_id + un ou plusieurs fichiers sous la clé "photos"
  ajouterPhotosProduit: (produitId, fichiers) => {
    const formData = new FormData();
    formData.append("produit_id", produitId);
    fichiers.forEach((fichier) => formData.append("photos", fichier));
    return api.post("/produits/photos/ajouter/", formData);
  },
  listerPhotosProduit: (produitId) => api.get(`/produits/photos/lister/?produit_id=${produitId}`),
  // ordre : liste COMPLÈTE des id de photos du produit dans le nouvel ordre
  // voulu (voir Produits/views/photoProduits.py::reordonnerPhotosProduit)
  reordonnerPhotosProduit: (produitId, ordre) =>
    api.put("/produits/photos/reordonner/", { produit_id: produitId, ordre }),
  supprimerPhotoProduit: (id) => api.delete("/produits/photos/supprimer/", { id }),

  // signalements — signaler un produit incorrect/obsolète (connecté,
  // transmis directement aux admins, voir Produits/views/signalementsViews.py) ;
  // lister/traiter réservés aux admins
  signalerProduit: (produit_id, type_probleme, motif) =>
    api.post("/produits/signaler/", { produit_id, type_probleme, motif }),
  listerSignalementsAdmin: () => api.get("/produits/signalements/en-attente/"),
  // historique — MOI SEUL, sauf "Tous les droits"/propriétaire qui voient
  // aussi les décisions des autres admins (voir Produits/views/signalementsViews.py)
  listerSignalementsTraites: () => api.get("/produits/signalements/traites/"),
  supprimerHistoriqueSignalements: (ids) => api.delete("/produits/signalements/traites/supprimer/", { ids }),
  // traitement groupé — ids = tous les signalements du bloc (même produit,
  // voir regrouperParCible, AdminDashboard.jsx), explication obligatoire
  // (voir RaisonModal.jsx), conservée dans l'historique et le rapport PDF
  traiterSignalement: (ids, explication) => api.post("/produits/signalements/traiter/", { ids, explication }),
  // rapport PDF d'audit — signalements produits/vendeurs/messages/avis
  // confondus, sur une période, filtrable par admin (admin_id omis = tous) —
  // réservé à "Tous les droits"/propriétaire (voir Produits/views/
  // signalementsViews.py::genererRapportSignalements)
  genererRapportSignalements: (dateDebut, dateFin, adminId) => {
    const params = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin });
    if (adminId) params.set("admin_id", adminId);
    return api.getBlob(`/produits/signalements/rapport-audit/?${params.toString()}`);
  },

  // signalements vendeur — signaler un vendeur (connecté, transmis
  // directement aux admins) ; au-delà de 5 signalements pour le même motif,
  // le compte est suspendu automatiquement (voir Registration/models.py::
  // Utilisateur.desactive_par_signalements et signalerVendeur ci-dessous) ;
  // lister/traiter réservés aux admins
  signalerVendeur: (vendeur_id, type_probleme, motif) =>
    api.post("/produits/signaler-vendeur/", { vendeur_id, type_probleme, motif }),
  listerSignalementsVendeursAdmin: () => api.get("/produits/signalements-vendeurs/en-attente/"),
  listerSignalementsVendeursTraites: () => api.get("/produits/signalements-vendeurs/traites/"),
  supprimerHistoriqueSignalementsVendeurs: (ids) => api.delete("/produits/signalements-vendeurs/traites/supprimer/", { ids }),
  // traitement groupé — voir traiterSignalement ci-dessus, même principe
  traiterSignalementVendeur: (ids, explication) => api.post("/produits/signalements-vendeurs/traiter/", { ids, explication }),

  // avis produit — poser/modifier son avis (connecté, sauf sur son propre
  // produit), lecture publique (voir Produits/views/avisViews.py)
  listerAvisProduit: (produitId) => api.get(`/produits/avis/lister/?produit_id=${produitId}`),
  // tous les avis reçus sur MES produits, tous confondus (vendeur connecté) —
  // profil vendeur, section "Avis et commentaires" (voir ProfilAcheteur.jsx)
  listerAvisRecusVendeur: () => api.get("/produits/avis/recus/"),
  creerModifierAvis: (produit_id, note, commentaire) =>
    api.post("/produits/avis/creer/", { produit_id, note, commentaire }),
  // raison obligatoire seulement quand un admin supprime l'avis de
  // quelqu'un d'autre (voir Produits/views/avisViews.py::supprimerAvis)
  supprimerAvis: (id, raison) => api.delete("/produits/avis/supprimer/", { id, raison }),

  // signalements avis — signaler un avis (connecté, transmis directement aux
  // admins, voir Produits/views/signalementsViews.py::signalerAvis) ;
  // lister/traiter réservés aux admins
  signalerAvis: (avis_id, type_probleme, motif) =>
    api.post("/produits/avis/signaler/", { avis_id, type_probleme, motif }),
  listerSignalementsAvisAdmin: () => api.get("/produits/avis/signalements/en-attente/"),
  listerSignalementsAvisTraites: () => api.get("/produits/avis/signalements/traites/"),
  supprimerHistoriqueSignalementsAvis: (ids) => api.delete("/produits/avis/signalements/traites/supprimer/", { ids }),
  // traitement groupé — voir traiterSignalement ci-dessus, même principe
  traiterSignalementAvis: (ids, explication) => api.post("/produits/avis/signalements/traiter/", { ids, explication }),
};
