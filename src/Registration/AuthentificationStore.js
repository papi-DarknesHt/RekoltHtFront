import { create } from "zustand";
import { AuthentificationApi } from "../api/auth";

export const useAuthStore = create((set) => ({
    // verifie localStorage pour voir si l'utilisateur est deja connecté
    utilisateur: AuthentificationApi.getUtilisateur(),
    profil:      JSON.parse(localStorage.getItem("profil")) || null,
    isConnected: !!AuthentificationApi.isConnected(),
    loading: false,
    error: null,
    // inscription — enregistre l'utilisateur et met à jour le store
    inscription: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.inscription(data);
            localStorage.setItem("token", res.token);
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

    // Authentification avec google pour la connection
    googleConnexion: async (token) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.googleConnexion({ token });
            localStorage.setItem("token", res.token);
            localStorage.setItem("utilisateur", JSON.stringify(res.utilisateur));
            localStorage.setItem("profil",      JSON.stringify(res.profil || {}));
            // set({ utilisateur: res.utilisateur,profil: res.profil, isConnected: true });
            set({ utilisateur: res.utilisateur, isConnected: true });
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },
    
    // Authentification avec google pour l'inscription
    googleInscription: async (token, role = "acheteur") => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.googleInscription({ token, role });
            localStorage.setItem("token", res.token);
            localStorage.setItem("utilisateur", JSON.stringify(res.utilisateur));
            // set({ utilisateur: res.utilisateur,profil: res.profil, isConnected: true });
            set({ utilisateur: res.utilisateur, isConnected: true });
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    // mise à jour des informations utilisateur (nom, prenom, email, telephone)
    // appelle le nouvel endpoint /Registration/modifier-utilisateur/ et met à jour le store + localStorage
    modifierUtilisateur: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.modifierUtilisateur(data);
            localStorage.setItem("utilisateur", JSON.stringify(res.utilisateur));
            set({ utilisateur: res.utilisateur });
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    // changement de mot de passe — appelle /Registration/modifier-mdp/
    modifierMotDePasse: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.modifierMotDePasse(data);
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