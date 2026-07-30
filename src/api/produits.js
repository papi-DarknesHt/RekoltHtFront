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
  detailProduit:   (id) => api.get(`/produits/detail/?id=${id}`),
  // infos publiques d'un vendeur (page détail produit) — pas d'email/téléphone,
  // le contact passe par contacterProduit/la messagerie (voir Produits/views/produitsViews.py::infoVendeur)
  infoVendeur:     (vendeurId) => api.get(`/produits/vendeur/?vendeur_id=${vendeurId}`),
  modifierProduit: (data) => api.put("/produits/modifier/", data),
  supprimerProduit: (id) => api.delete("/produits/supprimer/", { id }),
  toggleDisponibiliteProduit: (id) => api.put("/produits/toggle-disponibilite/", { id }),
  // enregistre qu'un visiteur a manifesté son intérêt pour un produit —
  // public, alimente nombre_contacts affiché au vendeur (voir mesProduits.jsx)
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
  supprimerPhotoProduit: (id) => api.delete("/produits/photos/supprimer/", { id }),
};
