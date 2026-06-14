import { api } from "./client";
export const AuthentificationApi = {
  inscription: (data) => api.post("/Registration/inscription/", data),
  // connexion — sauvegarde le token
  connexion: async (data) => {
    const res = await api.post("/Registration/connexion/", data);
    localStorage.setItem("token", res.token);
    localStorage.setItem("utilisateur", JSON.stringify(res.utilisateur));
    return res;
  },
  // deconnexion — supprime le token
  deconnexion: async (data) => {
    await api.post("/Registration/deconnexion/", data);
    localStorage.removeItem("token");
    localStorage.removeItem("utilisateur");
  },
  // profil
  getprofil: () => api.get("/Registration/profil"),
  updateprofil: (data) => api.put("/Registration/profil", data),
  
  isConnected: () => !!localStorage.getItem("token"),

  getUtilisateur: () => {
    const u = localStorage.getItem("utilisateur");
    return u ? JSON.parse(u) : null;
  }
};
