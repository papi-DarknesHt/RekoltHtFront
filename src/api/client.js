
const BASE_URL = import.meta.env.VITE_API_URL || "https://rekolthtbackend.onrender.com";

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${BASE_URL}${path}`, {
    method:  options.method || "GET",
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
    const message = data?.error || data?.message || data?.detail || `Erreur ${res.status}`;
    throw new Error(message);
  }
  // DELETE retourne souvent un body vide
  if (res.status === 204) return {};

  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: body instanceof FormData ? body : JSON.stringify(body) }),
  delete: (path, body) => request(path, { method: "DELETE", body: body !== undefined ? JSON.stringify(body) : undefined }),
};