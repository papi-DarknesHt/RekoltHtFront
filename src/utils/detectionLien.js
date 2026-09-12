// Détecte un lien dans un texte libre — utilisé pour empêcher un utilisateur
// d'envoyer un lien dans un message "Contacter un admin" (voir
// Support/ContacterAdmin.jsx et Messagerie/views.py::contacterAdmin côté
// backend, même règle des deux côtés). Couvre les URLs avec protocole/www
// explicite (http://, https://, www.) et les domaines nus les plus courants
// (ex: "exemple.com/page", sans protocole) — pas exhaustif (aucune regex ne
// l'est), mais couvre l'immense majorité des tentatives.
const REGEX_LIEN = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|ht|io|co|info|biz|xyz|link|app|gov|edu|me|tv|shop)(\/\S*)?\b/i;

export function contientLien(texte) {
  return REGEX_LIEN.test(texte || "");
}
