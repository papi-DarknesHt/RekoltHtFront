// Recherche de réponse dans la FAQ pour le chatbot (ChatbotVendeur.jsx) —
// pas un vrai NLP, un simple recoupement de mots-clés significatifs entre la
// question posée et chaque question de la FAQ (aide.sections.*, voir
// faqSections.js). Suffisant pour un jeu de ~25 questions/réponses fixes ;
// pas conçu pour scaler à une vraie base de connaissances.

// mots à ignorer car trop fréquents pour être discriminants — mélange
// français/anglais/kreyòl puisque les trois langues de l'app sont possibles
const MOTS_VIDES = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "je", "tu", "il", "elle", "nous", "vous", "ils", "elles",
  "et", "ou", "est", "son", "sa", "ses", "mon", "ma", "mes", "comment", "quoi", "pour", "que", "qui", "sur", "avec",
  "a", "au", "aux", "en", "pas", "ne", "se", "ce", "cette", "dans", "si", "faire", "peut", "puis", "etre", "sont",
  "the", "an", "is", "are", "to", "of", "and", "or", "for", "how", "what", "do", "does", "can", "i", "you",
  "my", "your", "in", "on", "with", "this", "that", "there", "have", "has",
  "yon", "nan", "pou", "ki", "sa", "mwen", "ou", "li", "nou", "yo", "ak", "se", "gen", "fe", "kijan", "kisa", "genyen",
]);

// retire les accents (é -> e, etc.) en supprimant les marques diacritiques
// combinantes (U+0300-U+036F) une fois le texte décomposé en NFD — comparaison
// par code point plutôt qu'une regex à caractères Unicode littéraux, pour ne
// dépendre d'aucun encodage particulier du fichier source
function retirerAccents(texte) {
  return texte
    .normalize("NFD")
    .split("")
    .filter((car) => {
      const code = car.codePointAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

function normaliser(texte) {
  return retirerAccents(texte.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function motsSignificatifs(texte) {
  return normaliser(texte).filter((mot) => mot.length > 1 && !MOTS_VIDES.has(mot));
}

// seuil minimal de recoupement (proportion de mots communs par rapport au
// plus long des deux ensembles) pour accepter une correspondance — évite de
// répondre à côté sur une question sans rapport avec la FAQ
const SEUIL_CORRESPONDANCE = 0.34;

/**
 * Cherche la question de la FAQ la plus proche de `question`.
 * `faq` : [{ question, reponse }, ...] déjà traduit dans la langue courante.
 * Retourne l'entrée correspondante ou null si rien d'assez proche.
 */
export function trouverReponseFaq(question, faq) {
  const motsQuestion = motsSignificatifs(question);
  if (motsQuestion.length === 0) return null;

  let meilleure = null;
  let meilleurScore = 0;

  for (const item of faq) {
    const motsFaq = motsSignificatifs(item.question);
    if (motsFaq.length === 0) continue;
    const communs = motsQuestion.filter((mot) => motsFaq.includes(mot));
    if (communs.length === 0) continue;
    const score = communs.length / Math.max(motsQuestion.length, motsFaq.length);
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleure = item;
    }
  }

  return meilleurScore >= SEUIL_CORRESPONDANCE ? meilleure : null;
}
