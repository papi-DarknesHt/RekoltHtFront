import { api } from "./client";

// Matériel de clé pour le chiffrement de bout en bout de la messagerie (voir
// Registration/views.py::cleChiffrement/clePubliqueUtilisateur/clesPubliquesAdmins
// et src/utils/e2eCrypto.js côté client — le serveur ne stocke jamais rien
// en clair ici, uniquement de la clé publique et du matériel déjà chiffré).
export const E2eApi = {
  // propre matériel de clé — 404 si pas encore configuré
  obtenirMaCle: () => api.get("/Registration/cle-chiffrement/"),

  // création initiale (première configuration du code PIN)
  creerMaCle: (data) => api.post("/Registration/cle-chiffrement/", data),

  // ré-enveloppement (changement de code PIN, ou régénération complète après PIN oublié)
  modifierMaCle: (data) => api.put("/Registration/cle-chiffrement/", data),

  // clé publique d'un autre utilisateur (messagerie privée 1:1)
  obtenirClePublique: (utilisateurId) => api.get(
    `/Registration/cle-chiffrement/publique/?utilisateur_id=${utilisateurId}`
  ),

  // clés publiques de tous les admins déjà configurés (messagerie support, chiffrement en enveloppe)
  obtenirClesAdmins: () => api.get("/Registration/cle-chiffrement/admins/"),
};
