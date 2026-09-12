// Symbole compact d'une devise (voir Produits/models/produitsModels.py::
// UNITEPRIX) pour un affichage de prix ("150 G", "12 $") plutôt que le code
// brut stocké en base ("150 HTG", "12 US") — un symbole se lit dans n'importe
// quelle langue sans traduction (comme "kg" ou "$"), contrairement au code
// ISO qui, affiché tel quel à côté d'une interface entièrement en kreyòl ou
// en anglais, donnait l'impression d'un bout d'anglais oublié. Le libellé
// long et traduit ("Gourdes (HTG)", voir product.currencyHTG/currencyUS
// dans les fichiers de traduction) reste utilisé pour le <select> de choix
// de devise (Produits/AjouterProduit.jsx, modifierProduits.jsx) — ce
// symbole-ci est réservé à l'affichage compact d'un prix déjà choisi.
const SYMBOLES = { HTG: "G", US: "$" };

export function symboleDevise(code) {
  return SYMBOLES[code] || code || "";
}
