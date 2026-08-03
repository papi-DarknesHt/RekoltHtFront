// Géocodage inverse via Nominatim (OpenStreetMap) — récupère un texte
// d'adresse approximatif (zone/quartier) à partir d'un point GPS. Usage
// client, occasionnel (un appel par clic sur la carte), conforme au volume
// toléré par l'API publique ; aucune clé requise.
export async function adresseApproximative(lat, lon, { signal } = {}) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1&accept-language=fr`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.error) return null;

  const a = data.address || {};
  // priorité aux niveaux les plus locaux disponibles (quartier/zone), sans
  // répéter la commune (déjà affichée séparément dans le formulaire)
  return a.suburb || a.neighbourhood || a.village || a.hamlet || a.quarter || data.display_name || null;
}
