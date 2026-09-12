
export const SECTIONS_AIDE = [
  { cle: "compte", nombreItems: 5 },
  { cle: "recherche", nombreItems: 3 },
  { cle: "devenirVendeur", nombreItems: 4 },
  { cle: "gererProduits", nombreItems: 3 },
  { cle: "espaceVendeur", nombreItems: 4 },
  { cle: "contacter", nombreItems: 3 },
  { cle: "securite", nombreItems: 4 },
  { cle: "support", nombreItems: 2 },
];

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
