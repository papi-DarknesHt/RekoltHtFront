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

  // produits — lecture publique (filtres optionnels en query string)
  listerProduits: () => api.get("/produits/lister/"),
  creerProduit:   (data) => api.post("/produits/creer/", data),
};
