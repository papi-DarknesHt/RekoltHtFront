// Sections de la FAQ (voir src/pages/aide.jsx), réutilisées telles quelles
// comme base de connaissances par le chatbot (src/components/ChatbotVendeur.jsx)
// pour répondre aux questions — modifier une réponse dans les fichiers de
// traduction (aide.sections.<cle>.qN/aN) la met à jour aux deux endroits à
// la fois, sans dupliquer le contenu.
export const SECTIONS_AIDE = [
  { cle: "compte", nombreItems: 4 },
  { cle: "recherche", nombreItems: 3 },
  { cle: "devenirVendeur", nombreItems: 4 },
  { cle: "gererProduits", nombreItems: 3 },
  { cle: "contacter", nombreItems: 3 },
  { cle: "securite", nombreItems: 4 },
  { cle: "support", nombreItems: 2 },
];

// même principe que SECTIONS_AIDE ci-dessus, pour le contenu (en prose, pas
// déjà en questions/réponses) des pages "Qui sommes-nous" (QuiSommesNous.jsx)
// et "Politique d'utilisation" (PolitiqueUtilisation.jsx) — chaque entrée
// pointe vers une formulation de question ajoutée spécifiquement pour le
// chatbot (about.*Question / terms.s*Question) et la réponse déjà affichée
// sur la page correspondante (about.*Text / terms.s*Text), jamais dupliquée.
export const SECTIONS_A_PROPOS = [
  { questionCle: "about.missionQuestion", reponseCle: "about.missionText" },
  { questionCle: "about.value1Question", reponseCle: "about.value1Text" },
  { questionCle: "about.value2Question", reponseCle: "about.value2Text" },
  { questionCle: "about.value3Question", reponseCle: "about.value3Text" },
  { questionCle: "about.value4Question", reponseCle: "about.value4Text" },
];

export const SECTIONS_CONDITIONS = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => ({
  questionCle: `terms.s${n}Question`,
  reponseCle: `terms.s${n}Text`,
}));
