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
  desactiverProduitAdmin: (id) => api.put("/produits/admin/desactiver/", { id }),
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
  traiterSignalement: (id) => api.post("/produits/signalements/traiter/", { id }),

  // signalements vendeur — signaler un vendeur (connecté, transmis
  // directement aux admins) ; au-delà de 5 signalements pour le même motif,
  // le compte est suspendu automatiquement (voir Registration/models.py::
  // Utilisateur.desactive_par_signalements et signalerVendeur ci-dessous) ;
  // lister/traiter réservés aux admins
  signalerVendeur: (vendeur_id, type_probleme, motif) =>
    api.post("/produits/signaler-vendeur/", { vendeur_id, type_probleme, motif }),
  listerSignalementsVendeursAdmin: () => api.get("/produits/signalements-vendeurs/en-attente/"),
  traiterSignalementVendeur: (id) => api.post("/produits/signalements-vendeurs/traiter/", { id }),

  // avis produit — poser/modifier son avis (connecté, sauf sur son propre
  // produit), lecture publique (voir Produits/views/avisViews.py)
  listerAvisProduit: (produitId) => api.get(`/produits/avis/lister/?produit_id=${produitId}`),
  creerModifierAvis: (produit_id, note, commentaire) =>
    api.post("/produits/avis/creer/", { produit_id, note, commentaire }),
  supprimerAvis: (id) => api.delete("/produits/avis/supprimer/", { id }),

  // signalements avis — signaler un avis (connecté, transmis directement aux
  // admins, voir Produits/views/signalementsViews.py::signalerAvis) ;
  // lister/traiter réservés aux admins
  signalerAvis: (avis_id, type_probleme, motif) =>
    api.post("/produits/avis/signaler/", { avis_id, type_probleme, motif }),
  listerSignalementsAvisAdmin: () => api.get("/produits/avis/signalements/en-attente/"),
  traiterSignalementAvis: (id) => api.post("/produits/avis/signalements/traiter/", { id }),
};
