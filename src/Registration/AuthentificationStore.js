import { create } from "zustand";
import { AuthentificationApi } from "../api/auth";
import { useProfilStore } from "../Profil/ProfilStore";

// Nettoie les valeurs corrompues du localStorage au démarrage
["profil", "utilisateur", "entreprise"].forEach((key) => {
  const val = localStorage.getItem(key);
  if (val === "undefined" || val === "null") localStorage.removeItem(key);
});

export const useAuthStore = create((set, get) => ({
    // verifie localStorage pour voir si l'utilisateur est deja connecté
    utilisateur: AuthentificationApi.getUtilisateur(),
    profil:      (() => { try { return JSON.parse(localStorage.getItem("profil")); } catch { return null; } })() || null,
    // entreprise liée à l'utilisateur (proprietaire_id === utilisateur.id dans la table entreprise)
    entreprise:  JSON.parse(localStorage.getItem("entreprise")) || null,
    isConnected: !!AuthentificationApi.isConnected(),
    loading: false,
    error: null,
    // inscription — étape 1 seulement : envoie l'email d'activation, ne
    // connecte PAS (voir Registration/views.py::sinscrire) — le compte n'existe
    // pas encore tant que confirmerInscription() n'a pas été appelée (lien
    // cliqué, voir ActiverCompte.jsx)
    inscription: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.inscription(data);
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    // inscription — étape 2 : valide le token du lien d'activation, connecte
    // enfin le compte (même effet que l'ancienne inscription()/creerEntreprise()
    // directe) — couvre aussi bien un compte individuel qu'une entreprise
    // (voir Registration/views.py::confirmerInscription) : res.entreprise
    // n'est présent que dans ce second cas.
    confirmerInscription: async (token) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.confirmerInscription(token);
            localStorage.setItem("token", res.token);
            localStorage.setItem("utilisateur", JSON.stringify(res.utilisateur));
            if (res.entreprise) localStorage.setItem("entreprise", JSON.stringify(res.entreprise));
            set({ utilisateur: res.utilisateur, isConnected: true, ...(res.entreprise ? { entreprise: res.entreprise } : {}) });
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
            // "profil" (rôle, photo, ...) restait en localStorage/ProfilStore
            // après déconnexion : sur un poste partagé, le prochain compte
            // connecté voyait brièvement — ou indéfiniment si son propre
            // afficherProfil() échouait — le profil de l'utilisateur précédent
            localStorage.removeItem("profil");
            useProfilStore.setState({ profil: null });
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

    // inscription autonome d'un compte entreprise (onglet "Antrepriz") — étape
    // 1 seulement : envoie l'email d'activation, ne connecte PAS encore (voir
    // Registration/views.py::creerEntreprise) — le compte n'existe pas encore
    // tant que confirmerInscription() n'a pas été appelée (lien cliqué, voir
    // ActiverCompte.jsx), même exigence explicite que pour un compte
    // individuel : le mail de l'entreprise doit être opérationnel.
    creerEntreprise: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.creerEntreprise(data);
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

    // mise à jour d'une entreprise appartenant à l'utilisateur connecté
    modifierEntreprise: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.modifierEntreprise(data);
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

    // suppression du logo d'une entreprise déjà enregistré
    supprimerLogoEntreprise: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await AuthentificationApi.supprimerLogoEntreprise(id);
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

    // vérifie si une entreprise (nom) existe déjà — appelée avant inscription()
    // pour ne pas créer de compte si l'entreprise existe déjà
    verifierEntreprise: async (nom_Entreprise) => {
        set({ error: null });
        try {
            const res = await AuthentificationApi.verifierEntreprise(nom_Entreprise);
            return res;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    // effacer les erreurs
    clearError: () => set({ error: null }),

}));