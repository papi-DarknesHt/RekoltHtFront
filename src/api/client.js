import { traduireErreurApi } from "./apiErrors.js";

const BASE_URL = import.meta.env.VITE_API_URL || "https://rekolthtbackend.onrender.com";

// préfère le message traduit (voir error_code renvoyé par le backend et
// apiErrors.* dans les fichiers de traduction) — ne couvre pour l'instant que
// les erreurs les plus fréquentes/génériques ; les autres retombent sur le
// message brut renvoyé par Django (toujours en français)
function resoudreMessageErreur(data, status) {
  const traduit = traduireErreurApi(data?.error_code, data?.error_params);
  return traduit || data?.error || data?.message || data?.detail || `Erreur ${status}`;
}

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token && { "Authorization": `Token ${token}` }),
    },
    credentials: "include",
    body: options.body || undefined,
  });
  if (!res.ok) {
    // Session expirée ou révoquée (ex. connexion depuis un autre navigateur)
    if (res.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("utilisateur");
      localStorage.removeItem("entreprise");
      localStorage.removeItem("profil");
      window.location.href = "/";
      throw new Error("session-expired");
    }
    const data = await res.json().catch(() => ({}));
    const erreur = new Error(resoudreMessageErreur(data, res.status));
    // status/code exposés pour les appelants qui doivent distinguer un cas
    // précis (ex: 404 "pas encore configuré" vs une vraie erreur) sans
    // dépendre du texte du message traduit
    erreur.status = res.status;
    erreur.code = data?.error_code;
    throw erreur;
  }
  // DELETE retourne souvent un body vide
  if (res.status === 204) return {};

  return res.json();
}

// pour les réponses binaires (PDF de prévisualisation du contrat) — request()
// appelle toujours res.json(), inutilisable sur un corps de réponse non-JSON
async function requestBlob(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "POST",
    headers: { ...(token && { "Authorization": `Token ${token}` }) },
    credentials: "include",
    body: options.body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(resoudreMessageErreur(data, res.status));
  }
  return res.blob();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: body instanceof FormData ? body : JSON.stringify(body) }),
  delete: (path, body) => request(path, { method: "DELETE", body: body !== undefined ? JSON.stringify(body) : undefined }),
  postBlob: (path, body) => requestBlob(path, { method: "POST", body }),
  getBlob: (path) => requestBlob(path, { method: "GET" }),
};