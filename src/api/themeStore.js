import { create } from "zustand";

const CLE_STORAGE = "theme";

// thème initial : préférence déjà enregistrée, sinon celle du système —
// lu de façon synchrone au chargement du module (avant le premier rendu,
// voir main.jsx qui importe ce fichier en tout premier) pour éviter un
// flash de thème clair avant que React ne monte
function lireThemeInitial() {
  const stocke = localStorage.getItem(CLE_STORAGE);
  if (stocke === "light" || stocke === "dark") return stocke;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function appliquerTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(CLE_STORAGE, theme);
}

const themeInitial = lireThemeInitial();
appliquerTheme(themeInitial);

// zustand partagé plutôt qu'un état local à NavBar.jsx : NavBar est remonté
// à chaque page (voir App.jsx), un état local perdrait la synchronisation
// entre plusieurs instances/composants qui liraient le thème courant
export const useThemeStore = create((set, get) => ({
  theme: themeInitial,
  toggleTheme: () => {
    const nouveau = get().theme === "dark" ? "light" : "dark";
    appliquerTheme(nouveau);
    set({ theme: nouveau });
  },
}));
