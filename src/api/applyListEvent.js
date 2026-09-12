// Applique un évènement WebSocket "<chose>.created|updated|deleted"  à une 
// liste locale déjà chargée via l'API REST — ajoute, remplace ou retire 
// l'élément par id, sans exiger un rechargement de page.

export function applyListEvent(liste, { type, data }) {
  if (type.endsWith(".deleted")) {
    return liste.filter((item) => item.id !== data.id);
  }
  const existe = liste.some((item) => item.id === data.id);
  return existe
    ? liste.map((item) => (item.id === data.id ? { ...item, ...data } : item))
    : [...liste, data];
}
