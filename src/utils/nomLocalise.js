// Résout le nom localisé d'une catégorie/sous-catégorie (voir Produits/
// models/categoriesModels.py et sousCategoriesModel.py : `nom` est le champ
// français canonique, toujours rempli ; `nom_ht`/`nom_en` sont des
// traductions optionnelles ajoutées après coup par un admin — vides tant
// qu'elles n'ont pas été saisies). Contrairement aux noms de produits/unités
// de mesure (texte libre tapé par chaque vendeur, non traduisibles sans un
// vrai service de traduction automatique), catégories et sous-catégories
// forment une liste fixe et restreinte que quelques admins gèrent — les
// traduire une fois suffit.
//
// Repli : `nom_${lang}` s'il est rempli, sinon `nom` (français) — jamais de
// chaîne vide affichée même si une traduction n'a pas encore été saisie.
export function nomLocalise(objet, lang) {
  if (!objet) return "";
  if (lang === "fr") return objet.nom || "";
  const traduit = objet[`nom_${lang}`];
  return traduit || objet.nom || "";
}
