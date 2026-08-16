// Format d'affichage unique de la localisation d'un produit — "Section
// Communale, Commune, Département, Haïti" (même format que ProfilAcheteur.jsx
// pour la localisation d'un compte) — les parties absentes sont simplement
// omises plutôt que de laisser un champ vide dans la liste. Centralisé ici
// car dupliqué à l'identique dans HomePage.jsx, ProfilVendeur.jsx,
// DetailProduit.jsx, mesProduits.jsx et afficherProduits.jsx.
export function formaterLocalisationProduit(produit, texteHaiti) {
  const parties = [produit?.section_comunale, produit?.commune, produit?.departement].filter(Boolean);
  return parties.length > 0 ? [...parties, texteHaiti].join(", ") : null;
}