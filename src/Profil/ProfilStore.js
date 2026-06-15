import { create } from "zustand";
import { AuthentificationApi } from "../api/auth";

export const useProfilStore = create((set) => ({
    profil: JSON.parse(localStorage.getItem("profil")) || null,
    utilisateur: AuthentificationApi.getUtilisateur(),
    isConnected: !!AuthentificationApi.isConnected(),
    loading: false,
    error: null,
    // afficher profil
    afficherProfil: async () => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.getprofil();
            console.log(res);
            set({ profil: res.profil });
            localStorage.setItem("profil", JSON.stringify(res.profil));
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }

    },

    // mise à jour des informations du profil (bio, adresse, photo_profil, role, ...)
    // appelle le nouvel endpoint /Registration/modifier-profil/ et met à jour le store + localStorage
    modifierProfil: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.modifierProfil(data);
            set({ profil: res.profil });
            localStorage.setItem("profil", JSON.stringify(res.profil));
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    // effacer les erreurs
    clearError: () => set({ error: null }),
}));

