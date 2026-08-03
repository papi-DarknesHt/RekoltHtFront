// normalise un numéro de téléphone haïtien vers le format international
// attendu par WhatsApp (chiffres seuls, indicatif pays inclus) — les comptes
// créés via Authentification.jsx stockent déjà "+509XXXXXXXX" (voir
// formatTelephone), mais on reste tolérant à d'autres graphies existantes.
export function normaliserNumeroWhatsApp(telephone) {
  if (!telephone) return null;
  const chiffres = telephone.replace(/\D/g, "");
  if (!chiffres) return null;
  if (chiffres.startsWith("509") && chiffres.length === 11) return chiffres;
  if (chiffres.length === 8) return `509${chiffres}`;
  if (chiffres.length > 8) return chiffres; // indicatif pays déjà présent, autre que 509
  return null; // trop court pour être exploitable
}

// message prérempli joint au lien WhatsApp — l'acheteur le complète/corrige
// avant d'appuyer lui-même sur envoyer, wa.me ne permet aucun envoi
// automatique. Remarque : WhatsApp ne propose aucune vraie mise en forme
// "citation/réponse" pour un texte prérempli via un lien wa.me — un préfixe
// "> " n'y est jamais interprété, il s'affiche tel quel (essayé, moins
// lisible) ; la salutation + les infos clairement labellisées restent le
// format le plus lisible pour l'instant.
export function construireMessageWhatsApp(t, { nom, description, prix, devise, lieu, lien }) {
  const lignes = [t("home.whatsappGreeting"), "", `*${nom}*`];
  if (description) lignes.push(description);
  if (prix != null) lignes.push(`${t("home.whatsappPrice")} : ${prix}${devise ? ` ${devise}` : ""}`);
  if (lieu) lignes.push(`${t("home.whatsappLocation")} : ${lieu}`);
  if (lien) lignes.push(lien);
  lignes.push("", "");
  return lignes.join("\n");
}

// construit le lien wa.me — null si le numéro n'est pas exploitable (le
// bouton WhatsApp ne doit alors pas s'afficher). Aucune API cliente ne
// permet de vérifier à l'avance qu'un numéro est enregistré sur WhatsApp
// (nécessite un compte WhatsApp Business payant) : wa.me reste la seule
// méthode disponible côté frontend — si le numéro n'a pas WhatsApp, c'est
// WhatsApp lui-même qui l'indique à l'ouverture du lien.
export function construireLienWhatsApp(telephone, message) {
  const numero = normaliserNumeroWhatsApp(telephone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}
