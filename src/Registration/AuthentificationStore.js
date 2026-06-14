import { create } from "zustand";
import { AuthentificationApi } from "../api/auth";

export const useAuthStore = create((set) => ({
    // verifie localStorage pour voir si l'utilisateur est deja connecté
    utilisateur: AuthentificationApi.getUtilisateur(),
    isConnected: !!AuthentificationApi.isConnected(),
    loading: false,
    error: null,
    // inscription — enregistre l'utilisateur et met à jour le store
    inscription: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.inscription(data);
            localStorage.setItem("token",       res.token);
            localStorage.setItem("utilisateur", JSON.stringify(res.utilisateur));
            set({ utilisateur: res.utilisateur, isConnected: true });
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    connexion: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.connexion(data);
            set({ utilisateur: res.utilisateur, isConnected: true });
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },
    // deconnexion — supprime le token et met à jour le store
    deconnexion: async () => {
        try {
            await AuthentificationApi.deconnexion();
            set({ utilisateur: null, isConnected: false });
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