import { create } from "zustand";
import { AuthentificationApi } from "../api/auth";
import { useProfilStore } from "../Profil/ProfilStore";

export const useAuthStore = create((set, get) => ({
    // verifie localStorage pour voir si l'utilisateur est deja connecté
    utilisateur: AuthentificationApi.getUtilisateur(),
    profil:      JSON.parse(localStorage.getItem("profil")) || null,
    // entreprise liée à l'utilisateur (proprietaire_id === utilisateur.id dans la table entreprise)
    entreprise:  JSON.parse(localStorage.getItem("entreprise")) || null,
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
            get().chargerEntreprise();
            // charge le profil (dont la photo) immédiatement après la connexion
            useProfilStore.getState().afficherProfil().catch(() => {});
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },
    // deconnexion — supprime le token et met à jour le store
    // Le token local est toujours effacé, même si l'appel au backend échoue
    // (ex. token déjà expiré/invalide), pour éviter de bloquer l'utilisateur.
    deconnexion: async () => {
        try {
            await AuthentificationApi.deconnexion();
        } catch (error) {
            console.error("Erreur déconnexion :", error.message);
        } finally {
            localStorage.removeItem("token");
            localStorage.removeItem("utilisateur");
            localStorage.removeItem("entreprise");
            set({ utilisateur: null, entreprise: null, isConnected: false, loading: false });
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
            get().chargerEntreprise();
            // charge le profil (dont la photo) immédiatement après la connexion
            useProfilStore.getState().afficherProfil().catch(() => {});
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

    // création d'une entreprise (utilisée après l'inscription via l'onglet "Antrepriz")
    // l'entreprise renvoyée (proprietaire_id === utilisateur.id) est mise en cache
    // pour déterminer si le compte connecté est une entreprise.
    creerEntreprise: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.creerEntreprise(data);
            localStorage.setItem("entreprise", JSON.stringify(res.entreprise));
            set({ entreprise: res.entreprise });
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    // récupère l'entreprise (s'il y en a une) appartenant à l'utilisateur connecté
    // — appelée après connexion pour fonctionner même sur un autre appareil/après vidage du cache
    chargerEntreprise: async () => {
        try {
            const res = await AuthentificationApi.listerEntreprises();
            const entreprise = res.entreprises?.[0] || null;
            localStorage.setItem("entreprise", JSON.stringify(entreprise));
            set({ entreprise });
            return entreprise;
        } catch (error) {
            // silencieux : pas bloquant pour la connexion si l'appel échoue
            console.error("Erreur chargement entreprise :", error.message);
        }
    },

    // vérifie si une entreprise (nom + numéro d'enregistrement) existe déjà
    // — appelée avant inscription() pour ne pas créer de compte si l'entreprise existe déjà
    verifierEntreprise: async (nom_Entreprise, num_Enregistrement) => {
        set({ error: null });
        try {
            const res = await AuthentificationApi.verifierEntreprise(nom_Entreprise, num_Enregistrement);
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    // effacer les erreurs
    clearError: () => set({ error: null }),

}));