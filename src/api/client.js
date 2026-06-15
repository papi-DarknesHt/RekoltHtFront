const BASE_URL = "http://localhost:8000";

async function request(path, options = {}) {
  // recupere le token du localStorage  
  const token = localStorage.getItem("token");

  const res = await fetch(`${BASE_URL}${path}`, {
    method:  options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Token ${token}` }),
    },
    credentials: "include",
    body: options.body || undefined,
  });
  if (!res.ok) {
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
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};