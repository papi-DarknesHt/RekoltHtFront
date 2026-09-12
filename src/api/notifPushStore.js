import { create } from "zustand";

// Préférence EXPLICITE de l'utilisateur pour les notifications navigateur
// (API Notification native — voir NotificationsPermission.jsx et le
// commutateur dans NavBar.jsx). Contrairement à la fermeture "Plus tard" de
// la modale de première demande (jamais persistée, voir
// NotificationsPermission.jsx), CE réglage-ci EST persisté : c'est un choix
// actif et réversible ("activer/désactiver quand il veut", demande
// explicite), pas une simple mise de côté temporaire d'une suggestion.
//
// Distinct de Notification.permission (mémorisé par le NAVIGATEUR lui-même,
// jamais révocable en JS une fois accordé/refusé) : ce drapeau-ci contrôle
// uniquement si CETTE app choisit d'appeler new Notification(...) — permet à
// l'utilisateur de couper les notifications sans avoir à rouvrir les
// paramètres du navigateur, et de les rallumer aussi facilement.
const CLE_STOCKAGE = "notifsPousseesActivees";

function lirePreference() {
  const brut = localStorage.getItem(CLE_STOCKAGE);
  // par défaut activées (true) dès que la permission navigateur est accordée
  // — aucune valeur enregistrée pour un tout nouveau visiteur/appareil
  return brut === null ? true : brut === "true";
}

export const useNotifPushStore = create((set) => ({
  activees: lirePreference(),
  definir: (valeur) => {
    localStorage.setItem(CLE_STOCKAGE, String(valeur));
    set({ activees: valeur });
  },
}));
