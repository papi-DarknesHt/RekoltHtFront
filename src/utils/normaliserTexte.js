// normalise une chaîne pour comparaison insensible à la casse/aux accents —
// utilisé pour faire correspondre les noms administratifs du GeoJSON (HDX)
// avec ceux du référentiel haiti_departements.json (graphies parfois
// différentes : "Croix-Des-Bouquets" vs "Croix des Bouquets")
const ACCENTS = { à: "a", â: "a", ä: "a", é: "e", è: "e", ê: "e", ë: "e", î: "i", ï: "i", ô: "o", ö: "o", ù: "u", û: "u", ü: "u", ç: "c" };

export function normaliser(texte) {
  return (texte || "")
    .toLowerCase()
    .trim()
    .replace(/[àâäéèêëîïôöùûüç]/g, (c) => ACCENTS[c] || c)
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ");
}
